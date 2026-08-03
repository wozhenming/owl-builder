import { create } from 'zustand'
import type { Ontology } from '../types/ontology'

/** 本次打开项目期间的操作日志条目 */
export interface OperationLogEntry {
  id: string
  time: number
  /** 操作来源 */
  actor: 'user' | 'ai'
  /** 操作描述 */
  text: string
}

interface OperationLogState {
  logs: OperationLogEntry[]
  /** 内部：抑制下一次自动记录（撤销/重做恢复数据时使用） */
  _suppressNext: boolean
  /** 追加一条日志 */
  addLog: (actor: OperationLogEntry['actor'], text: string) => void
  /** 清空（打开新项目时调用） */
  resetLogs: () => void
  /** 抑制下一次自动记录 */
  suppressNextChange: () => void
}

let seq = 0

export const useOperationLogStore = create<OperationLogState>((set) => ({
  logs: [],
  _suppressNext: false,

  addLog: (actor, text) =>
    set((s) => ({
      logs: [...s.logs.slice(-99), { id: `log_${++seq}`, time: Date.now(), actor, text }],
    })),

  resetLogs: () => set({ logs: [], _suppressNext: false }),

  suppressNextChange: () => set({ _suppressNext: true }),
}))

// ---------------------------------------------------------------------------
// 自动记录用户的本体编辑操作（订阅 ontology 变更，diff 生成描述）
// ---------------------------------------------------------------------------

import { useOntologyStore } from './ontologyStore'

function describeChange(prev: Ontology, next: Ontology): string | null {
  const prevNodes = new Map(prev.nodes.map((n) => [n.id, n]))
  const added = next.nodes.filter((n) => !prevNodes.has(n.id))
  const removed = prev.nodes.filter((n) => !next.nodes.some((x) => x.id === n.id))
  if (added.length) return `添加 ${added.map((n) => n.label || n.name).join('、')}`
  if (removed.length) return `删除 ${removed.map((n) => n.label || n.name).join('、')}`

  const prevEdges = new Map(prev.edges.map((e) => [e.id, e]))
  const addedE = next.edges.filter((e) => !prevEdges.has(e.id))
  const removedE = prev.edges.filter((e) => !next.edges.some((x) => x.id === e.id))
  if (addedE.length) return `添加关系 ${addedE.map((e) => e.label || e.name || e.kind).join('、')}`
  if (removedE.length) return `删除关系 ${removedE.map((e) => e.label || e.name || e.kind).join('、')}`
  return null // 仅属性编辑等不产生节点/边增删的变更不记录
}

useOntologyStore.subscribe((state, prevState) => {
  if (state.ontology === prevState.ontology) return
  const store = useOperationLogStore.getState()
  if (store._suppressNext) {
    useOperationLogStore.setState({ _suppressNext: false })
    return
  }
  const text = describeChange(prevState.ontology, state.ontology)
  if (text) store.addLog('user', text)
})
