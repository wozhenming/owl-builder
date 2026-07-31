import { useState } from 'react'
import { Boxes } from 'lucide-react'
import Button from '../common/Button'
import Input, { Textarea } from '../common/Input'
import Modal from '../common/Modal'
import { safeLocalName, useOntologyStore } from '../../store/ontologyStore'
import { useUiStore } from '../../store/uiStore'
import { buildIri, hasDuplicateName, isValidEntityName } from '../../utils/helpers'
import { validateClassForm } from '../../utils/validators'

/** 添加类表单（对话框与侧边面板共用） */
export function AddClassForm({ onDone }: { onDone?: () => void }) {
  const { ontology, addClass } = useOntologyStore()
  const showToast = useUiStore((s) => s.showToast)
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

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
    showToast(`已创建类「${label.trim() || trimmed}」`, 'success')
    setName('')
    setLabel('')
    setComment('')
    setError(null)
    onDone?.()
  }

  return (
    <div className="space-y-4">
      <Input
        label="类名（IRI 本地名）"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="如：分项工程"
        hint={`将生成 IRI：${buildIri(ontology.ontologyIri, safeLocalName(name.trim() || '类'))}`}
      />
      <Input
        label="中文显示名"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="如：分项工程"
      />
      <Textarea
        label="注释（rdfs:comment）"
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
