import { useState } from 'react'
import { Type } from 'lucide-react'
import Button from '../common/Button'
import Modal from '../common/Modal'
import { useOntologyStore } from '../../store/ontologyStore'
import { useUiStore } from '../../store/uiStore'
import { XSD_DATATYPES } from '../../utils/helpers'

/** 添加数据类型对话框（从 XSD 标准类型中选择） */
export default function AddDatatypeDialog() {
  const open = useUiStore((s) => s.dialogs.addDatatype)
  const closeDialog = useUiStore((s) => s.closeDialog)
  const showToast = useUiStore((s) => s.showToast)
  const addDatatype = useOntologyStore((s) => s.addDatatype)
  const nodes = useOntologyStore((s) => s.ontology.nodes)
  const [selected, setSelected] = useState<string>(XSD_DATATYPES[0]?.name ?? '')

  const existingNames = new Set(nodes.filter((n) => n.kind === 'datatype').map((n) => n.name))

  const submit = () => {
    const xsd = XSD_DATATYPES.find((d) => d.name === selected)
    if (!xsd) return
    addDatatype({ name: xsd.name, iri: xsd.iri, label: xsd.label })
    showToast(`已添加数据类型「${xsd.label ?? xsd.name}」`, 'success')
    closeDialog('addDatatype')
  }

  return (
    <Modal title="添加数据类型（Datatype）" open={open} onClose={() => closeDialog('addDatatype')}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          选择要在图中使用的数据类型。数据类型节点可作为「数据属性」的值域。
        </p>
        <div className="max-h-60 space-y-1 overflow-y-auto">
          {XSD_DATATYPES.map((d) => (
            <label
              key={d.name}
              className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${
                selected === d.name
                  ? 'border-primary-500 bg-primary-50 text-primary-800'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="font-medium">{d.label ?? d.name}</span>
              <span className="flex items-center gap-2 text-xs text-slate-400">
                {existingNames.has(d.name) && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">已存在</span>
                )}
                <input
                  type="radio"
                  name="datatype"
                  value={d.name}
                  checked={selected === d.name}
                  onChange={() => setSelected(d.name)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                />
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="primary" icon={<Type size={16} />} onClick={submit}>
            添加
          </Button>
        </div>
      </div>
    </Modal>
  )
}
