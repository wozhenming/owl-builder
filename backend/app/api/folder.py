"""文件夹 API：项目分类管理。"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.deps import current_user_or_none
from ..database import get_db
from ..models import Folder, User
from ..schemas import FolderCreate, FolderOut, FolderUpdate
from ..services import ontology_service as svc

router = APIRouter(prefix="/api/folders", tags=["folders"])


def _get_or_404(db: Session, folder_id: str) -> Folder:
    folder = db.get(Folder, folder_id)
    if folder is None:
        raise HTTPException(status_code=404, detail=f"文件夹 {folder_id} 不存在")
    return folder


def _ensure_owner(folder: Folder, user: User | None) -> None:
    if user is not None and folder.user_id is not None and folder.user_id != user.id:
        raise HTTPException(status_code=403, detail="无权操作他人的文件夹")


def _to_out(folder: Folder) -> dict:
    """ORM 模型 -> 响应字典（字段名与前端 types/api.ts 保持一致）。"""
    return {"id": folder.id, "name": folder.name, "createdAt": folder.created_at}


@router.get("", response_model=list[FolderOut])
def list_folders(
    db: Session = Depends(get_db),
    user: User | None = Depends(current_user_or_none),
):
    return [_to_out(f) for f in svc.list_folders(db, user)]


@router.post("", response_model=FolderOut, status_code=201)
def create_folder(
    body: FolderCreate,
    db: Session = Depends(get_db),
    user: User | None = Depends(current_user_or_none),
):
    return _to_out(svc.create_folder(db, body.name.strip(), user))


@router.put("/{folder_id}", response_model=FolderOut)
def rename_folder(
    folder_id: str,
    body: FolderUpdate,
    db: Session = Depends(get_db),
    user: User | None = Depends(current_user_or_none),
):
    folder = _get_or_404(db, folder_id)
    _ensure_owner(folder, user)
    return _to_out(svc.rename_folder(db, folder, body.name.strip()))


@router.delete("/{folder_id}", status_code=204)
def delete_folder(
    folder_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(current_user_or_none),
):
    folder = _get_or_404(db, folder_id)
    _ensure_owner(folder, user)
    svc.delete_folder(db, folder)
