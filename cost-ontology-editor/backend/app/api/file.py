"""文件导入导出 API：.owl 文件 <-> 本体项目。"""

from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import ImportResult
from ..services import ontology_service as svc
from ..services.owl_service import OwlParseError, generate_owl, parse_owl

router = APIRouter(prefix="/api/file", tags=["file"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/import", response_model=ImportResult)
async def import_owl(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """上传 .owl 文件 -> 解析 -> 创建项目并保存。"""
    if not file.filename or not file.filename.lower().endswith((".owl", ".xml", ".rdf")):
        raise HTTPException(status_code=400, detail="仅支持 .owl / .xml / .rdf 文件")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="文件过大（超过 10MB）")
    if not content:
        raise HTTPException(status_code=400, detail="文件为空")

    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = content.decode("gb18030")  # 兼容中文编码的文件
        except UnicodeDecodeError as e:
            raise HTTPException(status_code=400, detail="文件编码无法识别，请转换为 UTF-8") from e

    try:
        model, skipped = parse_owl(text, file.filename.rsplit(".", 1)[0])
    except OwlParseError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    project = svc.create_project(
        db,
        name=model.get("name", file.filename.rsplit(".", 1)[0]),
        description=model.get("description", ""),
        ontology_iri=model.get("ontologyIri", "http://example.org/cost-ontology#"),
        version=model.get("version", "1.0.0"),
        ontology=model,
    )

    class_count = sum(1 for n in model.get("nodes", []) if n.get("kind") == "class")
    prop_count = sum(1 for e in model.get("edges", []) if e.get("kind") != "subclass")

    return ImportResult(
        projectId=project.id,
        projectName=project.name,
        classNameCount=class_count,
        propertyCount=prop_count,
        message=f"导入成功：{class_count} 个类、{prop_count} 条属性" + (f"，{len(skipped)} 条被跳过" if skipped else ""),
    )


@router.get("/export/{project_id}")
def export_owl(project_id: str, db: Session = Depends(get_db)):
    """导出项目为标准 OWL RDF/XML 文件下载。"""
    project = svc.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"项目 {project_id} 不存在")

    model = svc.get_ontology(db, project_id)
    xml_text = generate_owl(model)

    # RFC 5987 文件名编码（支持中文文件名）
    filename = quote(f"{project.name}.owl")
    return Response(
        content=xml_text,
        media_type="application/rdf+xml",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )
