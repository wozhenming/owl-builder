import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { ProjectSummary } from '../types/api'
import type { Ontology } from '../types/ontology'
import { apiClient, ApiUnavailableError, isBackendAvailable } from '../services/apiClient'
import { localOntology, localProjects } from '../services/storageService'
import { applySnapshot, snapshotFrom, useHistoryStore } from '../store/historyStore'
import { createEmptyOntology, suppressHistoryPush, useOntologyStore } from '../store/ontologyStore'
import { useUiStore } from '../store/uiStore'

/**
 * 本体数据主 Hook：衔接 store、后端/本地持久化、撤销重做。
 *
 * 使用方式：
 *   const { ontology, layout, save, loadProject, undo, redo, ... } = useOntology()
 */

export interface ProjectHandle {
  summary: ProjectSummary | null
  backendAvailable: boolean | null
  createProject: (data: { name: string; description?: string; ontologyIri?: string }) => Promise<ProjectSummary>
  deleteProject: (id: string) => Promise<void>
  loadProject: (id: string) => Promise<void>
  /** 保存当前项目；返回是否保存成功 */
  save: () => Promise<boolean>
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

export function useOntology(): ProjectHandle {
  const [summary, setSummary] = useState<ProjectSummary | null>(null)
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null)
  const [, forceTick] = useState(0)
  const savingRef = useRef(false)

  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // 探测后端可用性
  useEffect(() => {
    isBackendAvailable().then((ok) => {
      setBackendAvailable(ok)
      // 后端可用时刷新项目列表缓存（用于保存路径选择）
      if (ok) {
        apiClient.listProjects().catch(() => undefined)
      }
    })
  }, [])

  // 监听历史栈变化
  useEffect(() => {
    const tick = () => {
      setCanUndo(useHistoryStore.getState().canUndo())
      setCanRedo(useHistoryStore.getState().canRedo())
      forceTick((n) => n + 1)
    }
    const unsub = useHistoryStore.subscribe(tick)
    return unsub
  }, [])

  /** 加载项目：优先后端，其次本地 */
  const loadProject = useCallback(
    async (id: string) => {
      const store = useOntologyStore.getState()
      store.setBusy(true)
      try {
        let next: Ontology | null = null
        let nextLayout: Record<string, { x: number; y: number }> = {}
        let found = false

        if (backendAvailable !== false) {
          try {
            const detail = await apiClient.getProject(id)
            setSummary({
              id: detail.id,
              name: detail.name,
              description: detail.description,
              createdAt: detail.createdAt,
              updatedAt: detail.updatedAt,
            })
            const stored = (detail.ontology ?? null) as unknown as
              | (Ontology & { layout?: Record<string, { x: number; y: number }> })
              | null
            if (stored) {
              // 布局随本体 JSON 一起持久化（保存时写入），加载时剥离
              const { layout: savedLayout, ...rest } = stored
              next = rest
              if (savedLayout) nextLayout = savedLayout
            }
            found = true
          } catch (e) {
            if (e instanceof ApiUnavailableError) {
              /* 后端不可用，走本地 */
            } else {
              throw e
            }
          }
        }
        if (!found) {
          const local = localOntology.load(id)
          const meta = localProjects.get(id)
          setSummary(meta)
          if (local) {
            next = local.ontology
            nextLayout = local.layout
          } else {
            next = createEmptyOntology(meta?.name ?? '未命名本体')
          }
        }

        suppressHistoryPush(() => {
          store.setOntology(next ?? createEmptyOntology(), nextLayout)
        })
        useHistoryStore.getState().reset()
        store.setError(null)
      } catch (e) {
        store.setError(e instanceof Error ? e.message : String(e))
        useUiStore.getState().showToast('加载项目失败', 'error')
      } finally {
        store.setBusy(false)
      }
    },
    [backendAvailable],
  )

  /** 保存：后端可用则保存到后端，否则保存到本地 */
  const save = useCallback(async () => {
    const store = useOntologyStore.getState()
    const current = store.ontology
    if (!current.projectId) {
      useUiStore.getState().showToast('尚未关联项目，请从项目列表进入', 'error')
      return false
    }
    if (savingRef.current) return false
    savingRef.current = true
    store.setBusy(true)
    try {
      // 布局（节点坐标）随本体一起持久化，保证保存后布局不丢失
      const payload = {
        ...current,
        layout: useOntologyStore.getState().layout,
      } as unknown as Record<string, unknown>
      if (backendAvailable !== false) {
        try {
          await apiClient.saveOntology(current.projectId, payload)
          store.markSaved()
          setSummary((s) => (s ? { ...s, updatedAt: new Date().toISOString() } : s))
          useUiStore.getState().showToast('已保存到服务器', 'success')
          return true
        } catch (e) {
          if (!(e instanceof ApiUnavailableError)) throw e
        }
      }
      // 降级到本地
      localOntology.save(current.projectId, current, useOntologyStore.getState().layout)
      store.markSaved()
      useUiStore.getState().showToast('已保存到本地浏览器', 'success')
      return true
    } catch (e) {
      useUiStore.getState().showToast(`保存失败：${e instanceof Error ? e.message : String(e)}`, 'error')
      return false
    } finally {
      savingRef.current = false
      store.setBusy(false)
    }
  }, [backendAvailable])

  /** 创建项目 */
  const createProject = useCallback(
    async (data: { name: string; description?: string; ontologyIri?: string }) => {
      if (backendAvailable !== false) {
        try {
          const p = await apiClient.createProject(data)
          setSummary(p)
          return p
        } catch (e) {
          if (!(e instanceof ApiUnavailableError)) throw e
        }
      }
      const p = localProjects.create(data)
      setSummary(p)
      return p
    },
    [backendAvailable],
  )

  const deleteProject = useCallback(
    async (id: string) => {
      if (backendAvailable !== false) {
        try {
          await apiClient.deleteProject(id)
          return
        } catch (e) {
          if (!(e instanceof ApiUnavailableError)) throw e
        }
      }
      localProjects.remove(id)
    },
    [backendAvailable],
  )

  /** 撤销 / 重做（同时恢复节点内容与布局） */
  const undo = useCallback(() => {
    const history = useHistoryStore.getState()
    const snap = history.undo()
    if (!snap) return
    const store = useOntologyStore.getState()
    // 把当前状态记入 future，供重做使用
    history.recordFuture(snapshotFrom(store.ontology, store.layout))
    suppressHistoryPush(() => {
      store.setOntology(applySnapshot(snap, store.ontology))
      store.setLayout(snap.layout ?? {})
      store.markDirty()
    })
    useUiStore.getState().clearSelection()
  }, [])

  const redo = useCallback(() => {
    const history = useHistoryStore.getState()
    const snap = history.redo()
    if (!snap) return
    const store = useOntologyStore.getState()
    // 把当前状态记入 past，供再次撤销使用
    history.recordPast(snapshotFrom(store.ontology, store.layout))
    suppressHistoryPush(() => {
      store.setOntology(applySnapshot(snap, store.ontology))
      store.setLayout(snap.layout ?? {})
      store.markDirty()
    })
    useUiStore.getState().clearSelection()
  }, [])

  return {
    summary,
    backendAvailable,
    createProject,
    deleteProject,
    loadProject,
    save,
    undo,
    redo,
    canUndo,
    canRedo,
  }
}

/**
 * 当前本体内容（便捷选择器）。
 *
 * 注意：必须用 useShallow —— zustand v5 的 useStore 在 selector 返回新对象时
 * 每次快照引用都不同，会被 React 判定为 store 持续变化而无限重渲染（白屏）。
 */
export function useOntologyData() {
  return useOntologyStore(
    useShallow((s) => ({
      ontology: s.ontology,
      layout: s.layout,
      dirty: s.dirty,
      busy: s.busy,
      error: s.error,
      loaded: s.loaded,
    })),
  )
}
