import { create } from 'zustand'
import type { Ontology } from '../types/ontology'

/**
 * 撤销/重做历史状态。
 *
 * 实现方式：每次「提交」都把 { nodes, edges, meta } 快照压入 past 栈，
 * 撤销 = 弹出一份快照恢复，并把当前状态压入 future 栈。
 * 由于本体数据量小（几十~几百个实体），快照方式简单可靠。
 */

export interface HistorySnapshot {
  nodes: Ontology['nodes']
  edges: Ontology['edges']
  name: string
  ontologyIri: string
  description: string
  version: string
}

interface HistoryState {
  past: HistorySnapshot[]
  future: HistorySnapshot[]

  /** 记录一次数据变更（在调用 ontologyStore 的变更 action 之后调用） */
  push: (snapshot: HistorySnapshot) => void
  /** 撤销，返回应恢复的快照；无历史时返回 null */
  undo: () => HistorySnapshot | null
  /** 重做，返回应恢复的快照；无未来时返回 null */
  redo: () => HistorySnapshot | null
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
    const newPast = past.slice(0, -1)
    set({ past: newPast })
    return prev
  },

  redo: () => {
    const { past, future } = get()
    if (future.length === 0) return null
    const next = future[future.length - 1]
    set({ past: [...past, next], future: future.slice(0, -1) })
    return next
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  reset: () => set({ past: [], future: [] }),
}))

/** 从当前本体构建历史快照 */
export function snapshotFromOntology(ontology: Ontology): HistorySnapshot {
  return {
    nodes: ontology.nodes,
    edges: ontology.edges,
    name: ontology.name,
    ontologyIri: ontology.ontologyIri,
    description: ontology.description,
    version: ontology.version,
  }
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
