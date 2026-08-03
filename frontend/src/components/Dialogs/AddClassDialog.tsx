import { useMemo, useState } from 'react'
import { Boxes } from 'lucide-react'
import Button from '../common/Button'
import Input, { Textarea } from '../common/Input'
import Modal from '../common/Modal'
import Select from '../common/Select'
import { safeLocalName, useOntologyStore } from '../../store/ontologyStore'
import { useUiStore } from '../../store/uiStore'
import { buildIri, hasDuplicateName, isValidEntityName, nodeDisplayName } from '../../utils/helpers'
import { validateClassForm } from '../../utils/validators'
import { HELP } from '../../utils/helpTexts'

/** 添加类表单（对话框与侧边面板共用） */
export function AddClassForm({ onDone }: { onDone?: () => void }) {
  const { ontology, layout, addClass, addEdge, setNodePosition } = useOntologyStore()
  const showToast = useUiStore((s) => s.showToast)
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')
  const [comment, setComment] = useState('')
  const [parentId, setParentId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const classes = useMemo(() => ontology.nodes.filter((n) => n.kind === 'class'), [ontology.nodes])

  const submit = () => {
    const trimmed = name.trim()
    const v = validateClassForm({ name: trimmed, label, comment, ontologyIri: ontology.ontologyIri })
    if (!v.ok) {
      setError(v.message ?? '校验失败')
      return
    }
    if (!isValidEntityName(trimmed)) {
      setError('类名不能包含空格及保留字符')
      return
    }
    if (hasDuplicateName(ontology, trimmed)) {
      setError(`已存在同名实体「${trimmed}」，请更换类名`)
      return
    }
    const id = addClass({
      name: trimmed,
      iri: buildIri(ontology.ontologyIri, safeLocalName(trimmed)),
      label: label.trim() || undefined,
      comment: comment.trim() || undefined,
    })
    if (!id) {
      setError('创建失败，请重试')
      return
    }
    // 选择了父类：自动建立子类关系，并把新类放到父类下方（获得正确的层级颜色）
    if (parentId) {
      addEdge({ kind: 'subclass', source: id, target: parentId })
      const parentPos = layout[parentId]
      if (parentPos) {
        setNodePosition(id, { x: parentPos.x, y: parentPos.y + 200 })
      }
    }
    showToast(`已创建类「${label.trim() || trimmed}」${parentId ? `（${nodeDisplayName(ontology, parentId)} 的子类）` : ''}`, 'success')
    setName('')
    setLabel('')
    setComment('')
    setParentId('')
    setError(null)
    onDone?.()
  }

  return (
    <div className="space-y-4">
      <Input
        label="类名（IRI 本地名）"
        labelTip={HELP.className}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="如：分项工程"
        hint={`将生成 IRI：${buildIri(ontology.ontologyIri, safeLocalName(name.trim() || '类'))}`}
      />
      <Input
        label="中文显示名"
        labelTip={HELP.displayName}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="如：分项工程"
      />
      <Select
        label="父类（可选）"
        labelTip={HELP.parentClass}
        value={parentId}
        onChange={(e) => setParentId(e.target.value)}
        options={[{ value: '', label: '（不设置，作为根类）' }, ...classes.map((c) => ({ value: c.id, label: nodeDisplayName(ontology, c.id) }))]}
      />
      <Textarea
        label="注释（rdfs:comment）"
        labelTip={HELP.comment}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="对类的说明，将写入 OWL 文件的 rdfs:comment"
        rows={3}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <Button variant="primary" icon={<Boxes size={16} />} onClick={submit}>
          创建类
        </Button>
      </div>
    </div>
  )
}

/** 添加类对话框 */
export default function AddClassDialog() {
  const open = useUiStore((s) => s.dialogs.addClass)
  const closeDialog = useUiStore((s) => s.closeDialog)

  return (
    <Modal title="添加类（Class）" open={open} onClose={() => closeDialog('addClass')}>
      <AddClassForm onDone={() => closeDialog('addClass')} />
    </Modal>
  )
}
