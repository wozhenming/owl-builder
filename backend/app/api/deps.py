"""共享依赖：当前用户解析（未认证时返回 None，即匿名模式）。"""

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..services import auth_service


def current_user_or_none(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    """从 Authorization: Bearer <token> 解析当前用户；无有效令牌返回 None（匿名）。"""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    return auth_service.get_user_by_token(db, token)
