"""MCP 访问令牌：管理员为用户生成，每个用户仅一个有效令牌。

令牌绑定用户：MCP 调用时通过令牌识别账号，只可操作该账号的数据。
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class McpToken(Base):
    __tablename__ = "mcp_tokens"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: uuid.uuid4().hex[:12])
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # 废除时间；NULL 表示有效。每用户最多一个有效令牌（生成新令牌时废除旧的）。
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
