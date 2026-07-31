import type { DatatypeNode, EdgeKind, Ontology, OntologyEdge, OntologyNode } from '../types/ontology'
import { generateId, toLocalName } from '../utils/helpers'
import { isXsdDatatype } from './owlGenerator'
import { XSD_DATATYPES } from '../utils/helpers'

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#'
const OWL_NS = 'http://www.w3.org/2002/07/owl#'

/** 需要跳过的内置实体（不转为节点） */
const BUILTIN_IRIS = new Set([
  'http://www.w3.org/2002/07/owl#Thing',
  'http://www.w3.org/2002/07/owl#Nothing',
  'http://www.w3.org/2000/01/rdf-schema#Resource',
  'http://www.w3.org/2000/01/rdf-schema#Literal',
  'http://www.w3.org/2000/01/rdf-schema#Class',
  'http://www.w3.org/2002/07/owl#Class',
])

/** 解析结果 */
export interface OwlParseResult {
  ontology: Ontology
  /** 因缺少 domain/range 或包含匿名限制而跳过的条目 */
  skipped: string[]
  /** 解析错误（非致命） */
  warnings: string[]
}

/** 解析 RDF/XML 文本为编辑器内部 Ontology 模型 */
export function parseOwlXml(xmlText: string, fallbackName = '导入的本体'): OwlParseResult {
  const warnings: string[] = []
  const skipped: string[] = []
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`XML 解析失败：${parseError.textContent?.slice(0, 200) ?? '未知错误'}`)
  }

  const root = doc.documentElement
  const namespaceMap = collectNamespaces(root)
  const baseIri = root.getAttribute('xml:base') ?? namespaceMap.get('') ?? ''

  const node = (xmlEl: Element) => ({
    el: xmlEl,
    about: expandCurie(xmlEl.getAttribute('rdf:about') ?? '', namespaceMap, baseIri),
  })

  /** 从元素中取 rdfs:label（优先中文） */
  const pickLabel = (el: Element): string | undefined => {
    const labels = [...el.getElementsByTagNameNS(RDFS_NS, 'label')]
    if (labels.length === 0) return undefined
    const zh = labels.find((l) => l.getAttribute('xml:lang') === 'zh')
    const lang = labels.find((l) => l.getAttribute('xml:lang') !== undefined)
    return (zh ?? lang ?? labels[0]).textContent?.trim() || undefined
  }

  const pickComment = (el: Element): string | undefined => {
    const comments = [...el.getElementsByTagNameNS(RDFS_NS, 'comment')]
    if (comments.length === 0) return undefined
    const zh = comments.find((l) => l.getAttribute('xml:lang') === 'zh')
    return (zh ?? comments[0]).textContent?.trim() || undefined
  }

  /** 收集 rdf:resource 引用 */
  const collectResourceRefs = (el: Element, tagLocal: string): string[] => {
    const refs: string[] = []
    for (const child of [...el.getElementsByTagNameNS(RDFS_NS, tagLocal)]) {
      const resource = child.getAttribute('rdf:resource')
      if (resource) refs.push(expandCurie(resource, namespaceMap, baseIri))
    }
    return refs
  }

  // ---- 1. 本体元信息 ----
  let ontologyIri = baseIri || 'http://example.org/imported-ontology#'
  let ontologyName = fallbackName
  let version = '1.0.0'
  const owlOntologyEls = [...doc.getElementsByTagNameNS(OWL_NS, 'Ontology')]
  if (owlOntologyEls.length > 0) {
    const ontoEl = owlOntologyEls[0]
    const about = ontoEl.getAttribute('rdf:about')
    if (about) ontologyIri = expandCurie(about, namespaceMap, baseIri)
    const label = pickLabel(ontoEl)
    if (label) ontologyName = label
    const v = ontoEl.getElementsByTagNameNS(OWL_NS, 'versionInfo')[0]
    if (v?.textContent?.trim()) version = v.textContent.trim()
  }

  // ---- 2. 收集类与属性 ----
  const classEls = [
    ...doc.getElementsByTagNameNS(OWL_NS, 'Class'),
    ...doc.getElementsByTagNameNS(RDFS_NS, 'Class'),
  ]
  const propEls = [
    ...doc.getElementsByTagNameNS(OWL_NS, 'ObjectProperty'),
    ...doc.getElementsByTagNameNS(OWL_NS, 'DatatypeProperty'),
    ...doc.getElementsByTagNameNS(OWL_NS, 'AnnotationProperty'),
  ]

  const now = Date.now()
  const nodes: OntologyNode[] = []
  const edges: OntologyEdge[] = []

  // ---- 3. 类节点 + 子类边 ----
  const seenClassIris = new Set<string>()
  for (const el of classEls) {
    const { about } = node(el)
    if (!about || BUILTIN_IRIS.has(about) || seenClassIris.has(about)) continue
    seenClassIris.add(about)
    nodes.push({
      id: generateId('cls'),
      kind: 'class',
      name: toLocalName(about),
      iri: about,
      label: pickLabel(el),
      comment: pickComment(el),
      createdAt: now,
    })
  }

  // ---- 4. 属性节点（作为边）----
  const seenPropIris = new Set<string>()
  for (const el of propEls) {
    const { about } = node(el)
    if (!about || seenPropIris.has(about)) continue
    seenPropIris.add(about)

    const kind: EdgeKind = el.localName === 'ObjectProperty'
      ? 'objectProperty'
      : el.localName === 'DatatypeProperty'
        ? 'dataProperty'
        : 'annotationProperty'

    const domains = collectResourceRefs(el, 'domain').map((r) => ({ id: findOrCreateClassNode(r) }))
    const ranges = collectResourceRefs(el, 'range').map((r) => ({ id: findOrCreateRangeNode(r) }))

    if (domains.length === 0 || ranges.length === 0) {
      const reason = domains.length === 0 ? '缺少 domain' : '缺少 range'
      skipped.push(`属性 ${about}（${reason}）`)
      continue
    }

    const functional = [...el.getElementsByTagNameNS(RDF_NS, 'type')].some(
      (t) =>
        (t.getAttribute('rdf:resource') ?? '') ===
        'http://www.w3.org/2002/07/owl#FunctionalProperty',
    )

    edges.push({
      id: generateId('prp'),
      kind,
      source: domains[0].id,
      target: ranges[0].id,
      name: toLocalName(about),
      iri: about,
      label: pickLabel(el),
      comment: pickComment(el),
      functional,
      createdAt: now,
    })
  }

  // ---- 5. 子类边（跳过对 owl:Thing 等内置实体的引用与匿名限制）----
  for (const el of classEls) {
    const { about } = node(el)
    if (!about || BUILTIN_IRIS.has(about) || !seenClassIris.has(about)) continue
    for (const subEl of [...el.getElementsByTagNameNS(RDFS_NS, 'subClassOf')]) {
      const resource = subEl.getAttribute('rdf:resource')
      const hasNested = subEl.getElementsByTagName('*').length > 0
      if (hasNested && !resource) {
        skipped.push(`类 ${about} 的匿名子类限制（不支持）`)
        continue
      }
      if (!resource) continue
      const parentIri = expandCurie(resource, namespaceMap, baseIri)
      if (BUILTIN_IRIS.has(parentIri)) continue
      const childNode = nodes.find((n) => n.kind === 'class' && n.iri === about)
      const parentNode = nodes.find((n) => n.kind === 'class' && n.iri === parentIri)
      if (childNode && parentNode) {
        edges.push({
          id: generateId('sub'),
          kind: 'subclass',
          source: childNode.id,
          target: parentNode.id,
          createdAt: now,
        })
      }
    }
  }

  // ---- 6. 返回结果 ----
  const ontology: Ontology = {
    projectId: null,
    name: ontologyName,
    ontologyIri: ontologyIri.endsWith('#') || ontologyIri.endsWith('/') ? ontologyIri : `${ontologyIri}#`,
    description: '',
    version,
    nodes,
    edges,
    updatedAt: now,
  }

  if (skipped.length > 0) {
    warnings.push(`有 ${skipped.length} 条声明因缺少 domain/range 或为匿名限制而被跳过`)
  }
  return { ontology, skipped, warnings }

  // ---- 内部工具：按 IRI 查找或创建节点 ----
  function findOrCreateClassNode(iri: string): string {
    const existing = nodes.find((n) => n.kind === 'class' && n.iri === iri)
    if (existing) return existing.id
    const clsId = generateId('cls')
    nodes.push({
      id: clsId,
      kind: 'class',
      name: toLocalName(iri),
      iri,
      createdAt: now,
    })
    return clsId
  }

  function findOrCreateRangeNode(iri: string): string {
    // 值域是数据类型 -> 创建数据类型节点
    if (isXsdDatatype(iri) || !nodes.find((n) => n.kind === 'class' && n.iri === iri)) {
      const existing = nodes.find((n) => n.kind === 'datatype' && n.iri === iri)
      if (existing) return existing.id
      const xsd = XSD_DATATYPES.find((d) => d.iri === iri)
      const dty: DatatypeNode = {
        id: generateId('dty'),
        kind: 'datatype',
        name: xsd?.name ?? toLocalName(iri),
        iri,
        label: xsd?.label,
        createdAt: now,
      }
      nodes.push(dty)
      return dty.id
    }
    return findOrCreateClassNode(iri)
  }
}

/** 收集根元素上的全部命名空间前缀 -> URI 映射 */
function collectNamespaces(root: Element): Map<string, string> {
  const map = new Map<string, string>()
  for (const attr of root.attributes) {
    if (attr.name === 'xmlns') {
      map.set('', attr.value)
    } else if (attr.name.startsWith('xmlns:')) {
      map.set(attr.name.slice(6), attr.value)
    }
  }
  return map
}

/** 展开 CURIE（如 #Foo、cost:Foo）为完整 IRI */
function expandCurie(value: string, ns: Map<string, string>, baseIri: string): string {
  const v = value.trim()
  if (v.startsWith('#')) {
    return `${baseIri}${v.slice(1)}`
  }
  if (v.startsWith('<') && v.endsWith('>')) return v.slice(1, -1)
  const colon = v.indexOf(':')
  if (colon > 0) {
    const prefix = v.slice(0, colon)
    const rest = v.slice(colon + 1)
    const resolved = ns.get(prefix)
    if (resolved) return resolved + rest
  }
  return v
}
