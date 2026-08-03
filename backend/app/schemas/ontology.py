"""Pydantic 数据模型（API 请求/响应结构）。"""

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200, description="项目名称")
    description: str = Field(default="", max_length=2000)
    ontology_iri: str = Field(default="http://example.org/cost-ontology#", max_length=500)
    version: str = Field(default="1.0.0", max_length=50)
    folder_id: Optional[str] = Field(default=None, max_length=64, validation_alias="folderId")


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    ontology_iri: Optional[str] = Field(default=None, max_length=500)
    folder_id: Optional[str] = Field(default=None, max_length=64, validation_alias="folderId")
    ontology: Optional[Dict[str, Any]] = None


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str
    folderId: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class FolderUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class FolderOut(BaseModel):
    id: str
    name: str
    createdAt: datetime


# ---- 用户管理 ----

class UserAdminOut(BaseModel):
    id: str
    username: str
    isAdmin: bool
    projectCount: int = 0
    createdAt: datetime


# ---- 模板 ----

class TemplateOut(BaseModel):
    id: str
    name: str
    domain: str
    description: str
    icon: str
    scope: str
    data: Dict[str, Any]
    createdAt: datetime


class TemplateAdminOut(TemplateOut):
    assignedUserIds: list[str] = []


class ProjectDetail(ProjectOut):
    ontology: Dict[str, Any]


class ImportResult(BaseModel):
    projectId: str
    projectName: str
    classNameCount: int
    propertyCount: int
    message: str
