"""MCP（Model Context Protocol）服务：把本体的编辑功能暴露给 AI 助手。

令牌与账号：
- MCP 令牌由管理员在管理后台为用户生成（每用户一个有效令牌），绑定用户账号
- HTTP 模式：请求头 Authorization: Bearer <token>，按令牌识别账号
- stdio 模式：启动参数 --token <token>，进程绑定该账号
- 工具只可操作令牌对应账号可见的数据（公共数据 + 自己的项目）

运行方式：
1. stdio（Claude Desktop / Cursor 等桌面客户端）：
       .venv/Scripts/python -m app.mcp_server --token <令牌>
2. HTTP（streamable HTTP，挂载于 FastAPI /mcp 端点，无需单独启动）

配置示例（Claude Desktop claude_desktop_config.json）：
{
  "mcpServers": {
    "cost-ontology": {
      "command": "D:/GKTL/owl-builder/backend/.venv/Scripts/python.exe",
      "args": ["-m", "app.mcp_server", "--token", "粘贴管理后台生成的令牌"],
      "cwd": "D:/GKTL/owl-builder/backend"
    }
  }
}
"""

import json

from fastmcp import FastMCP

from .database import SessionLocal
from .models import Project, Template, User
from .services import admin_service
from .services import ontology_service as svc
from .services.owl_service import generate_owl, parse_owl

mcp = FastMCP("cost-ontology-editor", instructions=(
    "本体可视化编辑器（OWL 本体）的编辑工具。"
    "数据模型：类（class）与数据类型（datatype）是节点；"
    "子类关系（subclass）/ 对象属性（objectProperty）/ 数据属性（dataProperty）/ 注解属性（annotationProperty）是边。"
    "所有 id 由工具返回，后续操作直接引用。"
    "权限：只能操作令牌绑定账号可见的数据（公共数据 + 自己的项目）。"
))

# stdio 模式绑定的账号（--token 启动时设置）
_stdio_user: User | None = None


def _current_user() -> User | None:
    """解析当前 MCP 调用对应的账号：HTTP 从请求头取令牌，stdio 用启动绑定。"""
    global _stdio_user
    try:
        from fastmcp.server.dependencies import get_http_request

        request = get_http_request()
        if request is not None:
            from .mcp_auth import resolve_user_by_request

            return resolve_user_by_request(request)
    except Exception:
        pass  # 非 HTTP 请求（stdio）或上下文不可用
    return _stdio_user


def _ensure_user() -> tuple[User | None, dict | None]:
    """返回 (用户, 错误响应)。用户缺失时返回错误。"""
    user = _current_user()
    if user is None:
        return None, {"error": "无效或已废除的 MCP 令牌，请联系管理员重新生成"}
    return user, None


def _can_access(project: Project, user: User) -> bool:
    """公共项目（无归属）或自己的项目可操作。"""
    return project.user_id is None or project.user_id == user.id


def _project_out(p: Project) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "folderId": p.folder_id,
        "createdAt": p.created_at.isoformat() if p.created_at else None,
        "updatedAt": p.updated_at.isoformat() if p.updated_at else None,
    }


# ---------------------------------------------------------------------------
# 项目管理
# ---------------------------------------------------------------------------

@mcp.tool(description="列出当前账号可见的项目（公共 + 自己的）")
def list_projects() -> list[dict]:
    user, err = _ensure_user()
    if err:
        return [err]
    with SessionLocal() as db:
        return [_project_out(p) for p in svc.list_projects(db, user)]


@mcp.tool(description="创建项目（归当前账号所有），返回项目 id。可指定名称、描述、本体命名空间 IRI")
def create_project(name: str, description: str = "", ontology_iri: str = "http://example.org/cost-ontology#") -> dict:
    user, err = _ensure_user()
    if err:
        return err
    with SessionLocal() as db:
        p = svc.create_project(db, name=name, description=description, ontology_iri=ontology_iri, user=user)
        return _project_out(p)


@mcp.tool(description="删除自己的项目（含全部本体数据）")
def delete_project(project_id: str) -> str:
    user, err = _ensure_user()
    if err:
        return err["error"]
    with SessionLocal() as db:
        p = svc.get_project(db, project_id)
        if p is None:
            return f"项目 {project_id} 不存在"
        if not _can_access(p, user):
            return f"无权操作项目 {project_id}（他人的私有项目）"
        svc.delete_project(db, p)
        return f"已删除项目 {project_id}"


# ---------------------------------------------------------------------------
# 本体数据
# ---------------------------------------------------------------------------

@mcp.tool(description="查看项目本体结构：全部类/数据类型节点与关系边")
def get_ontology(project_id: str) -> dict:
    user, err = _ensure_user()
    if err:
        return err
    with SessionLocal() as db:
        p = svc.get_project(db, project_id)
        if p is None:
            return {"error": f"项目 {project_id} 不存在"}
        if not _can_access(p, user):
            return {"error": f"无权查看项目 {project_id}（他人的私有项目）"}
        return svc.get_ontology(db, project_id)


@mcp.tool(description="添加类。name 为 IRI 本地名（唯一），可选中文显示名、注释、父类 id（自动建立子类关系）")
def add_class(
    project_id: str,
    name: str,
    label: str = "",
    comment: str = "",
    parent_class_id: str = "",
) -> dict:
    user, err = _ensure_user()
    if err:
        return err
    with SessionLocal() as db:
        project = svc.get_project(db, project_id)
        if project is None:
            return {"error": f"项目 {project_id} 不存在"}
        if not _can_access(project, user):
            return {"error": f"无权修改项目 {project_id}（他人的私有项目）"}
        model = svc.get_ontology(db, project_id)
        if any(n.get("name") == name for n in model.get("nodes", [])):
            return {"error": f"已存在同名实体 {name}"}
        from .utils.helpers import build_iri

        new_id = f"cls_{name}"
        model.setdefault("nodes", []).append({
            "id": new_id,
            "kind": "class",
            "name": name,
            "iri": build_iri(project.ontology_iri, name),
            "label": label or None,
            "comment": comment or None,
            "createdAt": 0,
        })
        if parent_class_id:
            model.setdefault("edges", []).append({
                "id": f"sub_{name}",
                "kind": "subclass",
                "source": new_id,
                "target": parent_class_id,
                "createdAt": 0,
            })
        svc.save_ontology(db, project, model)
        return {"id": new_id, "parentClassId": parent_class_id or None}


@mcp.tool(description="更新类（名称/中文显示名/注释）")
def update_class(project_id: str, class_id: str, name: str = "", label: str = "", comment: str = "") -> dict:
    user, err = _ensure_user()
    if err:
        return err
    with SessionLocal() as db:
        project = svc.get_project(db, project_id)
        if project is None:
            return {"error": f"项目 {project_id} 不存在"}
        if not _can_access(project, user):
            return {"error": f"无权修改项目 {project_id}（他人的私有项目）"}
        model = svc.get_ontology(db, project_id)
        node = next((n for n in model.get("nodes", []) if n.get("id") == class_id), None)
        if node is None:
            return {"error": f"类 {class_id} 不存在"}
        if name:
            node["name"] = name
        node["label"] = label or None
        node["comment"] = comment or None
        svc.save_ontology(db, project, model)
        return {"id": class_id, "updated": True}


@mcp.tool(description="删除类（其全部关联关系一并删除）")
def delete_class(project_id: str, class_id: str) -> str:
    user, err = _ensure_user()
    if err:
        return err["error"]
    with SessionLocal() as db:
        project = svc.get_project(db, project_id)
        if project is None:
            return f"项目 {project_id} 不存在"
        if not _can_access(project, user):
            return f"无权修改项目 {project_id}（他人的私有项目）"
        model = svc.get_ontology(db, project_id)
        model["nodes"] = [n for n in model.get("nodes", []) if n.get("id") != class_id]
        model["edges"] = [e for e in model.get("edges", []) if e.get("source") != class_id and e.get("target") != class_id]
        svc.save_ontology(db, project, model)
        return f"已删除类 {class_id}"


@mcp.tool(description="添加关系边。kind: subclass（子类关系）/ objectProperty（对象属性）/ dataProperty（数据属性，target 应为数据类型 id）/ annotationProperty（注解属性）。property 类关系需 name（属性名）")
def add_relation(
    project_id: str,
    kind: str,
    source_id: str,
    target_id: str,
    name: str = "",
    label: str = "",
    comment: str = "",
    functional: bool = False,
) -> dict:
    user, err = _ensure_user()
    if err:
        return err
    if kind not in ("subclass", "objectProperty", "dataProperty", "annotationProperty"):
        return {"error": "kind 只能是 subclass / objectProperty / dataProperty / annotationProperty"}
    with SessionLocal() as db:
        project = svc.get_project(db, project_id)
        if project is None:
            return {"error": f"项目 {project_id} 不存在"}
        if not _can_access(project, user):
            return {"error": f"无权修改项目 {project_id}（他人的私有项目）"}
        model = svc.get_ontology(db, project_id)
        ids = {n.get("id") for n in model.get("nodes", [])}
        if source_id not in ids or target_id not in ids:
            return {"error": "source 或 target 节点不存在"}
        if any(e.get("kind") == kind and e.get("source") == source_id and e.get("target") == target_id
               for e in model.get("edges", [])):
            return {"error": "同一起点与终点间已存在同类关系"}
        from .utils.helpers import build_iri

        edge_id = f"rel_{name or kind}_{source_id[-4:]}_{target_id[-4:]}"
        edge = {
            "id": edge_id,
            "kind": kind,
            "source": source_id,
            "target": target_id,
            "createdAt": 0,
        }
        if kind != "subclass":
            edge.update({
                "name": name,
                "iri": build_iri(project.ontology_iri, name or f"属性{len(model.get('edges', []))}"),
                "label": label or None,
                "comment": comment or None,
                "functional": functional,
            })
        model.setdefault("edges", []).append(edge)
        svc.save_ontology(db, project, model)
        return {"id": edge_id, "kind": kind}


@mcp.tool(description="删除关系边")
def delete_relation(project_id: str, relation_id: str) -> str:
    user, err = _ensure_user()
    if err:
        return err["error"]
    with SessionLocal() as db:
        project = svc.get_project(db, project_id)
        if project is None:
            return f"项目 {project_id} 不存在"
        if not _can_access(project, user):
            return f"无权修改项目 {project_id}（他人的私有项目）"
        model = svc.get_ontology(db, project_id)
        model["edges"] = [e for e in model.get("edges", []) if e.get("id") != relation_id]
        svc.save_ontology(db, project, model)
        return f"已删除关系 {relation_id}"


@mcp.tool(description="添加标准数据类型节点（如 string、integer、decimal、date），作为数据属性的值域")
def add_datatype(project_id: str, xsd_name: str) -> dict:
    user, err = _ensure_user()
    if err:
        return err
    XSD = {
        "string": "http://www.w3.org/2001/XMLSchema#string",
        "integer": "http://www.w3.org/2001/XMLSchema#integer",
        "decimal": "http://www.w3.org/2001/XMLSchema#decimal",
        "double": "http://www.w3.org/2001/XMLSchema#double",
        "float": "http://www.w3.org/2001/XMLSchema#float",
        "boolean": "http://www.w3.org/2001/XMLSchema#boolean",
        "date": "http://www.w3.org/2001/XMLSchema#date",
        "dateTime": "http://www.w3.org/2001/XMLSchema#dateTime",
    }
    if xsd_name not in XSD:
        return {"error": f"不支持的 XSD 类型 {xsd_name}，可选：{', '.join(XSD)}"}
    with SessionLocal() as db:
        project = svc.get_project(db, project_id)
        if project is None:
            return {"error": f"项目 {project_id} 不存在"}
        if not _can_access(project, user):
            return {"error": f"无权修改项目 {project_id}（他人的私有项目）"}
        model = svc.get_ontology(db, project_id)
        for n in model.get("nodes", []):
            if n.get("kind") == "datatype" and n.get("name") == xsd_name:
                return {"id": n["id"], "note": "已存在"}
        new_id = f"dty_{xsd_name}"
        model.setdefault("nodes", []).append({
            "id": new_id,
            "kind": "datatype",
            "name": xsd_name,
            "iri": XSD[xsd_name],
            "createdAt": 0,
        })
        svc.save_ontology(db, project, model)
        return {"id": new_id}


@mcp.tool(description="移动节点在画布上的位置（布局）。x、y 为画布坐标；返回移动后的位置")
def move_node(project_id: str, node_id: str, x: float, y: float) -> dict:
    user, err = _ensure_user()
    if err:
        return err
    with SessionLocal() as db:
        project = svc.get_project(db, project_id)
        if project is None:
            return {"error": f"项目 {project_id} 不存在"}
        if not _can_access(project, user):
            return {"error": f"无权修改项目 {project_id}（他人的私有项目）"}
        model = svc.get_ontology(db, project_id)
        if not any(n.get("id") == node_id for n in model.get("nodes", [])):
            return {"error": f"节点 {node_id} 不存在"}
        layout = model.get("layout") or {}
        layout[str(node_id)] = {"x": float(x), "y": float(y)}
        model["layout"] = layout
        svc.save_ontology(db, project, model)
        return {"nodeId": node_id, "x": float(x), "y": float(y)}


# ---------------------------------------------------------------------------
# 模板
# ---------------------------------------------------------------------------

@mcp.tool(description="列出当前账号可见的模板（管理员下发的 + 公共的）")
def list_templates() -> list[dict]:
    user, err = _ensure_user()
    if err:
        return [err]
    with SessionLocal() as db:
        return admin_service.list_visible_templates(db, user)


@mcp.tool(description="使用模板创建项目（模板 id 来自 list_templates），项目归当前账号所有")
def create_project_from_template(template_id: str, name: str = "") -> dict:
    user, err = _ensure_user()
    if err:
        return err
    with SessionLocal() as db:
        tpl = db.get(Template, template_id)
        if tpl is None:
            return {"error": f"模板 {template_id} 不存在"}
        try:
            data = json.loads(tpl.data)
        except json.JSONDecodeError:
            return {"error": "模板内容损坏"}
        ontology = data.get("ontology") or {}
        layout = data.get("layout")
        p = svc.create_project(
            db,
            name=name or tpl.name,
            description=tpl.description,
            ontology_iri=ontology.get("ontologyIri", "http://example.org/tpl#"),
            ontology=ontology,
            user=user,
        )
        if layout:
            svc.save_ontology(db, p, {**ontology, "projectId": p.id, "layout": layout})
        return _project_out(p)


# ---------------------------------------------------------------------------
# OWL 导入导出
# ---------------------------------------------------------------------------

@mcp.tool(description="导出项目为标准 OWL RDF/XML 文本（私有项目仅归属者可导出）。filename 为建议的文件名（含 .owl 后缀），供下载时使用")
def export_owl(project_id: str, filename: str = "导出本体.owl") -> str:
    user, err = _ensure_user()
    if err:
        return err["error"]
    with SessionLocal() as db:
        project = svc.get_project(db, project_id)
        if project is None:
            return f"项目 {project_id} 不存在"
        if not _can_access(project, user):
            return f"无权导出项目 {project_id}（他人的私有项目）"
        return generate_owl(svc.get_ontology(db, project_id))


@mcp.tool(description="导入 OWL RDF/XML 文本，创建为新项目（归当前账号所有），返回项目 id")
def import_owl(xml_text: str, name: str = "导入的本体") -> dict:
    user, err = _ensure_user()
    if err:
        return err
    try:
        model, skipped = parse_owl(xml_text, name)
    except ValueError as e:
        return {"error": str(e)}
    with SessionLocal() as db:
        p = svc.create_project(
            db,
            name=model.get("name", name),
            description=model.get("description", ""),
            ontology_iri=model.get("ontologyIri", "http://example.org/cost-ontology#"),
            version=model.get("version", "1.0.0"),
            ontology=model,
            user=user,
        )
        return {
            **_project_out(p),
            "skipped": len(skipped),
            "nodeCount": len(model.get("nodes", [])),
            "edgeCount": len(model.get("edges", [])),
        }


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    from .services.mcp_token_service import resolve_user_by_token

    # 令牌校验：stdio 必须提供 --token（由管理后台生成）
    token = None
    if "--token" in sys.argv:
        idx = sys.argv.index("--token")
        token = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else ""
    if not token:
        print("错误：请使用 --token <令牌> 提供 MCP 令牌（管理员在管理后台生成）", file=sys.stderr)
        sys.exit(1)
    with SessionLocal() as db:
        _stdio_user = resolve_user_by_token(db, token)
    if _stdio_user is None:
        print("错误：MCP 令牌无效或已废除", file=sys.stderr)
        sys.exit(1)
    print(f"[mcp] 已绑定账号：{_stdio_user.username}", file=sys.stderr)

    mcp.run(transport="stdio")
