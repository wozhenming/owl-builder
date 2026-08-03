import { create } from 'zustand'
import type { NodeLayoutMap, Ontology } from '../types/ontology'

/**
 * 撤销/重做历史状态。
 *
 * 实现方式：每次「提交」都把 { nodes, edges, meta, layout } 快照压入 past 栈，
 * 撤销 = 弹出一份快照恢复，并把当前状态压入 future 栈。
 * 由于本体数据量小（几十~几百个实体），快照方式简单可靠。
 * layout 也纳入快照：拖拽节点、自动排版同样支持撤销/重做。
 */

export interface HistorySnapshot {
  nodes: Ontology['nodes']
  edges: Ontology['edges']
  name: string
  ontologyIri: string
  description: string
  version: string
  /** 节点布局（画布坐标），随快照一起保存/恢复 */
  layout: NodeLayoutMap
}

interface HistoryState {
  past: HistorySnapshot[]
  future: HistorySnapshot[]

  /** 记录一次数据变更（在调用 ontologyStore 的变更 action 之后调用） */
  push: (snapshot: HistorySnapshot) => void
  /** 撤销：弹出 past 顶部快照（调用方随后恢复它，并把当前状态 recordFuture） */
  undo: () => HistorySnapshot | null
  /** 重做：弹出 future 顶部快照（调用方随后恢复它，并把当前状态 recordPast） */
  redo: () => HistorySnapshot | null
  /** 把当前状态记入 future（撤销时调用），供重做使用 */
  recordFuture: (snapshot: HistorySnapshot) => void
  /** 把当前状态记入 past（重做时调用） */
  recordPast: (snapshot: HistorySnapshot) => void
  canUndo: () => boolean
  canRedo: () => boolean
  reset: () => void
}

const MAX_HISTORY = 100

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],

  push: (snapshot) =>
    set((s) => ({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), snapshot],
      future: [],
    })),

  undo: () => {
    const { past } = get()
    if (past.length === 0) return null
    const prev = past[past.length - 1]
    set({ past: past.slice(0, -1) })
    return prev
  },

  redo: () => {
    const { future } = get()
    if (future.length === 0) return null
    const next = future[future.length - 1]
    set({ future: future.slice(0, -1) })
    return next
  },

  recordFuture: (snapshot) =>
    set((s) => ({ future: [...s.future.slice(-(MAX_HISTORY - 1)), snapshot] })),
  recordPast: (snapshot) =>
    set((s) => ({ past: [...s.past.slice(-(MAX_HISTORY - 1)), snapshot] })),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  reset: () => set({ past: [], future: [] }),
}))

/** 从当前本体与布局构建历史快照 */
export function snapshotFrom(ontology: Ontology, layout: NodeLayoutMap): HistorySnapshot {
  return {
    nodes: ontology.nodes,
    edges: ontology.edges,
    name: ontology.name,
    ontologyIri: ontology.ontologyIri,
    description: ontology.description,
    version: ontology.version,
    layout,
  }
}

/** 兼容旧签名（仅本体，布局取空） */
export function snapshotFromOntology(ontology: Ontology): HistorySnapshot {
  return snapshotFrom(ontology, {})
}

/** 将快照恢复为完整本体（保留 projectId 与布局相关字段） */
export function applySnapshot(snapshot: HistorySnapshot, base: Ontology): Ontology {
  return {
    ...base,
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    name: snapshot.name,
    ontologyIri: snapshot.ontologyIri,
    description: snapshot.description,
    version: snapshot.version,
    updatedAt: Date.now(),
  }
}
