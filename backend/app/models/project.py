"""项目模型：一个项目 = 一个本体工程。"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: uuid.uuid4().hex[:12])
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    ontology_iri: Mapped[str] = mapped_column(String(500), default="http://example.org/cost-ontology#")
    version: Mapped[str] = mapped_column(String(50), default="1.0.0")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    document = relationship("OntologyDocument", back_populates="project", uselist=False, cascade="all, delete-orphan")
