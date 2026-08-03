"""认证 API：注册 / 登录 / 登出 / 当前用户。"""

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..api.deps import current_user_or_none
from ..database import get_db
from ..models import User
from ..services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


def _auth_response(user: User, token: str) -> dict:
    return {"token": token, "user": {"id": user.id, "username": user.username, "isAdmin": user.is_admin}}


@router.post("/register")
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    username = body.username.strip()
    if len(username) < 2:
        raise HTTPException(status_code=400, detail="用户名至少 2 个字符")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 个字符")
    exists = db.query(User).filter(User.username == username).first()
    if exists:
        raise HTTPException(status_code=409, detail="用户名已存在")
    user, token = auth_service.create_user(db, username, body.password)
    return _auth_response(user, token)


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    result = auth_service.login_user(db, body.username.strip(), body.password)
    if result is None:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    user, token = result
    return _auth_response(user, token)


@router.post("/logout")
def logout(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    if authorization and authorization.lower().startswith("bearer "):
        auth_service.logout_token(db, authorization.split(" ", 1)[1].strip())
    return {"status": "ok"}


@router.get("/me")
def me(user: User | None = Depends(current_user_or_none)):
    if user is None:
        raise HTTPException(status_code=401, detail="未登录")
    return {"id": user.id, "username": user.username, "isAdmin": user.is_admin}
