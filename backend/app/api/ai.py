"""AI 助手 API：大模型配置（首页）、对话与会话（编辑页，需登录）。"""

import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..api.deps import current_user_or_none
from ..database import get_db
from ..models import AiChatSession, User
from ..services import ai_service
from ..services import ontology_service as svc

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _require_login(user: User | None) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    return user


# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

class AiSettingsIn(BaseModel):
    provider: str = Field(default="custom", max_length=50)
    base_url: str = Field(default="", max_length=300, validation_alias="baseUrl")
    api_key: str = Field(default="", max_length=2000, validation_alias="apiKey")
    model: str = Field(default="", max_length=100)
    thinking: bool = Field(default=False)


@router.get("/settings")
def get_settings(user: User | None = Depends(current_user_or_none), db: Session = Depends(get_db)):
    _require_login(user)
    setting = ai_service.get_setting(db, user.id)
    if setting is None:
        return {"configured": False}
    return {
        "configured": True,
        "provider": setting.provider,
        "baseUrl": setting.base_url,
        "model": setting.model,
        "thinking": setting.thinking,
        # apiKey 不回传明文，仅标记是否已设置
        "hasApiKey": bool(setting.api_key),
    }


@router.put("/settings")
def save_settings(
    body: AiSettingsIn,
    user: User | None = Depends(current_user_or_none),
    db: Session = Depends(get_db),
):
    _require_login(user)
    ai_service.save_setting(db, user.id, body.model_dump())
    return {"configured": True, "message": "大模型配置已保存"}


# ---------------------------------------------------------------------------
# 对话
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    projectId: str = Field(min_length=1)
    sessionId: str = Field(default="")
    messages: List[ChatMessage] = Field(default_factory=list, max_length=50)


def _session_or_404(db: Session, session_id: str, user: User) -> AiChatSession:
    session = db.get(AiChatSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="会话不存在")
    return session


# ---------------------------------------------------------------------------
# 对话会话
# ---------------------------------------------------------------------------

class SessionCreate(BaseModel):
    projectId: str = Field(min_length=1)


@router.get("/sessions")
def list_sessions(
    projectId: str = "",
    user: User | None = Depends(current_user_or_none),
    db: Session = Depends(get_db),
):
    _require_login(user)
    query = db.query(AiChatSession).filter(AiChatSession.user_id == user.id)
    if projectId:
        query = query.filter(AiChatSession.project_id == projectId)
    rows = query.order_by(AiChatSession.updated_at.desc()).limit(50).all()
    return [
        {
            "id": s.id,
            "projectId": s.project_id,
            "title": s.title,
            "messageCount": len(json.loads(s.messages or "[]")),
            "createdAt": s.created_at,
            "updatedAt": s.updated_at,
        }
        for s in rows
    ]


@router.post("/sessions", status_code=201)
def create_session(
    body: SessionCreate,
    user: User | None = Depends(current_user_or_none),
    db: Session = Depends(get_db),
):
    _require_login(user)
    session = AiChatSession(user_id=user.id, project_id=body.projectId, title="新对话")
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "projectId": session.project_id, "title": session.title, "messages": []}


@router.get("/sessions/{session_id}")
def get_session(
    session_id: str,
    user: User | None = Depends(current_user_or_none),
    db: Session = Depends(get_db),
):
    _require_login(user)
    session = _session_or_404(db, session_id, user)
    try:
        messages = json.loads(session.messages or "[]")
    except json.JSONDecodeError:
        messages = []
    return {"id": session.id, "title": session.title, "messages": messages}


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: str,
    user: User | None = Depends(current_user_or_none),
    db: Session = Depends(get_db),
):
    _require_login(user)
    session = _session_or_404(db, session_id, user)
    db.delete(session)
    db.commit()


# ---------------------------------------------------------------------------
# 对话
# ---------------------------------------------------------------------------

@router.post("/chat")
async def chat(
    body: ChatRequest,
    user: User | None = Depends(current_user_or_none),
    db: Session = Depends(get_db),
):
    _require_login(user)
    # 校验项目可访问（公共或自己的）
    project = svc.get_project(db, body.projectId)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    if project.user_id is not None and project.user_id != user.id:
        raise HTTPException(status_code=403, detail="无权访问该项目的 AI 助手")

    history = [{"role": m.role, "content": m.content} for m in body.messages]
    result = await ai_service.chat(db, user, history, require_project=body.projectId)

    # 保存会话消息（若指定 sessionId）
    if body.sessionId:
        session = _session_or_404(db, body.sessionId, user)
        if body.messages:
            stored: list[dict] = []
            try:
                stored = json.loads(session.messages or "[]")
            except json.JSONDecodeError:
                stored = []
            last = body.messages[-1]
            if last.role == "user" and not result.get("error"):
                stored.append({"role": "user", "content": last.content})
                if result.get("reply"):
                    stored.append({"role": "assistant", "content": result["reply"]})
            session.messages = json.dumps(stored, ensure_ascii=False)
            if session.title == "新对话" and stored:
                session.title = stored[0]["content"][:30]
            db.commit()

    return result
