"""本体数据服务：项目与本体的 CRUD 逻辑。"""

import json
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from ..models import OntologyDocument, Project


def get_project(db: Session, project_id: str) -> Optional[Project]:
    return db.get(Project, project_id)


def list_projects(db: Session) -> list[Project]:
    return db.query(Project).order_by(Project.updated_at.desc()).all()


def create_project(
    db: Session,
    name: str,
    description: str = "",
    ontology_iri: str = "http://example.org/cost-ontology#",
    version: str = "1.0.0",
    ontology: Optional[Dict[str, Any]] = None,
) -> Project:
    project = Project(name=name, description=description, ontology_iri=ontology_iri, version=version)
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
    db.commit()
    db.refresh(project)
    return project


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
