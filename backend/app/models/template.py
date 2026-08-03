"""模板模型：管理员创建、可下发给指定用户的示例模板。"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: uuid.uuid4().hex[:12])
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    domain: Mapped[str] = mapped_column(String(100), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str] = mapped_column(String(16), default="📦")
    # 可见范围：public = 所有人可见；assigned = 仅下发的用户可见
    scope: Mapped[str] = mapped_column(String(16), default="public")
    # 模板内容 JSON：{"ontology": {...}, "layout": {...}}
    data: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_by: Mapped[str] = mapped_column(String(64), ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class TemplateAssignment(Base):
    """模板下发：模板 -> 指定用户。"""

    __tablename__ = "template_assignments"

    template_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("templates.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
