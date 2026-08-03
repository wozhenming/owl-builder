"""本体数据服务：项目/文件夹/本体的 CRUD 逻辑。"""

import json
from typing import Any, Dict, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models import Folder, OntologyDocument, Project, User


def get_project(db: Session, project_id: str) -> Optional[Project]:
    return db.get(Project, project_id)


def list_projects(db: Session, user: User | None = None) -> list[Project]:
    """匿名用户仅可见公共项目（无归属）；登录用户可见公共 + 自己的项目。"""
    query = db.query(Project)
    if user is not None:
        query = query.filter(or_(Project.user_id.is_(None), Project.user_id == user.id))
    else:
        query = query.filter(Project.user_id.is_(None))
    return query.order_by(Project.updated_at.desc()).all()


def create_project(
    db: Session,
    name: str,
    description: str = "",
    ontology_iri: str = "http://example.org/cost-ontology#",
    version: str = "1.0.0",
    ontology: Optional[Dict[str, Any]] = None,
    user: User | None = None,
) -> Project:
    project = Project(
        name=name,
        description=description,
        ontology_iri=ontology_iri,
        version=version,
        user_id=user.id if user else None,
    )
    db.add(project)
    db.flush()  # 获取 project.id

    if ontology is None:
        ontology = {
            "projectId": project.id,
            "name": name,
            "ontologyIri": ontology_iri,
            "description": description,
            "version": version,
            "nodes": [],
            "edges": [],
            "updatedAt": 0,
        }
    ontology = {**ontology, "projectId": project.id, "name": name}
    document = OntologyDocument(project_id=project.id, data=json.dumps(ontology, ensure_ascii=False))
    db.add(document)
    db.commit()
    db.refresh(project)
    return project


def update_project(db: Session, project: Project, patch: Dict[str, Any]) -> Project:
    if "name" in patch and patch["name"]:
        project.name = patch["name"]
    if "description" in patch:
        project.description = patch["description"] or ""
    if "ontology_iri" in patch:
        project.ontology_iri = patch["ontology_iri"]
    if "version" in patch:
        project.version = patch["version"]
    if "folder_id" in patch:
        project.folder_id = patch["folder_id"] or None
    db.commit()
    db.refresh(project)
    return project


# ---------------------------------------------------------------------------
# 文件夹
# ---------------------------------------------------------------------------

def list_folders(db: Session, user: User | None = None) -> list[Folder]:
    """匿名用户仅可见公共文件夹；登录用户可见公共 + 自己的。"""
    query = db.query(Folder)
    if user is not None:
        query = query.filter(or_(Folder.user_id.is_(None), Folder.user_id == user.id))
    else:
        query = query.filter(Folder.user_id.is_(None))
    return query.order_by(Folder.created_at.asc()).all()


def create_folder(db: Session, name: str, user: User | None = None) -> Folder:
    folder = Folder(name=name, user_id=user.id if user else None)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


def rename_folder(db: Session, folder: Folder, name: str) -> Folder:
    folder.name = name
    db.commit()
    db.refresh(folder)
    return folder


def delete_folder(db: Session, folder: Folder) -> None:
    """删除文件夹：其中的项目 folder_id 置空（不删除项目）。"""
    db.query(Project).filter(Project.folder_id == folder.id).update({"folder_id": None})
    db.delete(folder)
    db.commit()


def save_ontology(db: Session, project: Project, ontology: Dict[str, Any]) -> None:
    """保存本体 JSON（若存在则更新，否则创建文档）。"""
    data = {**ontology, "projectId": project.id}
    if "name" in ontology and ontology["name"]:
        project.name = ontology["name"]
    if "ontologyIri" in ontology and ontology["ontologyIri"]:
        project.ontology_iri = ontology["ontologyIri"]
    document = db.query(OntologyDocument).filter(OntologyDocument.project_id == project.id).first()
    if document is None:
        document = OntologyDocument(project_id=project.id, data=json.dumps(data, ensure_ascii=False))
        db.add(document)
    else:
        document.data = json.dumps(data, ensure_ascii=False)
    db.commit()


def get_ontology(db: Session, project_id: str) -> Dict[str, Any]:
    document = db.query(OntologyDocument).filter(OntologyDocument.project_id == project_id).first()
    if document is None:
        return {}
    try:
        return json.loads(document.data)
    except json.JSONDecodeError:
        return {}


def delete_project(db: Session, project: Project) -> None:
    db.delete(project)  # 级联删除 OntologyDocument
    db.commit()
