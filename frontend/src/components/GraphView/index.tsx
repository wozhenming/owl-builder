import { useCallback, useEffect, useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useUiStore } from '../../store/uiStore'
import { useOntologyStore } from '../../store/ontologyStore'
import { useOntologyData } from '../../hooks/useOntology'
import { autoLayout, LEVEL_COLORS } from '../../utils/autoLayout'
import Tooltip from '../common/Tooltip'
import { LEGEND_HELP } from '../../utils/helpTexts'
import {
  buildFlowEdges,
  buildFlowNodes,
  useDeleteShortcut,
  useGraphDeletion,
  useGraphHandlers,
  type FlowEdge,
  type FlowNode,
  type FlowNodeData,
} from './useGraph'
import NodeRenderer from './NodeRenderer'
import EdgeRenderer from './EdgeRenderer'

const nodeTypes: NodeTypes = { ontology: NodeRenderer }
const edgeTypes: EdgeTypes = { ontologyEdge: EdgeRenderer }

/**
 * ReactFlow 的 StoreUpdater 会逐字段跟踪这些 prop 的引用：
 * 任何对象字面量都会导致每次渲染引用变化 -> 内部 store 同步 -> 无限更新循环（白屏）。
 * 因此必须使用模块级常量或 useMemo 保证引用稳定。
 */
const FIT_VIEW_OPTIONS = { padding: 0.25, maxZoom: 1.2 }
const DEFAULT_EDGE_OPTIONS = { selectable: true }
const MIN_ZOOM = 0.15
const MAX_ZOOM = 2.5
const PRO_OPTIONS = { hideAttribution: false }

/** 图例（含层级色带） */
function Legend() {
  const items: Array<{ color: string; label: string; dash?: boolean; tip: string }> = [
    { color: '#94a3b8', label: '子类关系', tip: LEGEND_HELP.subclass },
    { color: '#3390ff', label: '对象属性', tip: LEGEND_HELP.objectProperty },
    { color: '#8b5cf6', label: '数据属性', tip: LEGEND_HELP.dataProperty },
    { color: '#10b981', label: '注解属性', dash: true, tip: LEGEND_HELP.annotationProperty },
  ]
  return (
    <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
      <p className="mb-1.5 text-xs font-semibold text-slate-500">图例</p>
      <div className="space-y-1">
        {items.map((i) => (
          <Tooltip key={i.label} content={i.tip} side="right">
            <div className="flex cursor-help items-center gap-2 text-xs text-slate-600">
              {i.dash ? (
                <span className="inline-block w-6 border-t-2 border-dashed" style={{ borderColor: i.color }} />
              ) : (
                <span className="inline-block h-0.5 w-6" style={{ background: i.color }} />
              )}
              {i.label}
            </div>
          </Tooltip>
        ))}
        {/* 层级色带：类节点的头部颜色 = 类层级深度 */}
        <div className="mt-1.5 border-t border-slate-100 pt-1.5">
          <Tooltip content={LEGEND_HELP.level} side="right">
            <p className="mb-1 cursor-help text-xs text-slate-600">类层级（越深色越浅）</p>
          </Tooltip>
          <div className="flex items-center gap-1">
            {LEVEL_COLORS.map((c, i) => (
              <span
                key={c}
                className="flex h-4 flex-1 items-center justify-center rounded-sm text-[9px] font-medium text-white"
                style={{ backgroundColor: c }}
              >
                {i < LEVEL_COLORS.length - 1 ? i : `${i}+`}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** 图形化主视图（外层提供 ReactFlowProvider，使内层可用 useReactFlow 执行 fitView） */
export default function GraphView() {
  return (
    <ReactFlowProvider>
      <GraphCanvas />
    </ReactFlowProvider>
  )
}

function GraphCanvas() {
  const { fitView } = useReactFlow()
  const { ontology, layout } = useOntologyData()
  const selectedNodeId = useUiStore((s) => s.selectedNodeId)
  const selectedEdgeId = useUiStore((s) => s.selectedEdgeId)
  const layoutRequestId = useUiStore((s) => s.layoutRequestId)
  const { onNodeDragStop, onConnect, onSelectionChange, onPaneClick } = useGraphHandlers()
  const deleteSelected = useGraphDeletion()

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([])

  // 由本体数据派生画布元素。必须 useMemo 保证「内容未变时引用稳定」——
  // 否则每次渲染生成新引用，ReactFlow 内部 store 会反复同步导致无限更新循环（白屏）。
  const flowNodes = useMemo(
    () => buildFlowNodes(ontology, layout, selectedNodeId),
    [ontology, layout, selectedNodeId],
  )
  const flowEdges = useMemo(
    () => buildFlowEdges(ontology, selectedEdgeId),
    [ontology, selectedEdgeId],
  )

  // 本体数据变化 -> 同步到画布（仅在引用真正变化时更新，避免循环）
  useEffect(() => {
    setNodes((prev) => (prev === flowNodes ? prev : flowNodes))
    setEdges((prev) => (prev === flowEdges ? prev : flowEdges))
  }, [flowNodes, flowEdges, setNodes, setEdges])

  // Delete / Backspace 删除选中元素
  const onKeyDown = useDeleteShortcut(deleteSelected)
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  /** 一键自动排版：按类层级整理布局，完成后缩放至全图 */
  const arrangeAndFit = useCallback(() => {
    const store = useOntologyStore.getState()
    const { ontology: current } = store
    if (current.nodes.length === 0) {
      useUiStore.getState().showToast('画布为空，暂无可排版的节点', 'info')
      return
    }
    const positions = autoLayout(current)
    store.setLayout(positions)
    useUiStore.getState().showToast(
      `已按层级整理 ${current.nodes.length} 个节点（根类在上，层级用颜色区分）`,
      'success',
    )
    // 等待节点位置同步到画布后再缩放
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitView({ padding: 0.2, duration: 400 })
      })
    })
  }, [fitView])

  useEffect(() => {
    if (layoutRequestId > 0) arrangeAndFit()
  }, [layoutRequestId, arrangeAndFit])

  const isEmpty = ontology.nodes.length === 0

  const miniMapNodeColor = useCallback((n: Node) => {
    const data = n.data as FlowNodeData | undefined
    return data?.node?.kind === 'class' ? '#3390ff' : '#8b5cf6'
  }, [])

  const stats = useMemo(
    () => ({
      classes: ontology.nodes.filter((n) => n.kind === 'class').length,
      datatypes: ontology.nodes.filter((n) => n.kind === 'datatype').length,
      edges: ontology.edges.length,
    }),
    [ontology],
  )

  return (
    <div className="relative h-full w-full bg-slate-50">
      <ReactFlow<FlowNode, FlowEdge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        deleteKeyCode={null}
        proOptions={PRO_OPTIONS}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="#cbd5e1" />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          nodeColor={miniMapNodeColor}
          nodeStrokeWidth={3}
          pannable
          zoomable
          className="!bg-white"
        />
      </ReactFlow>

      <Legend />

      {/* 统计角标 */}
      <div className="pointer-events-none absolute right-4 top-4 z-10 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-500 shadow-sm backdrop-blur">
        {stats.classes} 个类 · {stats.datatypes} 个数据类型 · {stats.edges} 条关系
      </div>

      {/* 空状态提示 */}
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="max-w-md rounded-xl border border-dashed border-slate-300 bg-white/80 p-6 text-center backdrop-blur">
            <p className="text-base font-medium text-slate-700">画布还是空的</p>
            <p className="mt-2 text-sm text-slate-500">
              点击顶部工具栏「添加类」，或切换到右侧「添加」面板开始建模。
              <br />
              在类之间拖拽连线即可建立对象属性关系。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
