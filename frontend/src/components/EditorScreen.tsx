import { useEffect, useRef } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import Toolbar from './Toolbar'
import GraphView from './GraphView'
import SidePanel from './SidePanel'
import { useOntology, useOntologyData } from '../hooks/useOntology'
import { useHistoryShortcuts } from '../hooks/useHistory'

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

  useEffect(() => {
    if (loadedRef.current !== projectId) {
      loadedRef.current = projectId
      void handle.loadProject(projectId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Toolbar
        projectName={handle.summary?.name ?? '未命名项目'}
        backendAvailable={handle.backendAvailable}
        onBack={onBack}
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
    </div>
  )
}
