"""项目 CRUD 与本体数据 API。"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Project
from ..schemas import ProjectCreate, ProjectDetail, ProjectOut, ProjectUpdate
from ..services import ontology_service as svc

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _get_or_404(db: Session, project_id: str) -> Project:
    project = svc.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"项目 {project_id} 不存在")
    return project


def _to_out(project: Project) -> dict:
    """ORM 模型 -> 响应字典（字段名与前端 types/api.ts 保持一致）。"""
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "folderId": project.folder_id,
        "createdAt": project.created_at,
        "updatedAt": project.updated_at,
    }


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return [_to_out(p) for p in svc.list_projects(db)]


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    project = svc.create_project(
        db,
        name=body.name.strip(),
        description=body.description,
        ontology_iri=body.ontology_iri,
        version=body.version,
    )
    if body.folder_id:
        project.folder_id = body.folder_id
        db.commit()
        db.refresh(project)
    return _to_out(project)


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = _get_or_404(db, project_id)
    return {**_to_out(project), "ontology": svc.get_ontology(db, project_id)}


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, body: ProjectUpdate, db: Session = Depends(get_db)):
    project = _get_or_404(db, project_id)
    patch = body.model_dump(exclude_unset=True)
    if "ontology" in patch and patch["ontology"] is not None:
        svc.save_ontology(db, project, patch.pop("ontology"))
    return _to_out(svc.update_project(db, project, patch))


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = _get_or_404(db, project_id)
    svc.delete_project(db, project)


@router.put("/{project_id}/ontology", response_model=ProjectOut)
def save_ontology(project_id: str, ontology: dict, db: Session = Depends(get_db)):
    project = _get_or_404(db, project_id)
    svc.save_ontology(db, project, ontology)
    db.refresh(project)
    return _to_out(project)
