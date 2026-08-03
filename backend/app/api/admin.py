"""管理后台 API：用户管理与模板管理（仅管理员）。"""

import json
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..api.deps import current_user_or_none
from ..database import get_db
from ..models import Template, User
from ..schemas import TemplateAdminOut, UserAdminOut
from ..services import admin_service as svc
from ..services.owl_service import OwlParseError, parse_owl

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _require_admin(user: User | None) -> User:
    if user is None or not user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


# ---------------------------------------------------------------------------
# 用户管理
# ---------------------------------------------------------------------------

@router.get("/users", response_model=list[UserAdminOut])
def list_users(
    db: Session = Depends(get_db),
    actor: User | None = Depends(current_user_or_none),
):
    _require_admin(actor)
    return svc.list_users(db)


class ResetPasswordRequest(BaseModel):
    password: str = Field(min_length=6, max_length=128)


@router.put("/users/{user_id}/password")
def reset_password(
    user_id: str,
    body: ResetPasswordRequest,
    db: Session = Depends(get_db),
    actor: User | None = Depends(current_user_or_none),
):
    _require_admin(actor)
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    svc.reset_password(db, target, body.password)
    return {"status": "ok", "message": f"已重置用户「{target.username}」的密码"}


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    mode: str = "public",
    targetUserId: str | None = None,
    db: Session = Depends(get_db),
    actor: User | None = Depends(current_user_or_none),
):
    _require_admin(actor)
    if mode not in ("public", "transfer", "delete"):
        raise HTTPException(status_code=400, detail="mode 只能是 public / transfer / delete")
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    try:
        svc.delete_user(db, target, actor, mode=mode, target_user_id=targetUserId)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# 模板管理
# ---------------------------------------------------------------------------

@router.get("/templates", response_model=list[TemplateAdminOut])
def list_templates(
    db: Session = Depends(get_db),
    actor: User | None = Depends(current_user_or_none),
):
    _require_admin(actor)
    return svc.list_all_templates(db)


@router.post("/templates", response_model=TemplateAdminOut, status_code=201)
async def create_template(
    name: str = Form(...),
    domain: str = Form(""),
    description: str = Form(""),
    icon: str = Form("📦"),
    scope: str = Form("public"),
    assignedUserIds: str = Form("[]"),
    file: Optional[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
    actor: User | None = Depends(current_user_or_none),
):
    _require_admin(actor)
    if scope not in ("public", "assigned"):
        raise HTTPException(status_code=400, detail="scope 只能是 public 或 assigned")
    try:
        assigned = json.loads(assignedUserIds)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="assignedUserIds 必须是 JSON 数组")

    data = await _parse_template_file(file) if file else {"ontology": None, "layout": None}
    template = svc.create_template(
        db,
        name=name.strip(),
        domain=domain.strip(),
        description=description.strip(),
        icon=icon.strip() or "📦",
        scope=scope,
        data=data,
        assigned_user_ids=[str(u) for u in assigned],
        created_by=actor.id,
    )
    return svc.get_template_detail(db, template.id)


@router.put("/templates/{template_id}", response_model=TemplateAdminOut)
async def update_template(
    template_id: str,
    name: str = Form(...),
    domain: str = Form(""),
    description: str = Form(""),
    icon: str = Form("📦"),
    scope: str = Form("public"),
    assignedUserIds: str = Form("[]"),
    file: Optional[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
    actor: User | None = Depends(current_user_or_none),
):
    _require_admin(actor)
    template = db.get(Template, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="模板不存在")
    if scope not in ("public", "assigned"):
        raise HTTPException(status_code=400, detail="scope 只能是 public 或 assigned")
    try:
        assigned = json.loads(assignedUserIds)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="assignedUserIds 必须是 JSON 数组")

    patch: dict = {
        "name": name.strip(),
        "domain": domain.strip(),
        "description": description.strip(),
        "icon": icon.strip() or "📦",
        "scope": scope,
        "assigned_user_ids": [str(u) for u in assigned],
    }
    if file is not None:
        patch["data"] = await _parse_template_file(file)
    svc.update_template(db, template, patch)
    return svc.get_template_detail(db, template.id)


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    actor: User | None = Depends(current_user_or_none),
):
    _require_admin(actor)
    template = db.get(Template, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="模板不存在")
    svc.delete_template(db, template)


async def _parse_template_file(file: UploadFile) -> dict:
    """解析上传的 .owl / .json 文件为模板内容。"""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="文件为空")
    filename = (file.filename or "").lower()
    if filename.endswith(".owl") or filename.endswith(".xml") or filename.endswith(".rdf"):
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text = content.decode("gb18030")
            except UnicodeDecodeError as e:
                raise HTTPException(status_code=400, detail="文件编码无法识别，请转换为 UTF-8") from e
        try:
            ontology, _ = parse_owl(text)
        except OwlParseError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        return {"ontology": ontology, "layout": None}
    if filename.endswith(".json"):
        try:
            backup = json.loads(content.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            raise HTTPException(status_code=400, detail="JSON 文件解析失败") from e
        ontology = backup.get("ontology", backup)
        layout = backup.get("layout") or None
        return {"ontology": ontology, "layout": layout}
    raise HTTPException(status_code=400, detail="仅支持 .owl / .xml / .rdf / .json 文件")
