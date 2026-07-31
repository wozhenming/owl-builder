import { Box, Link2, Type } from 'lucide-react'
import Button from '../common/Button'
import { AddClassForm } from '../Dialogs/AddClassDialog'
import { AddPropertyForm } from '../Dialogs/AddPropertyDialog'
import { useOntologyStore } from '../../store/ontologyStore'
import { useUiStore } from '../../store/uiStore'
import type { AddViewTab } from '../../store/uiStore'
import { XSD_DATATYPES } from '../../utils/helpers'

const TABS: Array<{ key: AddViewTab; label: string; icon: React.ReactNode }> = [
  { key: 'class', label: '类', icon: <Box size={14} /> },
  { key: 'property', label: '属性', icon: <Link2 size={14} /> },
  { key: 'datatype', label: '数据类型', icon: <Type size={14} /> },
]

/** 快速添加数据类型（从 XSD 标准类型选择） */
function DatatypeQuickAdd() {
  const addDatatype = useOntologyStore((s) => s.addDatatype)
  const nodes = useOntologyStore((s) => s.ontology.nodes)
  const showToast = useUiStore((s) => s.showToast)

  const existingNames = new Set(nodes.filter((n) => n.kind === 'datatype').map((n) => n.name))

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">选择标准 XML Schema 数据类型，添加为图中的节点：</p>
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {XSD_DATATYPES.map((d) => {
          const exists = existingNames.has(d.name)
          return (
            <button
              key={d.name}
              disabled={exists}
              onClick={() => {
                addDatatype({ name: d.name, iri: d.iri, label: d.label })
                showToast(`已添加数据类型「${d.label ?? d.name}」`, 'success')
              }}
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                exists
                  ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                  : 'border-slate-200 hover:border-primary-300 hover:bg-primary-50'
              }`}
            >
              <span className="font-medium">{d.label ?? d.name}</span>
              <span className="font-mono text-xs text-slate-400">{d.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** 添加视图：快速创建类 / 属性 / 数据类型 */
export default function AddView() {
  const addTab = useUiStore((s) => s.addTab)
  const setAddTab = useUiStore((s) => s.setAddTab)

  return (
    <div className="space-y-4">
      {/* 子标签切换 */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setAddTab(t.key)}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
              addTab === t.key ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {addTab === 'class' && (
        <>
          <p className="text-xs text-slate-400">创建后点击画布空白处可取消选中</p>
          <AddClassForm />
        </>
      )}
      {addTab === 'property' && (
        <>
          <p className="text-xs text-slate-400">也可在画布中直接拖拽连线，系统将自动预填定义域与值域</p>
          <AddPropertyForm />
        </>
      )}
      {addTab === 'datatype' && <DatatypeQuickAdd />}

      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-400">
        <p className="font-medium text-slate-500">小提示</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>类名和属性名会直接用作 IRI 本地名，建议使用中文简写</li>
          <li>中文显示名用于画布展示与 OWL rdfs:label</li>
          <li>所有操作均可通过 Ctrl+Z 撤销</li>
        </ul>
      </div>
    </div>
  )
}

/** 供外部使用的便捷按钮（工具栏复用） */
export function AddViewButtons() {
  const openDialog = useUiStore((s) => s.openDialog)
  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => openDialog('addClass')}>
        <Box size={13} /> 添加类
      </Button>
      <Button variant="secondary" size="sm" onClick={() => openDialog('addProperty')}>
        <Link2 size={13} /> 添加属性
      </Button>
    </div>
  )
}
