import type { ClassNode, EdgeKind, Ontology, OntologyNode, PropertyKind } from '../types/ontology'

/** 系统预置的 XSD 数据类型（可作为数据属性 range） */
export const XSD_DATATYPES: ReadonlyArray<{ name: string; iri: string; label: string }> = [
  { name: 'string', iri: 'http://www.w3.org/2001/XMLSchema#string', label: '字符串 (string)' },
  { name: 'integer', iri: 'http://www.w3.org/2001/XMLSchema#integer', label: '整数 (integer)' },
  { name: 'decimal', iri: 'http://www.w3.org/2001/XMLSchema#decimal', label: '小数 (decimal)' },
  { name: 'double', iri: 'http://www.w3.org/2001/XMLSchema#double', label: '双精度浮点 (double)' },
  { name: 'float', iri: 'http://www.w3.org/2001/XMLSchema#float', label: '浮点 (float)' },
  { name: 'boolean', iri: 'http://www.w3.org/2001/XMLSchema#boolean', label: '布尔 (boolean)' },
  { name: 'date', iri: 'http://www.w3.org/2001/XMLSchema#date', label: '日期 (date)' },
  { name: 'dateTime', iri: 'http://www.w3.org/2001/XMLSchema#dateTime', label: '日期时间 (dateTime)' },
]

/** 属性种类的中文名称 */
export const EDGE_KIND_LABELS: Record<EdgeKind, string> = {
  subclass: '子类关系',
  objectProperty: '对象属性',
  dataProperty: '数据属性',
  annotationProperty: '注解属性',
}

/** 属性种类的英文名称（对应 OWL 构造名） */
export const PROPERTY_KIND_OWL: Record<PropertyKind, string> = {
  objectProperty: 'ObjectProperty',
  dataProperty: 'DataProperty',
  annotationProperty: 'AnnotationProperty',
}

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/** 生成唯一 id，如 cls_a1b2c3 */
export function generateId(prefix: string): string {
  let s = ''
  for (let i = 0; i < 8; i++) {
    s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]
  }
  return `${prefix}_${s}`
}

/** 从完整 IRI 中取本地名称（最后一段） */
export function toLocalName(iri: string): string {
  const trimmed = iri.trim().replace(/^<|>$/g, '')
  const sharp = trimmed.lastIndexOf('#')
  const slash = trimmed.lastIndexOf('/')
  const idx = Math.max(sharp, slash)
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed
}

/** 在命名空间下构建实体 IRI */
export function buildIri(namespace: string, name: string): string {
  const ns = namespace.endsWith('#') || namespace.endsWith('/') ? namespace : `${namespace}#`
  return `${ns}${name}`
}

/** 校验 IRI 是否符合基本规范 */
export function isValidIri(iri: string): boolean {
  if (!iri || iri.length > 500) return false
  try {
    // eslint-disable-next-line no-new
    new URL(iri)
    return true
  } catch {
    // 允许 URN 形式（如 urn:isbn:...）
    return /^urn:[a-z0-9][a-z0-9-]{1,31}:.+$/i.test(iri)
  }
}

/** 类名规范：不允许空白字符与保留符号，允许中文 */
export function isValidEntityName(name: string): boolean {
  if (!name || name.length > 100) return false
  if (/\s/.test(name)) return false
  if (/[<>{}|\\^`]/.test(name)) return false
  return true
}

/** 在项目中查找节点 */
export function findNode(ontology: Ontology, id: string): OntologyNode | undefined {
  return ontology.nodes.find((n) => n.id === id)
}

/** 查找节点显示名 */
export function nodeDisplayName(ontology: Ontology, id: string): string {
  const node = findNode(ontology, id)
  if (!node) return '未知节点'
  return node.label || node.name
}

/** 查找所有直接子类 id */
export function findSubclassIds(ontology: Ontology, classId: string): string[] {
  return ontology.edges
    .filter((e) => e.kind === 'subclass' && e.source === classId)
    .map((e) => e.target)
}

/** 检查项目中是否存在同名实体（类名或属性名），避免冲突 */
export function hasDuplicateName(
  ontology: Ontology,
  name: string,
  excludeEdgeId?: string,
): boolean {
  const clsDup = ontology.nodes.some((n) => n.name === name)
  const propDup = ontology.edges.some(
    (e) => e.kind !== 'subclass' && e.name === name && e.id !== excludeEdgeId,
  )
  return clsDup || propDup
}

/** 将节点类型分类为可创建列表 */
export function isClassNode(node: OntologyNode): node is ClassNode {
  return node.kind === 'class'
}
