"""AI 助手服务：大模型 Agent 循环，通过 MCP 工具编辑本体。

流程：用户消息 + 项目上下文 -> 大模型（OpenAI 兼容 API，tool calling）->
若请求调用工具则执行对应 MCP 工具（绑定当前登录账号的权限）-> 结果回填 ->
继续循环，直到大模型给出最终回复或达到最大轮数。
"""

import json

import httpx
from sqlalchemy.orm import Session

from .. import mcp_server as mcp_mod
from ..models import AiSetting, User

MAX_ROUNDS = 10

SYSTEM_PROMPT = (
    "你是本体建模助手，操作「本体可视化编辑器」中的数据。"
    "根据用户的需求，调用提供的工具来完成操作（查看项目、添加类、建立关系、导入导出等）。"
    "规则：先调用 get_ontology 了解项目现状，再进行修改；"
    "工具调用失败时把错误信息如实告诉用户；完成后用中文简要总结执行了哪些操作。"
)


def get_setting(db: Session, user_id: str) -> AiSetting | None:
    return db.get(AiSetting, user_id)


def save_setting(db: Session, user_id: str, data: dict) -> AiSetting:
    setting = db.get(AiSetting, user_id)
    if setting is None:
        setting = AiSetting(user_id=user_id)
        db.add(setting)
    setting.provider = data.get("provider", "custom")
    setting.base_url = (data.get("base_url") or "").strip()
    # apiKey 留空表示保持不变（避免覆盖已有 Key）
    if data.get("api_key"):
        setting.api_key = data["api_key"].strip()
    setting.model = (data.get("model") or "").strip()
    setting.thinking = bool(data.get("thinking", False))
    db.commit()
    db.refresh(setting)
    return setting


async def mcp_tools_schema() -> list[dict]:
    """MCP 工具 -> OpenAI function calling 格式。"""
    tools = []
    for tool in await mcp_mod.mcp.list_tools():
        tools.append({
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description or "",
                "parameters": tool.parameters or {"type": "object", "properties": {}},
            },
        })
    return tools


async def call_mcp_tool(name: str, args: dict, user: User) -> str:
    """执行 MCP 工具（绑定用户权限）。返回结果字符串。"""
    tool = next((t for t in await mcp_mod.mcp.list_tools() if t.name == name), None)
    if tool is None:
        return json.dumps({"error": f"未知工具 {name}"}, ensure_ascii=False)
    # 临时绑定当前账号（工具通过 _current_user 识别权限）
    mcp_mod._stdio_user = user
    try:
        result = tool.fn(**args)
    except Exception as e:  # noqa: BLE001
        result = {"error": f"工具执行异常：{e}"}
    return json.dumps(result, ensure_ascii=False)


def _llm_chat(settings: AiSetting, messages: list[dict], tools: list[dict]) -> dict:
    url = settings.base_url.rstrip("/") + "/chat/completions"
    payload: dict = {
        "model": settings.model,
        "messages": messages,
        "tools": tools,
        "tool_choice": "auto",
        "temperature": 0.2,
    }
    if settings.thinking:
        # 深度思考：请求模型详细推理（OpenAI o 系列兼容字段，其他服务通常忽略）
        payload["reasoning_effort"] = "high"
    resp = httpx.post(
        url,
        headers={"Authorization": f"Bearer {settings.api_key}"},
        json=payload,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


async def chat(
    db: Session,
    user: User,
    history: list[dict],
    require_project: str | None = None,
) -> dict:
    """执行一轮 AI 对话（agent 循环）。history: [{role, content}]，role 为 user/assistant。"""
    settings = get_setting(db, user.id)
    if settings is None or not settings.base_url or not settings.api_key or not settings.model:
        return {
            "error": "尚未配置大模型，请先在首页点击右上角「AI 设置」完成配置",
            "operations": [],
        }

    system_prompt = SYSTEM_PROMPT
    if settings.thinking:
        system_prompt += (
            "\n请进行深度思考：先分析需求、规划步骤，再调用工具执行，"
            "最后给出详细的操作总结与后续建议。"
        )
    else:
        system_prompt += "\n请简洁高效地完成任务，直接执行操作并简要总结。"
    messages: list[dict] = [
        {"role": "system", "content": system_prompt},
    ]
    if require_project:
        messages.append({
            "role": "system",
            "content": f"当前编辑的项目 id 为 {require_project}。",
        })
    messages.extend(history)

    tools = await mcp_tools_schema()
    operations: list[dict] = []

    for _ in range(MAX_ROUNDS):
        try:
            resp = _llm_chat(settings, messages, tools)
        except httpx.HTTPStatusError as e:
            detail = ""
            try:
                detail = e.response.text[:300]
            except Exception:  # noqa: BLE001
                pass
            return {"error": f"大模型调用失败（HTTP {e.response.status_code}）：{detail}", "operations": operations}
        except httpx.HTTPError as e:
            return {"error": f"无法连接大模型：{e}", "operations": operations}

        choices = resp.get("choices") or []
        if not choices:
            return {"error": f"大模型返回异常：{str(resp)[:300]}", "operations": operations}
        msg = choices[0].get("message") or {}
        tool_calls = msg.get("tool_calls") or []

        if tool_calls:
            messages.append(msg)
            for tc in tool_calls:
                fn = tc.get("function") or {}
                name = fn.get("name", "")
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}
                result_text = await call_mcp_tool(name, args, user)
                operations.append({"tool": name, "args": args, "result": result_text})
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.get("id", ""),
                    "content": result_text,
                })
        else:
            messages.append(msg)
            break

    # 提取最终回复（最后一条 assistant 消息）
    reply = ""
    for m in reversed(messages):
        if m.get("role") == "assistant":
            reply = m.get("content") or ""
            break
    if not reply and operations:
        reply = f"已执行 {len(operations)} 个操作，请查看画布。"
    return {"reply": reply, "operations": operations}
