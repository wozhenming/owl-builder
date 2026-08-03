import { useCallback, useEffect, useRef } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import Toolbar from './Toolbar'
import GraphView from './GraphView'
import SidePanel from './SidePanel'
import UnsavedDialog from './Dialogs/UnsavedDialog'
import { useOntology, useOntologyData } from '../hooks/useOntology'
import { useHistoryShortcuts } from '../hooks/useHistory'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useOntologyStore } from '../store/ontologyStore'
import { useUiStore } from '../store/uiStore'

/** 读取当前未保存状态（事件回调内使用，避免订阅渲染） */
function isDirty(): boolean {
  return useOntologyStore.getState().dirty
}

interface EditorScreenProps {
  projectId: string
  onBack: () => void
}

/** 编辑器主界面：工具栏 + 画布 + 侧边面板 */
export default function EditorScreen({ projectId, onBack }: EditorScreenProps) {
  const handle = useOntology()
  const { loaded, busy, error } = useOntologyData()
  const loadedRef = useRef<string | null>(null)

  useHistoryShortcuts(handle.undo, handle.redo)
  useKeyboardShortcuts({ onSave: handle.save })

  useEffect(() => {
    if (loadedRef.current !== projectId) {
      loadedRef.current = projectId
      void handle.loadProject(projectId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // 返回项目列表：有未保存修改时先询问
  const handleBack = useCallback(() => {
    if (isDirty()) {
      useUiStore.getState().showUnsavedDialog()
    } else {
      onBack()
    }
  }, [onBack])

  // 关闭/刷新浏览器标签页：有未保存修改时触发原生确认
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const saveAndExit = useCallback(async () => {
    await handle.save()
    onBack()
  }, [handle, onBack])

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Toolbar
        projectName={handle.summary?.name ?? '未命名项目'}
        backendAvailable={handle.backendAvailable}
        onBack={handleBack}
        onSave={() => void handle.save()}
        onUndo={handle.undo}
        onRedo={handle.redo}
        canUndo={handle.canUndo}
        canRedo={handle.canRedo}
      />

      {error && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <AlertCircle size={15} />
          <span>{error}</span>
          <button className="ml-auto text-red-500 hover:text-red-700" onClick={() => handle.undo()}>
            撤销
          </button>
        </div>
      )}

      <div className="relative flex flex-1 overflow-hidden">
        {(!loaded || busy) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="animate-spin" size={18} />
              {busy ? '正在保存…' : '正在加载项目…'}
            </div>
          </div>
        )}
        <div className="flex-1">
          <GraphView />
        </div>
        <SidePanel />
      </div>

      {/* 未保存退出确认 */}
      <UnsavedDialog
        onSaveAndExit={() => void saveAndExit()}
        onDiscardAndExit={() => {
          useUiStore.getState().hideUnsavedDialog()
          onBack()
        }}
      />
    </div>
  )
}
