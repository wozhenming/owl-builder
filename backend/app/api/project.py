"""项目 CRUD 与本体数据 API。"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.deps import current_user_or_none
from ..database import get_db
from ..models import Project, User
from ..schemas import ProjectCreate, ProjectDetail, ProjectOut, ProjectUpdate
from ..services import ontology_service as svc

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _get_or_404(db: Session, project_id: str) -> Project:
    project = svc.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"项目 {project_id} 不存在")
    return project


def _ensure_owner(project: Project, user: User | None) -> None:
    """登录用户只能修改自己的项目；公共（无主）项目与匿名模式不受限。"""
    if user is not None and project.user_id is not None and project.user_id != user.id:
        raise HTTPException(status_code=403, detail="无权操作他人的项目")


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
def list_projects(db: Session = Depends(get_db), user: User | None = Depends(current_user_or_none)):
    return [_to_out(p) for p in svc.list_projects(db, user)]


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    user: User | None = Depends(current_user_or_none),
):
    project = svc.create_project(
        db,
        name=body.name.strip(),
        description=body.description,
        ontology_iri=body.ontology_iri,
        version=body.version,
        user=user,
    )
    if body.folder_id:
        project.folder_id = body.folder_id
        db.commit()
        db.refresh(project)
    return _to_out(project)


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(current_user_or_none),
):
    project = _get_or_404(db, project_id)
    _ensure_owner(project, user)
    return {**_to_out(project), "ontology": svc.get_ontology(db, project_id)}


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    user: User | None = Depends(current_user_or_none),
):
    project = _get_or_404(db, project_id)
    _ensure_owner(project, user)
    patch = body.model_dump(exclude_unset=True)
    if "ontology" in patch and patch["ontology"] is not None:
        svc.save_ontology(db, project, patch.pop("ontology"))
    return _to_out(svc.update_project(db, project, patch))


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(current_user_or_none),
):
    project = _get_or_404(db, project_id)
    _ensure_owner(project, user)
    svc.delete_project(db, project)


@router.put("/{project_id}/ontology", response_model=ProjectOut)
def save_ontology(
    project_id: str,
    ontology: dict,
    db: Session = Depends(get_db),
    user: User | None = Depends(current_user_or_none),
):
    project = _get_or_404(db, project_id)
    _ensure_owner(project, user)
    svc.save_ontology(db, project, ontology)
    db.refresh(project)
    return _to_out(project)
