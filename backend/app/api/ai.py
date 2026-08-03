"""AI 助手 API：大模型配置（首页）与对话（编辑页，需登录）。"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..api.deps import current_user_or_none
from ..database import get_db
from ..models import User
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
    messages: List[ChatMessage] = Field(default_factory=list, max_length=50)


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
    return await ai_service.chat(db, user, history, require_project=body.projectId)
