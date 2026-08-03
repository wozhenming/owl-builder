import { create } from 'zustand'

/** 本次打开项目期间的操作日志条目 */
export interface OperationLogEntry {
  id: string
  time: number
  /** 操作来源 */
  actor: 'user' | 'ai'
  /** 操作描述 */
  text: string
  /** 该操作对应的历史栈长度（操作前）：撤回 = 撤销到 past.length === undoBefore */
  undoBefore: number
}

interface OperationLogState {
  logs: OperationLogEntry[]
  /** 追加一条日志（undoBefore 为该操作对应的历史栈位置，用于撤回） */
  addLog: (actor: OperationLogEntry['actor'], text: string, undoBefore: number) => void
  /** 清空（打开新项目时调用） */
  resetLogs: () => void
}

let seq = 0

export const useOperationLogStore = create<OperationLogState>((set) => ({
  logs: [],

  addLog: (actor, text, undoBefore) =>
    set((s) => ({
      logs: [...s.logs.slice(-99), { id: `log_${++seq}`, time: Date.now(), actor, text, undoBefore }],
    })),

  resetLogs: () => set({ logs: [] }),
}))
