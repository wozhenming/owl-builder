"""管理服务：用户管理与模板管理（仅管理员可调用）。"""

import json
from typing import Any, Dict, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Folder, Project, Template, TemplateAssignment, User


# ---------------------------------------------------------------------------
# 用户管理
# ---------------------------------------------------------------------------

def list_users(db: Session) -> list[dict]:
    rows = (
        db.query(User, func.count(Project.id).label("project_count"))
        .outerjoin(Project, Project.user_id == User.id)
        .group_by(User.id)
        .order_by(User.created_at.asc())
        .all()
    )
    return [
        {
            "id": u.id,
            "username": u.username,
            "isAdmin": u.is_admin,
            "createdAt": u.created_at,
            "projectCount": count,
        }
        for u, count in rows
    ]


def delete_user(
    db: Session,
    target: User,
    actor: User,
    mode: str = "public",
    target_user_id: str | None = None,
) -> None:
    """删除用户。项目处理方式：
    - public：项目/文件夹转为公共（user_id 置空）
    - transfer：项目/文件夹转给指定用户
    - delete：级联删除项目与文件夹
    """
    if target.id == actor.id:
        raise ValueError("不能删除当前登录的账号")
    if target.is_admin:
        admin_count = db.query(User).filter(User.is_admin.is_(True)).count()
        if admin_count <= 1:
            raise ValueError("至少需要保留一名管理员")

    if mode == "transfer":
        if not target_user_id:
            raise ValueError("请选择接收项目的用户")
        if db.get(User, target_user_id) is None:
            raise ValueError("接收用户不存在")
        db.query(Project).filter(Project.user_id == target.id).update({"user_id": target_user_id})
        db.query(Folder).filter(Folder.user_id == target.id).update({"user_id": target_user_id})
    elif mode == "delete":
        # 级联删除项目（含本体文档）与文件夹
        project_ids = [p.id for p in db.query(Project).filter(Project.user_id == target.id).all()]
        from ..models import OntologyDocument

        if project_ids:
            db.query(OntologyDocument).filter(OntologyDocument.project_id.in_(project_ids)).delete(
                synchronize_session=False
            )
        db.query(Project).filter(Project.user_id == target.id).delete(synchronize_session=False)
        db.query(Folder).filter(Folder.user_id == target.id).delete(synchronize_session=False)
    else:  # public（默认）
        db.query(Project).filter(Project.user_id == target.id).update({"user_id": None})
        db.query(Folder).filter(Folder.user_id == target.id).update({"user_id": None})

    # 清除其模板下发记录
    db.query(TemplateAssignment).filter(TemplateAssignment.user_id == target.id).delete()
    db.delete(target)
    db.commit()


def reset_password(db: Session, target: User, new_password: str) -> None:
    from .auth_service import hash_password

    target.password_hash = hash_password(new_password)
    # 重置密码后使该用户全部令牌失效
    from ..models import AuthToken

    db.query(AuthToken).filter(AuthToken.user_id == target.id).delete()
    db.commit()


# ---------------------------------------------------------------------------
# 模板管理
# ---------------------------------------------------------------------------

def list_all_templates(db: Session) -> list[dict]:
    templates = db.query(Template).order_by(Template.created_at.desc()).all()
    # 管理列表直接返回完整内容（含 data），编辑时无需二次请求
    return [_template_out(db, t, with_data=True) for t in templates]


def _template_out(db: Session, t: Template, with_data: bool) -> dict:
    assigned = [
        a.user_id
        for a in db.query(TemplateAssignment).filter(TemplateAssignment.template_id == t.id).all()
    ]
    out: Dict[str, Any] = {
        "id": t.id,
        "name": t.name,
        "domain": t.domain,
        "description": t.description,
        "icon": t.icon,
        "scope": t.scope,
        "assignedUserIds": assigned,
        "createdAt": t.created_at,
    }
    if with_data:
        try:
            out["data"] = json.loads(t.data)
        except json.JSONDecodeError:
            out["data"] = {}
    return out


def create_template(
    db: Session,
    *,
    name: str,
    domain: str,
    description: str,
    icon: str,
    scope: str,
    data: Dict[str, Any],
    assigned_user_ids: list[str],
    created_by: str,
) -> Template:
    template = Template(
        name=name,
        domain=domain,
        description=description,
        icon=icon,
        scope=scope,
        data=json.dumps(data, ensure_ascii=False),
        created_by=created_by,
    )
    db.add(template)
    db.flush()
    _set_assignments(db, template.id, assigned_user_ids if scope == "assigned" else [])
    db.commit()
    db.refresh(template)
    return template


def update_template(
    db: Session,
    template: Template,
    patch: Dict[str, Any],
) -> Template:
    if "name" in patch:
        template.name = patch["name"]
    if "domain" in patch:
        template.domain = patch["domain"]
    if "description" in patch:
        template.description = patch["description"]
    if "icon" in patch:
        template.icon = patch["icon"]
    if "scope" in patch:
        template.scope = patch["scope"]
    if "data" in patch:
        template.data = json.dumps(patch["data"], ensure_ascii=False)
    if "assigned_user_ids" in patch or "scope" in patch:
        _set_assignments(db, template.id, patch.get("assigned_user_ids") or ([] if template.scope == "assigned" else []))
    db.commit()
    db.refresh(template)
    return template


def delete_template(db: Session, template: Template) -> None:
    db.query(TemplateAssignment).filter(TemplateAssignment.template_id == template.id).delete()
    db.delete(template)
    db.commit()


def _set_assignments(db: Session, template_id: str, user_ids: list[str]) -> None:
    db.query(TemplateAssignment).filter(TemplateAssignment.template_id == template_id).delete()
    for uid in dict.fromkeys(user_ids):  # 去重
        if uid:
            db.add(TemplateAssignment(template_id=template_id, user_id=uid))


def get_template_detail(db: Session, template_id: str) -> Optional[dict]:
    template = db.get(Template, template_id)
    if template is None:
        return None
    return _template_out(db, template, with_data=True)


# ---------------------------------------------------------------------------
# 普通用户：可见模板
# ---------------------------------------------------------------------------

def list_visible_templates(db: Session, user: Optional[User]) -> list[dict]:
    """匿名/普通用户可见的模板：public 全部可见；assigned 仅下发的用户可见。"""
    query = db.query(Template).filter(Template.scope == "public")
    if user is not None:
        assigned_ids = [
            a.template_id
            for a in db.query(TemplateAssignment).filter(TemplateAssignment.user_id == user.id).all()
        ]
        if assigned_ids:
            query = query.union(db.query(Template).filter(Template.id.in_(assigned_ids)))
    return [_template_out(db, t, with_data=True) for t in query.order_by(Template.created_at.desc()).all()]
