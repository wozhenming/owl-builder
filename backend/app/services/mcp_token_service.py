"""MCP 令牌服务：管理员生成/废除，令牌 -> 用户解析。"""

import secrets
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models import McpToken, User


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def list_mcp_tokens(db: Session) -> list[dict]:
    rows = (
        db.query(McpToken, User.username)
        .join(User, User.id == McpToken.user_id)
        .order_by(McpToken.created_at.desc())
        .all()
    )
    return [
        {
            "id": t.id,
            "token": t.token,
            "userId": t.user_id,
            "username": username,
            "revoked": t.revoked_at is not None,
            "createdAt": t.created_at,
        }
        for t, username in rows
    ]


def create_mcp_token(db: Session, user_id: str) -> str:
    """为用户生成新令牌；自动废除该用户旧的未废除令牌（每用户仅一个有效令牌）。"""
    db.query(McpToken).filter(
        McpToken.user_id == user_id, McpToken.revoked_at.is_(None)
    ).update({"revoked_at": _now()})
    token = secrets.token_urlsafe(32)
    record = McpToken(token=token, user_id=user_id)
    db.add(record)
    db.commit()
    return token


def revoke_mcp_token(db: Session, token_id: str) -> bool:
    record = db.get(McpToken, token_id)
    if record is None:
        return False
    record.revoked_at = _now()
    db.commit()
    return True


def resolve_user_by_token(db: Session, token: str) -> User | None:
    """按令牌解析用户：令牌必须存在且未废除。"""
    if not token:
        return None
    record = db.query(McpToken).filter(
        McpToken.token == token, McpToken.revoked_at.is_(None)
    ).first()
    if record is None:
        return None
    return db.get(User, record.user_id)
