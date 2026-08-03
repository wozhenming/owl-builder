import { useEffect, useMemo, useState } from 'react'
import { Link2, MousePointerClick, Trash2 } from 'lucide-react'
import Button from '../common/Button'
import Input, { Textarea } from '../common/Input'
import Select from '../common/Select'
import { useOntologyStore } from '../../store/ontologyStore'
import { useUiStore } from '../../store/uiStore'
import type { OntologyEdge, OntologyNode, PropertyKind } from '../../types/ontology'
import { EDGE_KIND_LABELS, findNode, nodeDisplayName } from '../../utils/helpers'
import { HELP } from '../../utils/helpTexts'

/** 空状态 */
function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-slate-400">
      <MousePointerClick size={36} strokeWidth={1.5} />
      <p className="text-sm">在画布中点击类或关系边，<br />即可在此查看和编辑详情</p>
    </div>
  )
}

/** 节点详情 + 编辑表单 */
function NodeDetailView({ node }: { node: OntologyNode }) {
  const updateNode = useOntologyStore((s) => s.updateNode)
  const removeNode = useOntologyStore((s) => s.removeNode)
  const ontology = useOntologyStore((s) => s.ontology)
  const { selectNode, selectEdge, showToast, showConfirm } = useUiStore()

  const [name, setName] = useState(node.name)
  const [label, setLabel] = useState(node.label ?? '')
  const [comment, setComment] = useState(node.comment ?? '')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setName(node.name)
    setLabel(node.label ?? '')
    setComment(node.comment ?? '')
    setSaved(false)
  }, [node.id, node.name, node.label, node.comment])

  const related = useMemo(() => {
    const parents = ontology.edges.filter((e) => e.kind === 'subclass' && e.target === node.id)
    const children = ontology.edges.filter((e) => e.kind === 'subclass' && e.source === node.id)
    const outgoing = ontology.edges.filter((e) => e.kind !== 'subclass' && e.source === node.id)
    const incoming = ontology.edges.filter((e) => e.kind !== 'subclass' && e.target === node.id)
    return { parents, children, outgoing, incoming }
  }, [ontology.edges, node.id])

  const save = () => {
    updateNode(node.id, {
      name: name.trim() || node.name,
      label: label.trim() || undefined,
      comment: comment.trim() || undefined,
    })
    setSaved(true)
    showToast('已保存修改', 'success')
    setTimeout(() => setSaved(false), 1500)
  }

  const remove = () => {
    showConfirm(
      `删除${node.kind === 'datatype' ? '数据类型' : '类'}`,
      `确定删除「${node.label || node.name}」吗？将同时删除与其相连的全部关系边。`,
      () => {
        removeNode(node.id)
        selectNode(null)
        showToast('已删除，可用 Ctrl+Z 撤销', 'info')
      },
    )
  }

  const RelationList = ({ title, edges, empty }: { title: string; edges: OntologyEdge[]; empty: string }) =>
    edges.length === 0 ? null : (
      <div>
        <p className="mb-1 text-xs font-medium text-slate-400">{title}</p>
        <ul className="space-y-0.5">
          {edges.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => selectEdge(e.id)}
                className="group flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs text-slate-600 hover:bg-slate-100"
              >
                <Link2 size={12} className="shrink-0 text-slate-300 group-hover:text-primary-500" />
                <span className="truncate">
                  {e.kind === 'subclass'
                    ? `子类 → ${nodeDisplayName(ontology, e.target)}`
                    : `${e.label || e.name || '(未命名)'} → ${nodeDisplayName(ontology, e.target)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {edges.length === 0 && <p className="text-xs text-slate-300">{empty}</p>}
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            node.kind === 'class' ? 'bg-primary-100 text-primary-700' : 'bg-violet-100 text-violet-700'
          }`}
        >
          {node.kind === 'class' ? '类 Class' : '数据类型 Datatype'}
        </span>
        <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={remove}>
          删除
        </Button>
      </div>

      <Input label="IRI 本地名" labelTip={HELP.className} value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="中文显示名" labelTip={HELP.displayName} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="显示在画布上的名称" />
      <Textarea label="注释" labelTip={HELP.comment} value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
      <div>
        <p className="mb-1 text-xs font-medium text-slate-400">完整 IRI</p>
        <p className="break-all rounded bg-slate-50 px-2 py-1.5 font-mono text-[11px] text-slate-500" title={node.iri}>
          {node.iri}
        </p>
      </div>

      <Button variant={saved ? 'success' : 'primary'} className="w-full" onClick={save} disabled={saved}>
        {saved ? '已保存 ✓' : '保存修改'}
      </Button>

      <div className="space-y-3 border-t border-slate-100 pt-3">
        {node.kind === 'class' ? (
          <>
            <RelationList title="父类（superClassOf）" edges={related.parents} empty="未设置父类" />
            <RelationList title="子类" edges={related.children} empty="没有子类" />
            <RelationList title="发出的属性" edges={related.outgoing} empty="没有从该类发出的属性" />
            <RelationList title="指向本类的属性" edges={related.incoming} empty="没有指向该类的属性" />
          </>
        ) : (
          <RelationList title="作为值域被使用" edges={related.incoming} empty="暂无属性使用该数据类型" />
        )}
      </div>
    </div>
  )
}

/** 关系边详情 + 编辑表单 */
function EdgeDetailView({ edge }: { edge: OntologyEdge }) {
  const { ontology, updateEdge, removeEdge } = useOntologyStore()
  const { selectEdge, showToast, showConfirm } = useUiStore()

  const [kind, setKind] = useState<PropertyKind>(edge.kind === 'subclass' ? 'objectProperty' : edge.kind)
  const [name, setName] = useState(edge.name ?? '')
  const [label, setLabel] = useState(edge.label ?? '')
  const [comment, setComment] = useState(edge.comment ?? '')
  const [functional, setFunctional] = useState(edge.functional ?? false)
  const [source, setSource] = useState(edge.source)
  const [target, setTarget] = useState(edge.target)

  useEffect(() => {
    setKind(edge.kind === 'subclass' ? 'objectProperty' : edge.kind)
    setName(edge.name ?? '')
    setLabel(edge.label ?? '')
    setComment(edge.comment ?? '')
    setFunctional(edge.functional ?? false)
    setSource(edge.source)
    setTarget(edge.target)
  }, [edge])

  const classes = ontology.nodes.filter((n) => n.kind === 'class')
  const datatypes = ontology.nodes.filter((n) => n.kind === 'datatype')
  const isDataProperty = kind === 'dataProperty'

  const rangeOptions = isDataProperty
    ? datatypes.map((d) => ({ value: d.id, label: d.label ?? d.name }))
    : classes.map((c) => ({ value: c.id, label: nodeDisplayName(ontology, c.id) }))

  const domainOptions = classes.map((c) => ({ value: c.id, label: nodeDisplayName(ontology, c.id) }))

  const save = () => {
    updateEdge(edge.id, {
      kind,
      name: name.trim() || undefined,
      label: label.trim() || undefined,
      comment: comment.trim() || undefined,
      functional,
      source,
      target,
    })
    showToast('已保存修改', 'success')
  }

  const remove = () => {
    showConfirm(
      '删除关系',
      `确定删除「${edge.label || edge.name || '该关系'}」吗？`,
      () => {
        removeEdge(edge.id)
        selectEdge(null)
        showToast('已删除，可用 Ctrl+Z 撤销', 'info')
      },
    )
  }

  const isSubclass = edge.kind === 'subclass'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {EDGE_KIND_LABELS[edge.kind]}
        </span>
        <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={remove}>
          删除
        </Button>
      </div>

      {!isSubclass && (
        <>
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
          <Input label="属性名（IRI 本地名）" labelTip={HELP.propName} value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="中文显示名" labelTip={HELP.displayName} value={label} onChange={(e) => setLabel(e.target.value)} />
          <Textarea label="注释" labelTip={HELP.comment} value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={functional}
              onChange={(e) => setFunctional(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            函数型属性（FunctionalProperty）
          </label>
        </>
      )}

      <div className="grid grid-cols-1 gap-3">
        <Select
          label={isSubclass ? '子类（起点）' : '定义域 Domain（起点）'}
          labelTip={isSubclass ? undefined : HELP.domain}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          options={domainOptions}
        />
        <Select
          label={isSubclass ? '父类（终点）' : '值域 Range（终点）'}
          labelTip={isSubclass ? undefined : HELP.range}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          options={rangeOptions}
        />
      </div>

      {!isSubclass && edge.iri && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-400">完整 IRI</p>
          <p className="break-all rounded bg-slate-50 px-2 py-1.5 font-mono text-[11px] text-slate-500" title={edge.iri}>
            {edge.iri}
          </p>
        </div>
      )}

      <Button variant="primary" className="w-full" onClick={save}>
        保存修改
      </Button>

      <div className="rounded-md bg-slate-50 p-2.5 text-xs text-slate-500">
        连线含义：{isSubclass ? (
          <>
            「{nodeDisplayName(ontology, source)}」是「{nodeDisplayName(ontology, target)}」的子类
            （rdfs:subClassOf）
          </>
        ) : (
          <>
            属性「{label || name}」的定义域是「{nodeDisplayName(ontology, source)}」，值域是「
            {nodeDisplayName(ontology, target)}」
          </>
        )}
      </div>
    </div>
  )
}

/** 详情视图入口：根据选中项渲染节点或边的编辑表单 */
export default function DetailView() {
  const selectedNodeId = useUiStore((s) => s.selectedNodeId)
  const selectedEdgeId = useUiStore((s) => s.selectedEdgeId)
  const ontology = useOntologyStore((s) => s.ontology)

  if (selectedNodeId) {
    const node = findNode(ontology, selectedNodeId)
    if (node) return <NodeDetailView node={node} />
  }
  if (selectedEdgeId) {
    const edge = ontology.edges.find((e) => e.id === selectedEdgeId)
    if (edge) return <EdgeDetailView edge={edge} />
  }
  return <EmptyState />
}
