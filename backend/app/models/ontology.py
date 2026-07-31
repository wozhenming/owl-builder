"""本体数据模型：项目对应的本体 JSON 文档（编辑器内部结构）。"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class OntologyDocument(Base):
    __tablename__ = "ontology_documents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: uuid.uuid4().hex[:12])
    project_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("projects.id", ondelete="CASCADE"), unique=True, index=True
    )
    # 编辑器内部 JSON 结构（与前端 types/ontology.ts 一致）
    data: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="document")
