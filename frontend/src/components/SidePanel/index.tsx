import { useCallback, useEffect, useState } from 'react'
import { Code2, ListPlus, Settings2 } from 'lucide-react'
import type { SidePanelTab } from '../../store/uiStore'
import { useUiStore } from '../../store/uiStore'
import DetailView from './DetailView'
import AddView from './AddView'
import CodeView from './CodeView'

const TABS: Array<{ key: SidePanelTab; label: string; icon: React.ReactNode }> = [
  { key: 'detail', label: '详情', icon: <Settings2 size={14} /> },
  { key: 'add', label: '添加', icon: <ListPlus size={14} /> },
  { key: 'code', label: '源码', icon: <Code2 size={14} /> },
]

const DEFAULT_WIDTH = 320
const MIN_WIDTH = 260
const MAX_WIDTH = 560
const WIDTH_KEY = 'cost-ontology:panel-width'

function clampWidth(n: number) {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n))
}

/** 面板宽度状态：可拖拽调整，持久化到 localStorage */
function usePanelWidth() {
  const [width, setWidth] = useState(() => {
    try {
      const saved = localStorage.getItem(WIDTH_KEY)
      const n = saved ? parseInt(saved, 10) : NaN
      return Number.isFinite(n) ? clampWidth(n) : DEFAULT_WIDTH
    } catch {
      return DEFAULT_WIDTH
    }
  })
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_KEY, String(width))
    } catch {
      /* 忽略 */
    }
  }, [width])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      setWidth(clampWidth(window.innerWidth - e.clientX))
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  const startDrag = useCallback(() => setDragging(true), [])
  return { width, dragging, startDrag }
}

/** 右侧面板容器：详情 / 添加 / 源码（宽度可拖拽调整） */
export default function SidePanel() {
  const panelTab = useUiStore((s) => s.panelTab)
  const setPanelTab = useUiStore((s) => s.setPanelTab)
  const { width, dragging, startDrag } = usePanelWidth()

  return (
    <div className="flex h-full shrink-0">
      {/* 拖拽分隔条 */}
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={startDrag}
        className={`group w-1.5 shrink-0 cursor-col-resize transition-colors ${
          dragging ? 'bg-primary-400' : 'bg-transparent hover:bg-primary-200'
        }`}
        title="拖拽调整面板宽度"
      >
        <div className="h-full w-px bg-slate-200 group-hover:bg-primary-300" />
      </div>

      <aside className="flex h-full flex-col border-l border-slate-200 bg-white" style={{ width }}>
        {/* 标签栏 */}
        <div className="flex items-center gap-1 border-b border-slate-200 px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setPanelTab(t.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                panelTab === t.key
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4">
          {panelTab === 'detail' && <DetailView />}
          {panelTab === 'add' && <AddView />}
          {panelTab === 'code' && (
            <div className="flex h-full flex-col">
              <CodeView />
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
