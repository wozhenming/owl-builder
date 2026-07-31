/**
 * 本体数据模型 —— 编辑器内部的统一数据结构。
 *
 * 设计思路：
 * - 图中所有可见实体都是「节点」（类 / 数据类型）
 * - 所有关系都是「边」（子类关系 / 对象属性 / 数据属性 / 注解属性）
 * - 属性（Property）以「边」的形式存在：domain 节点 -> range 节点，
 *   属性名、注释等元数据挂在边上，保证图形化编辑直观且可双向映射到 OWL。
 */

/** 节点类型 */
export type NodeKind = 'class' | 'datatype'

/** 边类型（同时对应 OWL 中的关系种类） */
export type EdgeKind = 'subclass' | 'objectProperty' | 'dataProperty' | 'annotationProperty'

/** 属性种类（去除 subclass 后即为 OWL 属性类型） */
export type PropertyKind = Exclude<EdgeKind, 'subclass'>

/** 类节点 */
export interface ClassNode {
  id: string
  kind: 'class'
  /** 本地名称（IRI 的最后一段），同时也是默认显示名 */
  name: string
  /** 完整 IRI */
  iri: string
  /** 中文显示名（可空，为空时用 name） */
  label?: string
  /** 中文注释 */
  comment?: string
  /** 创建时间戳（用于排序等） */
  createdAt: number
}

/** 数据类型节点（xsd:string、xsd:decimal 等，通常由系统预置） */
export interface DatatypeNode {
  id: string
  kind: 'datatype'
  name: string
  iri: string
  label?: string
  comment?: string
  createdAt: number
}

export type OntologyNode = ClassNode | DatatypeNode

/** 关系边 */
export interface OntologyEdge {
  id: string
  kind: EdgeKind
  /** 起点节点 id（subclass 时为子类；property 时为 domain） */
  source: string
  /** 终点节点 id（subclass 时为父类；property 时为 range） */
  target: string
  /** 属性名（仅 property 类型边使用） */
  name?: string
  /** 属性 IRI（仅 property 类型边使用） */
  iri?: string
  /** 中文显示名 */
  label?: string
  /** 中文注释 */
  comment?: string
  /** 是否为函数型属性（functional） */
  functional?: boolean
  createdAt: number
}

/** 完整本体文档 */
export interface Ontology {
  /** 关联的后端项目 id（未保存到后端时为 null） */
  projectId: string | null
  /** 项目名称 */
  name: string
  /** 本体 IRI（命名空间） */
  ontologyIri: string
  /** 项目描述 */
  description: string
  /** 版本号 */
  version: string
  nodes: OntologyNode[]
  edges: OntologyEdge[]
  updatedAt: number
}

/** 节点在画布上的位置（由 ReactFlow 管理，保存在 store 中以便持久化布局） */
export interface NodeLayout {
  x: number
  y: number
}

export type NodeLayoutMap = Record<string, NodeLayout>
