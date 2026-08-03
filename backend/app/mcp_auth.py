"""MCP 令牌认证：令牌由管理员在管理后台为用户生成，绑定用户账号。

- HTTP 请求头 Authorization: Bearer <token> -> 解析令牌 -> 用户
- stdio 启动参数 --token <token> -> 启动时绑定用户
- 每用户仅一个有效令牌；令牌被废除后立即失效（401）
"""

from fastapi import Request
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import User
from .services.mcp_token_service import resolve_user_by_token


def bearer_token_from(authorization: str | None) -> str | None:
    if not authorization:
        return None
    if authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return authorization.strip() or None


def resolve_user_by_request(request: Request) -> User | None:
    """从 HTTP 请求解析 MCP 令牌对应的用户（无有效令牌返回 None）。"""
    token = bearer_token_from(request.headers.get("authorization"))
    if not token:
        return None
    with SessionLocal() as db:
        return resolve_user_by_token(db, token)


def verify_mcp_token(authorization: str | None, provided: str | None = None) -> bool:
    """令牌是否有效（HTTP 中间件用）。"""
    token = provided or bearer_token_from(authorization)
    if not token:
        return False
    with SessionLocal() as db:
        return resolve_user_by_token(db, token) is not None
