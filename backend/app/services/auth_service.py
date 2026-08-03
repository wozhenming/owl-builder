"""认证服务：密码哈希、令牌、用户操作（纯标准库，无第三方依赖）。"""

import hashlib
import hmac
import secrets

from sqlalchemy.orm import Session

from ..models import AuthToken, User

PBKDF2_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    """pbkdf2_hmac(SHA-256) 加盐哈希，格式：pbkdf2$<salt_hex>$<hash_hex>"""
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, salt_hex, hash_hex = stored.split("$")
        if algo != "pbkdf2":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), PBKDF2_ITERATIONS)
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, TypeError):
        return False


def generate_token() -> str:
    return secrets.token_hex(32)


def get_user_by_token(db: Session, token: str) -> User | None:
    if not token:
        return None
    row = db.get(AuthToken, token)
    if row is None:
        return None
    return db.get(User, row.user_id)


def create_user(db: Session, username: str, password: str) -> tuple[User, str]:
    """创建用户并签发令牌。第一个用户接管历史无主数据（匿名模式创建的）。"""
    user = User(username=username, password_hash=hash_password(password))
    is_first = db.query(User).count() == 0
    if is_first:
        user.is_admin = True
    db.add(user)
    db.flush()

    if is_first:
        # 历史数据（匿名模式创建的）归第一个注册用户
        from ..models import Folder, Project

        db.query(Project).filter(Project.user_id.is_(None)).update({"user_id": user.id})
        db.query(Folder).filter(Folder.user_id.is_(None)).update({"user_id": user.id})

    token = AuthToken(token=generate_token(), user_id=user.id)
    db.add(token)
    db.commit()
    db.refresh(user)
    return user, token.token


def login_user(db: Session, username: str, password: str) -> tuple[User, str] | None:
    user = db.query(User).filter(User.username == username).first()
    if user is None or not verify_password(password, user.password_hash):
        return None
    token = AuthToken(token=generate_token(), user_id=user.id)
    db.add(token)
    db.commit()
    return user, token.token


def logout_token(db: Session, token: str) -> None:
    row = db.get(AuthToken, token)
    if row is not None:
        db.delete(row)
        db.commit()
