import { useEffect, useMemo, useState } from 'react'
import { Link2 } from 'lucide-react'
import Button from '../common/Button'
import Input, { Textarea } from '../common/Input'
import Modal from '../common/Modal'
import Select from '../common/Select'
import { safeLocalName, useOntologyStore } from '../../store/ontologyStore'
import { useUiStore } from '../../store/uiStore'
import type { EdgeKind, PropertyKind } from '../../types/ontology'
import { XSD_DATATYPES, buildIri, findNode, hasDuplicateName, isValidEntityName, nodeDisplayName } from '../../utils/helpers'
import { validatePropertyForm } from '../../utils/validators'
import { HELP } from '../../utils/helpTexts'
import Tooltip from '../common/Tooltip'

/** XSD 数据类型选项中「尚未添加为节点」的标记值 */
const XSD_MARKER = '__xsd__'

interface AddPropertyFormProps {
  onDone?: () => void
}

/** 添加属性表单（对话框与侧边面板共用） */
export function AddPropertyForm({ onDone }: AddPropertyFormProps) {
  const { ontology, addEdge, addDatatype } = useOntologyStore()
  const { pendingConnection, setPendingConnection, showToast } = useUiStore()

  const [kind, setKind] = useState<PropertyKind>('objectProperty')
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')
  const [comment, setComment] = useState('')
  const [functional, setFunctional] = useState(false)
  const [domain, setDomain] = useState('')
  const [range, setRange] = useState('')
  const [error, setError] = useState<string | null>(null)

  const classes = useMemo(() => ontology.nodes.filter((n) => n.kind === 'class'), [ontology.nodes])
  const datatypes = useMemo(() => {
    const existing = ontology.nodes.filter((n) => n.kind === 'datatype')
    const existingIris = new Set(existing.map((n) => n.iri))
    const missing = XSD_DATATYPES.filter((d) => !existingIris.has(d.iri)).map((d) => ({
      id: `${XSD_MARKER}${d.name}`,
      kind: 'datatype' as const,
      name: d.name,
      iri: d.iri,
      label: d.label,
      createdAt: 0,
    }))
    return [...existing, ...missing]
  }, [ontology.nodes])

  // 连线拖放后预填 domain/range
  useEffect(() => {
    if (pendingConnection) {
      setDomain(pendingConnection.source)
      setRange(pendingConnection.target)
      const targetNode = findNode(ontology, pendingConnection.target)
      if (targetNode?.kind === 'datatype') {
        setKind('dataProperty')
      } else {
        setKind('objectProperty')
      }
    }
  }, [pendingConnection, ontology])

  // 默认选中第一个类作为 domain（仅当不是从画布连线进入时，避免覆盖连线预填的起点）
  useEffect(() => {
    if (!domain && !pendingConnection && classes.length > 0) setDomain(classes[0].id)
  }, [classes, domain, pendingConnection])

  const rangeOptions = useMemo(() => {
    if (kind === 'dataProperty') {
      return datatypes.map((d) => ({
        value: d.id,
        label: d.label ?? d.name,
      }))
    }
    return classes.map((c) => ({ value: c.id, label: nodeDisplayName(ontology, c.id) }))
  }, [kind, datatypes, classes, ontology])

  // 切换 kind 时修正 range
  useEffect(() => {
    if (range && kind === 'dataProperty') {
      const isClass = classes.some((c) => c.id === range)
      if (isClass && datatypes.length > 0) setRange(datatypes[0].id)
    }
  }, [kind, range, classes, datatypes])

  const submit = () => {
    const trimmed = name.trim()
    const v = validatePropertyForm({
      name: trimmed,
      label,
      comment,
      source: domain,
      target: range,
    })
    if (!v.ok) {
      setError(v.message ?? '校验失败')
      return
    }
    if (!isValidEntityName(trimmed)) {
      setError('属性名不能包含空格及保留字符')
      return
    }
    if (hasDuplicateName(ontology, trimmed)) {
      setError(`已存在同名实体「${trimmed}」，请更换属性名`)
      return
    }
    // 解析 range：若为 XSD 标记，则先创建数据类型节点
    let targetId = range
    if (range.startsWith(XSD_MARKER)) {
      const xsd = XSD_DATATYPES.find((d) => `${XSD_MARKER}${d.name}` === range)
      if (xsd) {
        targetId = addDatatype({ name: xsd.name, iri: xsd.iri, label: xsd.label })
      }
    }
    const id = addEdge({
      kind: kind as EdgeKind,
      source: domain,
      target: targetId,
      name: trimmed,
      iri: buildIri(ontology.ontologyIri, safeLocalName(trimmed)),
      label: label.trim() || undefined,
      comment: comment.trim() || undefined,
      ...(functional ? { functional: true } : {}),
    })
    if (!id) {
      setError('创建失败：同一起点与终点间已存在同类关系')
      return
    }
    showToast(`已创建属性「${label.trim() || trimmed}」`, 'success')
    setPendingConnection(null)
    setName('')
    setLabel('')
    setComment('')
    setFunctional(false)
    setError(null)
    onDone?.()
  }

  return (
    <div className="space-y-4">
      <Select
        label="属性类型"
        labelTip={HELP.propKind}
        value={kind}
        onChange={(e) => setKind(e.target.value as PropertyKind)}
        options={[
          { value: 'objectProperty', label: '对象属性（类 → 类）' },
          { value: 'dataProperty', label: '数据属性（类 → 数据类型）' },
          { value: 'annotationProperty', label: '注解属性' },
        ]}
      />
      <Input
        label="属性名（IRI 本地名）"
        labelTip={HELP.propName}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="如：包含分项、单位造价"
        hint={`将生成 IRI：${buildIri(ontology.ontologyIri, safeLocalName(name.trim() || '属性'))}`}
      />
      <Input
        label="中文显示名"
        labelTip={HELP.displayName}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="如：单位造价"
      />
      <div className="grid grid-cols-1 gap-4">
        <Select
          label="定义域 Domain（起点）"
          labelTip={HELP.domain}
          required
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          options={classes.map((c) => ({ value: c.id, label: nodeDisplayName(ontology, c.id) }))}
        />
        <Select
          label="值域 Range（终点）"
          labelTip={HELP.range}
          required
          value={range}
          onChange={(e) => setRange(e.target.value)}
          options={rangeOptions}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <Tooltip content={HELP.functional} side="right">
          <span className="flex cursor-help items-center gap-2">
            <input
              type="checkbox"
              checked={functional}
              onChange={(e) => setFunctional(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            函数型属性（FunctionalProperty）
          </span>
        </Tooltip>
      </label>
      <Textarea
        label="注释（rdfs:comment）"
        labelTip={HELP.comment}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="对属性的说明"
        rows={2}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <Button variant="primary" icon={<Link2 size={16} />} onClick={submit}>
          创建属性
        </Button>
      </div>
    </div>
  )
}

/** 添加属性对话框（工具栏按钮与画布连线共用） */
export default function AddPropertyDialog() {
  const open = useUiStore((s) => s.dialogs.addProperty)
  const closeDialog = useUiStore((s) => s.closeDialog)
  const pendingConnection = useUiStore((s) => s.pendingConnection)
  const setPendingConnection = useUiStore((s) => s.setPendingConnection)

  return (
    <Modal
      title={pendingConnection ? '创建关系（已从画布连线预填）' : '添加属性（Property）'}
      open={open}
      onClose={() => {
        closeDialog('addProperty')
        setPendingConnection(null)
      }}
    >
      <AddPropertyForm
        onDone={() => {
          closeDialog('addProperty')
          setPendingConnection(null)
        }}
      />
    </Modal>
  )
}
