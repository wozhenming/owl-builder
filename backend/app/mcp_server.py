"""MCP（Model Context Protocol）服务：把本体的编辑功能暴露给 AI 助手。

两种运行方式：
1. stdio（Claude Desktop / Cursor 等桌面客户端，默认）：
       .venv/Scripts/python -m app.mcp_server
2. HTTP（streamable HTTP，独立端口 8001）：
       .venv/Scripts/python -m app.mcp_server --http

配置示例（Claude Desktop claude_desktop_config.json）：
{
  "mcpServers": {
    "cost-ontology": {
      "command": "D:/GKTL/owl-builder/backend/.venv/Scripts/python.exe",
      "args": ["-m", "app.mcp_server"],
      "cwd": "D:/GKTL/owl-builder/backend"
    }
  }
}
"""

import json

from fastmcp import FastMCP

from .database import SessionLocal
from .models import Project, Template, User
from .services import admin_service
from .services import ontology_service as svc
from .services.owl_service import generate_owl, parse_owl

mcp = FastMCP("cost-ontology-editor", instructions=(
    "本体可视化编辑器（OWL 本体）的编辑工具。"
    "数据模型：类（class）与数据类型（datatype）是节点；"
    "子类关系（subclass）/ 对象属性（objectProperty）/ 数据属性（dataProperty）/ 注解属性（annotationProperty）是边。"
    "所有 id 由工具返回，后续操作直接引用。"
))


def _project_out(p: Project) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "folderId": p.folder_id,
        "createdAt": p.created_at.isoformat() if p.created_at else None,
        "updatedAt": p.updated_at.isoformat() if p.updated_at else None,
    }


# ---------------------------------------------------------------------------
# 项目管理
# ---------------------------------------------------------------------------

@mcp.tool(description="列出全部项目（id、名称、描述、文件夹）")
def list_projects() -> list[dict]:
    with SessionLocal() as db:
        return [_project_out(p) for p in svc.list_projects(db)]


@mcp.tool(description="创建项目，返回项目 id。可指定名称、描述、本体命名空间 IRI")
def create_project(name: str, description: str = "", ontology_iri: str = "http://example.org/cost-ontology#") -> dict:
    with SessionLocal() as db:
        p = svc.create_project(db, name=name, description=description, ontology_iri=ontology_iri)
        return _project_out(p)


@mcp.tool(description="删除项目（含全部本体数据）")
def delete_project(project_id: str) -> str:
    with SessionLocal() as db:
        p = svc.get_project(db, project_id)
        if p is None:
            return f"项目 {project_id} 不存在"
        svc.delete_project(db, p)
        return f"已删除项目 {project_id}"


# ---------------------------------------------------------------------------
# 本体数据
# ---------------------------------------------------------------------------

@mcp.tool(description="查看项目本体结构：全部类/数据类型节点与关系边（含类的层级深度）")
def get_ontology(project_id: str) -> dict:
    with SessionLocal() as db:
        if svc.get_project(db, project_id) is None:
            return {"error": f"项目 {project_id} 不存在"}
        model = svc.get_ontology(db, project_id)
        return model


@mcp.tool(description="添加类。name 为 IRI 本地名（唯一），可选中文显示名、注释、父类 id（自动建立子类关系）")
def add_class(
    project_id: str,
    name: str,
    label: str = "",
    comment: str = "",
    parent_class_id: str = "",
) -> dict:
    with SessionLocal() as db:
        project = svc.get_project(db, project_id)
        if project is None:
            return {"error": f"项目 {project_id} 不存在"}
        model = svc.get_ontology(db, project_id)
        if any(n.get("name") == name for n in model.get("nodes", [])):
            return {"error": f"已存在同名实体 {name}"}
        from .utils.helpers import build_iri

        new_id = f"cls_{name}"
        model.setdefault("nodes", []).append({
            "id": new_id,
            "kind": "class",
            "name": name,
            "iri": build_iri(project.ontology_iri, name),
            "label": label or None,
            "comment": comment or None,
            "createdAt": 0,
        })
        if parent_class_id:
            model.setdefault("edges", []).append({
                "id": f"sub_{name}",
                "kind": "subclass",
                "source": new_id,
                "target": parent_class_id,
                "createdAt": 0,
            })
        svc.save_ontology(db, project, model)
        return {"id": new_id, "parentClassId": parent_class_id or None}


@mcp.tool(description="更新类（名称/中文显示名/注释）")
def update_class(project_id: str, class_id: str, name: str = "", label: str = "", comment: str = "") -> dict:
    with SessionLocal() as db:
        project = svc.get_project(db, project_id)
        if project is None:
            return {"error": f"项目 {project_id} 不存在"}
        model = svc.get_ontology(db, project_id)
        node = next((n for n in model.get("nodes", []) if n.get("id") == class_id), None)
        if node is None:
            return {"error": f"类 {class_id} 不存在"}
        if name:
            node["name"] = name
        node["label"] = label or None
        node["comment"] = comment or None
        svc.save_ontology(db, project, model)
        return {"id": class_id, "updated": True}


@mcp.tool(description="删除类（其全部关联关系一并删除）")
def delete_class(project_id: str, class_id: str) -> str:
    with SessionLocal() as db:
        project = svc.get_project(db, project_id)
        if project is None:
            return f"项目 {project_id} 不存在"
        model = svc.get_ontology(db, project_id)
        model["nodes"] = [n for n in model.get("nodes", []) if n.get("id") != class_id]
        model["edges"] = [e for e in model.get("edges", []) if e.get("source") != class_id and e.get("target") != class_id]
        svc.save_ontology(db, project, model)
        return f"已删除类 {class_id}"


@mcp.tool(description="添加关系边。kind: subclass（子类关系）/ objectProperty（对象属性）/ dataProperty（数据属性，target 应为数据类型 id）/ annotationProperty（注解属性）。property 类关系需 name（属性名）")
def add_relation(
    project_id: str,
    kind: str,
    source_id: str,
    target_id: str,
    name: str = "",
    label: str = "",
    comment: str = "",
    functional: bool = False,
) -> dict:
    if kind not in ("subclass", "objectProperty", "dataProperty", "annotationProperty"):
        return {"error": "kind 只能是 subclass / objectProperty / dataProperty / annotationProperty"}
    with SessionLocal() as db:
        project = svc.get_project(db, project_id)
        if project is None:
            return {"error": f"项目 {project_id} 不存在"}
        model = svc.get_ontology(db, project_id)
        ids = {n.get("id") for n in model.get("nodes", [])}
        if source_id not in ids or target_id not in ids:
            return {"error": "source 或 target 节点不存在"}
        if any(e.get("kind") == kind and e.get("source") == source_id and e.get("target") == target_id
               for e in model.get("edges", [])):
            return {"error": "同一起点与终点间已存在同类关系"}
        from .utils.helpers import build_iri

        edge_id = f"rel_{name or kind}_{source_id[-4:]}_{target_id[-4:]}"
        edge = {
            "id": edge_id,
            "kind": kind,
            "source": source_id,
            "target": target_id,
            "createdAt": 0,
        }
        if kind != "subclass":
            edge.update({
                "name": name,
                "iri": build_iri(project.ontology_iri, name or f"属性{len(model.get('edges', []))}"),
                "label": label or None,
                "comment": comment or None,
                "functional": functional,
            })
        model.setdefault("edges", []).append(edge)
        svc.save_ontology(db, project, model)
        return {"id": edge_id, "kind": kind}


@mcp.tool(description="删除关系边")
def delete_relation(project_id: str, relation_id: str) -> str:
    with SessionLocal() as db:
        project = svc.get_project(db, project_id)
        if project is None:
            return f"项目 {project_id} 不存在"
        model = svc.get_ontology(db, project_id)
        model["edges"] = [e for e in model.get("edges", []) if e.get("id") != relation_id]
        svc.save_ontology(db, project, model)
        return f"已删除关系 {relation_id}"


@mcp.tool(description="添加标准数据类型节点（如 string、integer、decimal、date），作为数据属性的值域")
def add_datatype(project_id: str, xsd_name: str) -> dict:
    XSD = {
        "string": "http://www.w3.org/2001/XMLSchema#string",
        "integer": "http://www.w3.org/2001/XMLSchema#integer",
        "decimal": "http://www.w3.org/2001/XMLSchema#decimal",
        "double": "http://www.w3.org/2001/XMLSchema#double",
        "float": "http://www.w3.org/2001/XMLSchema#float",
        "boolean": "http://www.w3.org/2001/XMLSchema#boolean",
        "date": "http://www.w3.org/2001/XMLSchema#date",
        "dateTime": "http://www.w3.org/2001/XMLSchema#dateTime",
    }
    if xsd_name not in XSD:
        return {"error": f"不支持的 XSD 类型 {xsd_name}，可选：{', '.join(XSD)}"}
    with SessionLocal() as db:
        project = svc.get_project(db, project_id)
        if project is None:
            return {"error": f"项目 {project_id} 不存在"}
        model = svc.get_ontology(db, project_id)
        for n in model.get("nodes", []):
            if n.get("kind") == "datatype" and n.get("name") == xsd_name:
                return {"id": n["id"], "note": "已存在"}
        new_id = f"dty_{xsd_name}"
        model.setdefault("nodes", []).append({
            "id": new_id,
            "kind": "datatype",
            "name": xsd_name,
            "iri": XSD[xsd_name],
            "createdAt": 0,
        })
        svc.save_ontology(db, project, model)
        return {"id": new_id}


# ---------------------------------------------------------------------------
# 模板
# ---------------------------------------------------------------------------

@mcp.tool(description="列出可见的示例模板（管理员下发的 + 内置）")
def list_templates() -> list[dict]:
    with SessionLocal() as db:
        return admin_service.list_visible_templates(db, None)


@mcp.tool(description="使用模板创建项目（模板 id 来自 list_templates）")
def create_project_from_template(template_id: str, name: str = "") -> dict:
    with SessionLocal() as db:
        tpl = db.get(Template, template_id)
        if tpl is None:
            return {"error": f"模板 {template_id} 不存在"}
        try:
            data = json.loads(tpl.data)
        except json.JSONDecodeError:
            return {"error": "模板内容损坏"}
        ontology = data.get("ontology") or {}
        layout = data.get("layout")
        p = svc.create_project(
            db,
            name=name or tpl.name,
            description=tpl.description,
            ontology_iri=ontology.get("ontologyIri", "http://example.org/tpl#"),
            ontology=ontology,
        )
        if layout:
            svc.save_ontology(db, p, {**ontology, "projectId": p.id, "layout": layout})
        return _project_out(p)


# ---------------------------------------------------------------------------
# OWL 导入导出
# ---------------------------------------------------------------------------

@mcp.tool(description="导出项目为标准 OWL RDF/XML 文本")
def export_owl(project_id: str) -> str:
    with SessionLocal() as db:
        project = svc.get_project(db, project_id)
        if project is None:
            return f"项目 {project_id} 不存在"
        return generate_owl(svc.get_ontology(db, project_id))


@mcp.tool(description="导入 OWL RDF/XML 文本，创建为新项目，返回项目 id")
def import_owl(xml_text: str, name: str = "导入的本体") -> dict:
    try:
        model, skipped = parse_owl(xml_text, name)
    except ValueError as e:
        return {"error": str(e)}
    with SessionLocal() as db:
        p = svc.create_project(
            db,
            name=model.get("name", name),
            description=model.get("description", ""),
            ontology_iri=model.get("ontologyIri", "http://example.org/cost-ontology#"),
            version=model.get("version", "1.0.0"),
            ontology=model,
        )
        return {
            **_project_out(p),
            "skipped": len(skipped),
            "nodeCount": len(model.get("nodes", [])),
            "edgeCount": len(model.get("edges", [])),
        }


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    from .mcp_auth import get_mcp_token, verify_mcp_token

    # 令牌校验：若已配置令牌（环境变量或 .mcp_token 文件），
    # 必须通过 --token <token> 提供一致令牌才能启动
    if "--token" in sys.argv:
        idx = sys.argv.index("--token")
        provided = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else ""
        if not verify_mcp_token(None, provided):
            print("错误：MCP 令牌不匹配", file=sys.stderr)
            sys.exit(1)
    else:
        configured = get_mcp_token()
        if configured:
            print("提示：已配置 MCP 令牌，请使用 --token <令牌> 启动", file=sys.stderr)

    # --http：streamable HTTP 模式（默认 127.0.0.1:8001）；否则 stdio 模式
    if "--http" in sys.argv:
        mcp.run(transport="http", host="127.0.0.1", port=8001)
    else:
        mcp.run(transport="stdio")
