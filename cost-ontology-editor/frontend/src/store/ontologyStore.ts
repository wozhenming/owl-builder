import { create } from 'zustand'
import type {
  ClassNode,
  DatatypeNode,
  EdgeKind,
  NodeLayout,
  NodeLayoutMap,
  Ontology,
  OntologyEdge,
  OntologyNode,
} from '../types/ontology'
import { generateId } from '../utils/helpers'

/**
 * 本体数据状态 —— 本体内容（节点/边）的单一数据源。
 *
 * 所有变更操作都同时写入 historyStore 的撤销栈，
 * 因此这里只负责数据本身，不关心历史记录。
 */

interface OntologyState {
  /** 当前编辑的本体 */
  ontology: Ontology
  /** 节点在画布上的布局（与本体数据分离，避免撤销时丢失位置） */
  layout: NodeLayoutMap
  /** 是否已加载 */
  loaded: boolean
  /** 是否未保存 */
  dirty: boolean
  /** 保存/加载过程中的错误提示 */
  error: string | null
  /** 正在执行异步操作 */
  busy: boolean

  // ---- 加载与重置 ----
  setOntology: (ontology: Ontology, layout?: NodeLayoutMap) => void
  markSaved: () => void
  markDirty: () => void
  setError: (message: string | null) => void
  setBusy: (busy: boolean) => void

  // ---- 节点操作 ----
  addClass: (data: { name: string; iri: string; label?: string; comment?: string }) => string
  addDatatype: (data: { name: string; iri: string; label?: string; comment?: string }) => string
  updateNode: (id: string, patch: Partial<Omit<OntologyNode, 'id' | 'kind'>>) => void
  removeNode: (id: string) => void

  // ---- 边操作 ----
  addEdge: (data: {
    kind: EdgeKind
    source: string
    target: string
    name?: string
    iri?: string
    label?: string
    comment?: string
  }) => string
  updateEdge: (id: string, patch: Partial<Omit<OntologyEdge, 'id'>>) => void
  removeEdge: (id: string) => void

  // ---- 项目信息 ----
  updateMeta: (patch: Partial<Pick<Ontology, 'name' | 'ontologyIri' | 'description' | 'version'>>) => void

  // ---- 布局 ----
  setLayout: (layout: NodeLayoutMap) => void
  setNodePosition: (id: string, position: NodeLayout) => void
}

/** 创建空的本体 */
export function createEmptyOntology(name = '未命名本体', ontologyIri = 'http://example.org/cost-ontology#'): Ontology {
  const now = Date.now()
  return {
    projectId: null,
    name,
    ontologyIri,
    description: '',
    version: '1.0.0',
    nodes: [],
    edges: [],
    updatedAt: now,
  }
}

/** 生成合法的本地名（去除不可用于 IRI 的字符） */
function safeLocalName(name: string): string {
  const cleaned = name.trim().replace(/[^\p{L}\p{N}_\-.]/gu, '_')
  return cleaned || `entity_${Date.now().toString(36)}`
}

export const useOntologyStore = create<OntologyState>((set, get) => ({
  ontology: createEmptyOntology(),
  layout: {},
  loaded: false,
  dirty: false,
  error: null,
  busy: false,

  setOntology: (ontology, layout) =>
    set({ ontology, layout: layout ?? {}, loaded: true, dirty: false, error: null }),

  markSaved: () => set({ dirty: false }),
  markDirty: () => set({ dirty: true }),

  setError: (message) => set({ error: message }),
  setBusy: (busy) => set({ busy }),

  addClass: ({ name, iri, label, comment }) => {
    const ontology = get().ontology
    const id = generateId('cls')
    const node: ClassNode = {
      id,
      kind: 'class',
      name,
      iri,
      label,
      comment,
      createdAt: Date.now(),
    }
    set({
      ontology: { ...ontology, nodes: [...ontology.nodes, node], updatedAt: Date.now() },
      dirty: true,
    })
    return id
  },

  addDatatype: ({ name, iri, label, comment }) => {
    const ontology = get().ontology
    const existing = ontology.nodes.find((n) => n.kind === 'datatype' && n.name === name)
    if (existing) return existing.id
    const id = generateId('dty')
    const node: DatatypeNode = {
      id,
      kind: 'datatype',
      name,
      iri,
      label,
      comment,
      createdAt: Date.now(),
    }
    set({
      ontology: { ...ontology, nodes: [...ontology.nodes, node], updatedAt: Date.now() },
      dirty: true,
    })
    return id
  },

  updateNode: (id, patch) => {
    const ontology = get().ontology
    set({
      ontology: {
        ...ontology,
        nodes: ontology.nodes.map((n) =>
          n.id === id ? ({ ...n, ...patch } as OntologyNode) : n,
        ),
        updatedAt: Date.now(),
      },
      dirty: true,
    })
  },

  removeNode: (id) => {
    const ontology = get().ontology
    // 级联删除与该节点相连的边
    const edges = ontology.edges.filter((e) => e.source !== id && e.target !== id)
    set({
      ontology: {
        ...ontology,
        nodes: ontology.nodes.filter((n) => n.id !== id),
        edges,
        updatedAt: Date.now(),
      },
      dirty: true,
    })
  },

  addEdge: ({ kind, source, target, name, iri, label, comment }) => {
    const ontology = get().ontology
    // 同一对节点间不允许重复创建同类关系
    const duplicated = ontology.edges.some(
      (e) => e.kind === kind && e.source === source && e.target === target,
    )
    if (duplicated) return ''
    const id = generateId(kind === 'subclass' ? 'sub' : 'prp')
    const edge: OntologyEdge = {
      id,
      kind,
      source,
      target,
      name,
      iri,
      label,
      comment,
      createdAt: Date.now(),
    }
    set({
      ontology: { ...ontology, edges: [...ontology.edges, edge], updatedAt: Date.now() },
      dirty: true,
    })
    return id
  },

  updateEdge: (id, patch) => {
    const ontology = get().ontology
    set({
      ontology: {
        ...ontology,
        edges: ontology.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        updatedAt: Date.now(),
      },
      dirty: true,
    })
  },

  removeEdge: (id) => {
    const ontology = get().ontology
    set({
      ontology: {
        ...ontology,
        edges: ontology.edges.filter((e) => e.id !== id),
        updatedAt: Date.now(),
      },
      dirty: true,
    })
  },

  updateMeta: (patch) =>
    set((state) => ({
      ontology: { ...state.ontology, ...patch, updatedAt: Date.now() },
      dirty: true,
    })),

  setLayout: (layout) => set({ layout }),
  setNodePosition: (id, position) =>
    set((state) => ({ layout: { ...state.layout, [id]: position } })),
}))

// ---------------------------------------------------------------------------
// 自动历史记录：订阅本体变化，每次变更前把旧状态压入撤销栈。
// 撤销/重做时通过 suppressHistoryPush 跳过，避免污染历史。
// ---------------------------------------------------------------------------

import { snapshotFromOntology, useHistoryStore } from './historyStore'

let historySuppressed = false

/** 在函数执行期间禁止自动压入历史（用于撤销/重做/加载场景） */
export function suppressHistoryPush(fn: () => void) {
  historySuppressed = true
  try {
    fn()
  } finally {
    historySuppressed = false
  }
}

useOntologyStore.subscribe((state, prevState) => {
  if (state.ontology !== prevState.ontology && !historySuppressed) {
    useHistoryStore.getState().push(snapshotFromOntology(prevState.ontology))
  }
})

/** 便捷工具：在 store 外根据名称生成 IRI */
export { safeLocalName }
