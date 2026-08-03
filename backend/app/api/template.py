"""模板 API：普通用户获取自己可见的模板（含管理员下发的）。"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..api.deps import current_user_or_none
from ..database import get_db
from ..models import User
from ..schemas import TemplateOut
from ..services import admin_service as svc

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=list[TemplateOut])
def list_visible_templates(
    db: Session = Depends(get_db),
    user: User | None = Depends(current_user_or_none),
):
    return svc.list_visible_templates(db, user)
