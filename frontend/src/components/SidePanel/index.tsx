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

/** 右侧面板容器：详情 / 添加 / 源码 */
export default function SidePanel() {
  const panelTab = useUiStore((s) => s.panelTab)
  const setPanelTab = useUiStore((s) => s.setPanelTab)

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
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
  )
}
