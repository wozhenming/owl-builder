"""OWL RDF/XML 解析与生成（Python 标准库实现，无第三方依赖）。

解析结果与前端 types/ontology.ts 中的编辑器内部结构保持一致：
    {
      projectId, name, ontologyIri, description, version, updatedAt,
      nodes: [{id, kind: "class"|"datatype", name, iri, label?, comment?}],
      edges: [{id, kind: "subclass"|"objectProperty"|"dataProperty"|"annotationProperty",
               source, target, name?, iri?, label?, comment?, functional?}]
    }
"""

import re
import uuid
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#"
OWL_NS = "http://www.w3.org/2002/07/owl#"
XSD_NS = "http://www.w3.org/2001/XMLSchema#"

RDF_ABOUT = f"{{{RDF_NS}}}about"
RDF_RESOURCE = f"{{{RDF_NS}}}resource"
RDF_TYPE = f"{{{RDF_NS}}}type"

XSD_DATATYPES = [
    ("string", f"{XSD_NS}string", "字符串 (string)"),
    ("integer", f"{XSD_NS}integer", "整数 (integer)"),
    ("decimal", f"{XSD_NS}decimal", "小数 (decimal)"),
    ("double", f"{XSD_NS}double", "双精度浮点 (double)"),
    ("float", f"{XSD_NS}float", "浮点 (float)"),
    ("boolean", f"{XSD_NS}boolean", "布尔 (boolean)"),
    ("date", f"{XSD_NS}date", "日期 (date)"),
    ("dateTime", f"{XSD_NS}dateTime", "日期时间 (dateTime)"),
]

BUILTIN_IRIS = {
    f"{OWL_NS}Thing",
    f"{OWL_NS}Nothing",
    f"{RDFS_NS}Resource",
    f"{RDFS_NS}Literal",
    f"{RDFS_NS}Class",
    f"{OWL_NS}Class",
}

XMLNS_RE = re.compile(r'xmlns(?::([\w.-]+))?="([^"]*)"')

_NS_PREFIXES = {
    "rdf": RDF_NS,
    "rdfs": RDFS_NS,
    "owl": OWL_NS,
    "xsd": XSD_NS,
}

ID_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def _gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _local_name(iri: str) -> str:
    trimmed = iri.strip().strip("<>")
    for sep in ("#", "/"):
        idx = trimmed.rfind(sep)
        if idx >= 0:
            return trimmed[idx + 1:]
    return trimmed


def _expand_curie(value: str, ns_map: Dict[str, str], base_iri: str) -> str:
    v = value.strip()
    if v.startswith("#"):
        return f"{base_iri}{v[1:]}"
    if v.startswith("<") and v.endswith(">"):
        return v[1:-1]
    if ":" in v:
        prefix, rest = v.split(":", 1)
        if prefix in ns_map:
            return ns_map[prefix] + rest
    return v


def _xml_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def _pick_label(el: ET.Element) -> Optional[str]:
    for node in el.iter(f"{{{RDFS_NS}}}label"):
        text = (node.text or "").strip()
        if text:
            return text
    return None


def _pick_comment(el: ET.Element) -> Optional[str]:
    for node in el.iter(f"{{{RDFS_NS}}}comment"):
        text = (node.text or "").strip()
        if text:
            return text
    return None


class OwlParseError(ValueError):
    """OWL 文件解析失败。"""


# ---------------------------------------------------------------------------
# 解析：RDF/XML -> 编辑器 JSON 模型
# ---------------------------------------------------------------------------

def parse_owl(text: str, fallback_name: str = "导入的本体") -> Tuple[Dict[str, Any], List[str]]:
    """解析 OWL RDF/XML 文本，返回 (编辑器模型, 跳过条目说明列表)。"""
    try:
        root = ET.fromstring(text)
    except ET.ParseError as e:
        raise OwlParseError(f"XML 解析失败：{e}") from e

    ns_map = {m.group(1) or "": m.group(2) for m in XMLNS_RE.finditer(text)}
    base_iri = ns_map.get("") or ""

    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    skipped: List[str] = []
    now = 0  # 导入时统一置 0，前端展示无时间

    # ---- 1. 本体元信息 ----
    ontology_iri = base_iri or "http://example.org/imported-ontology#"
    ontology_name = fallback_name
    version = "1.0.0"
    for onto in root.iter(f"{{{OWL_NS}}}Ontology"):
        about = onto.get(RDF_ABOUT)
        if about:
            ontology_iri = _expand_curie(about, ns_map, base_iri)
        label = _pick_label(onto)
        if label:
            ontology_name = label
        version_info = onto.find(f"{{{OWL_NS}}}versionInfo")
        if version_info is not None and (version_info.text or "").strip():
            version = version_info.text.strip()
        break  # 只取第一个

    if not ontology_iri.endswith(("#", "/")):
        ontology_iri += "#"

    # ---- 2. 收集类 ----
    class_els: List[ET.Element] = list(root.iter(f"{{{OWL_NS}}}Class")) + list(root.iter(f"{{{RDFS_NS}}}Class"))
    seen_classes: Dict[str, str] = {}  # iri -> node id
    for el in class_els:
        about = el.get(RDF_ABOUT)
        if not about:
            continue
        iri = _expand_curie(about, ns_map, base_iri)
        if iri in BUILTIN_IRIS or iri in seen_classes:
            continue
        nid = _gen_id("cls")
        seen_classes[iri] = nid
        nodes.append({
            "id": nid,
            "kind": "class",
            "name": _local_name(iri),
            "iri": iri,
            "label": _pick_label(el),
            "comment": _pick_comment(el),
            "createdAt": now,
        })

    # ---- 3. 收集属性（作为边）----
    prop_specs = [
        (f"{{{OWL_NS}}}ObjectProperty", "objectProperty"),
        (f"{{{OWL_NS}}}DatatypeProperty", "dataProperty"),
        (f"{{{OWL_NS}}}AnnotationProperty", "annotationProperty"),
    ]
    seen_props = set()
    for tag, kind in prop_specs:
        for el in root.iter(tag):
            about = el.get(RDF_ABOUT)
            if not about:
                continue
            iri = _expand_curie(about, ns_map, base_iri)
            if iri in seen_props:
                continue
            seen_props.add(iri)

            domains = [r for r in el.iter(f"{{{RDFS_NS}}}domain") if (r.get(RDF_RESOURCE))]
            ranges = [r for r in el.iter(f"{{{RDFS_NS}}}range") if (r.get(RDF_RESOURCE))]
            if not domains or not ranges:
                skipped.append(f"属性 {iri}（缺少 domain/range）")
                continue

            source_iri = _expand_curie(domains[0].get(RDF_RESOURCE, ""), ns_map, base_iri)
            target_iri = _expand_curie(ranges[0].get(RDF_RESOURCE, ""), ns_map, base_iri)

            source_id = _find_or_create_class(nodes, seen_classes, source_iri)
            if source_id is None:
                skipped.append(f"属性 {iri}（domain 指向不存在的类 {source_iri}）")
                continue
            target_id = _find_or_create_range(nodes, target_iri)
            if target_id is None:
                skipped.append(f"属性 {iri}（range 解析失败 {target_iri}）")
                continue

            functional = any(
                (t.get(RDF_RESOURCE, "") == f"{OWL_NS}FunctionalProperty") for t in el.iter(RDF_TYPE)
            )

            edges.append({
                "id": _gen_id("prp"),
                "kind": kind,
                "source": source_id,
                "target": target_id,
                "name": _local_name(iri),
                "iri": iri,
                "label": _pick_label(el),
                "comment": _pick_comment(el),
                "functional": functional,
                "createdAt": now,
            })

    # ---- 4. 子类边 ----
    for el in class_els:
        about = el.get(RDF_ABOUT)
        if not about:
            continue
        iri = _expand_curie(about, ns_map, base_iri)
        if iri not in seen_classes:
            continue
        for sub in el.iter(f"{{{RDFS_NS}}}subClassOf"):
            resource = sub.get(RDF_RESOURCE)
            nested = len(list(sub.iter())) > 1
            if nested and not resource:
                skipped.append(f"类 {iri} 的匿名子类限制（不支持）")
                continue
            if not resource:
                continue
            parent_iri = _expand_curie(resource, ns_map, base_iri)
            if parent_iri in BUILTIN_IRIS:
                continue
            parent_id = seen_classes.get(parent_iri)
            if parent_id:
                edges.append({
                    "id": _gen_id("sub"),
                    "kind": "subclass",
                    "source": seen_classes[iri],
                    "target": parent_id,
                    "createdAt": now,
                })

    model = {
        "projectId": None,
        "name": ontology_name,
        "ontologyIri": ontology_iri,
        "description": "",
        "version": version,
        "nodes": nodes,
        "edges": edges,
        "updatedAt": now,
    }
    return model, skipped


def _find_or_create_class(nodes, seen_classes: Dict[str, str], iri: str) -> Optional[str]:
    if iri in seen_classes:
        return seen_classes[iri]
    nid = _gen_id("cls")
    seen_classes[iri] = nid
    nodes.append({
        "id": nid,
        "kind": "class",
        "name": _local_name(iri),
        "iri": iri,
        "createdAt": 0,
    })
    return nid


def _find_or_create_range(nodes, iri: str) -> Optional[str]:
    # 值域是已有类 -> 直接使用
    for n in nodes:
        if n["kind"] == "class" and n["iri"] == iri:
            return n["id"]
    # 否则按数据类型处理
    for n in nodes:
        if n["kind"] == "datatype" and n["iri"] == iri:
            return n["id"]
    xsd = next((d for d in XSD_DATATYPES if d[1] == iri), None)
    nid = _gen_id("dty")
    nodes.append({
        "id": nid,
        "kind": "datatype",
        "name": xsd[0] if xsd else _local_name(iri),
        "iri": iri,
        "label": xsd[2] if xsd else None,
        "createdAt": 0,
    })
    return nid


# ---------------------------------------------------------------------------
# 生成：编辑器 JSON 模型 -> RDF/XML
# ---------------------------------------------------------------------------

def generate_owl(model: Dict[str, Any]) -> str:
    """将编辑器模型生成为标准 OWL RDF/XML 文本。"""
    ontology_iri = model.get("ontologyIri") or "http://example.org/cost-ontology#"
    version = model.get("version") or "1.0.0"
    description = model.get("description") or ""
    nodes = model.get("nodes") or []
    edges = model.get("edges") or []

    by_id = {n["id"]: n for n in nodes}

    lines: List[str] = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append("<rdf:RDF")
    lines.append('  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"')
    lines.append('  xmlns:xsd="http://www.w3.org/2001/XMLSchema#"')
    lines.append('  xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"')
    lines.append('  xmlns:owl="http://www.w3.org/2002/07/owl#">')

    lines.append(f'  <owl:Ontology rdf:about="{_xml_escape(ontology_iri)}">')
    lines.append(f"    <owl:versionInfo>{_xml_escape(version)}</owl:versionInfo>")
    if model.get("name"):
        lines.append(f'    <rdfs:label xml:lang="zh">{_xml_escape(model["name"])}</rdfs:label>')
    if description:
        lines.append(f'    <rdfs:comment xml:lang="zh">{_xml_escape(description)}</rdfs:comment>')
    lines.append("  </owl:Ontology>")

    # 类
    for node in nodes:
        if node.get("kind") != "class":
            continue
        lines.append(f'  <owl:Class rdf:about="{_xml_escape(node["iri"])}">')
        for edge in edges:
            if edge.get("kind") != "subclass" or edge.get("source") != node["id"]:
                continue
            parent = by_id.get(edge.get("target"))
            if parent:
                lines.append(f'    <rdfs:subClassOf rdf:resource="{_xml_escape(parent["iri"])}"/>')
        if node.get("label"):
            lines.append(f'    <rdfs:label xml:lang="zh">{_xml_escape(node["label"])}</rdfs:label>')
        if node.get("comment"):
            lines.append(f'    <rdfs:comment xml:lang="zh">{_xml_escape(node["comment"])}</rdfs:comment>')
        lines.append("  </owl:Class>")

    # 非内置数据类型
    xsd_iris = {d[1] for d in XSD_DATATYPES}
    for node in nodes:
        if node.get("kind") != "datatype" or node["iri"] in xsd_iris:
            continue
        lines.append(f'  <rdfs:Datatype rdf:about="{_xml_escape(node["iri"])}">')
        if node.get("label"):
            lines.append(f'    <rdfs:label xml:lang="zh">{_xml_escape(node["label"])}</rdfs:label>')
        lines.append("  </rdfs:Datatype>")

    # 属性
    kind_tags = {
        "objectProperty": "owl:ObjectProperty",
        "dataProperty": "owl:DatatypeProperty",
        "annotationProperty": "owl:AnnotationProperty",
    }
    for edge in edges:
        kind = edge.get("kind")
        if kind not in kind_tags:
            continue
        domain = by_id.get(edge.get("source"))
        range_ = by_id.get(edge.get("target"))
        if not domain or not range_:
            continue
        iri = edge.get("iri") or f"{ontology_iri}{edge.get('name', 'property')}"
        lines.append(f'  <{kind_tags[kind]} rdf:about="{_xml_escape(iri)}">')
        lines.append(f'    <rdfs:domain rdf:resource="{_xml_escape(domain["iri"])}"/>')
        lines.append(f'    <rdfs:range rdf:resource="{_xml_escape(range_["iri"])}"/>')
        if edge.get("functional"):
            lines.append(f'    <rdf:type rdf:resource="{OWL_NS}FunctionalProperty"/>')
        if edge.get("label"):
            lines.append(f'    <rdfs:label xml:lang="zh">{_xml_escape(edge["label"])}</rdfs:label>')
        if edge.get("comment"):
            lines.append(f'    <rdfs:comment xml:lang="zh">{_xml_escape(edge["comment"])}</rdfs:comment>')
        lines.append(f"  </{kind_tags[kind]}>")

    lines.append("</rdf:RDF>")
    return "\n".join(lines)
