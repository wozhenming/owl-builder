import { useCallback } from 'react'
import {
  MarkerType,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import type { NodeLayoutMap, Ontology, OntologyEdge, OntologyNode } from '../../types/ontology'
import { useOntologyStore } from '../../store/ontologyStore'
import { useUiStore } from '../../store/uiStore'
import { computeClassDepths } from '../../utils/autoLayout'
import { findNode } from '../../utils/helpers'

/**
 * 图形交互逻辑：
 * - 将本体模型（节点/边）转换为 ReactFlow 图元素
 * - 处理连线、拖拽、删除等交互，并同步回 store
 */

export interface FlowNodeData extends Record<string, unknown> {
  node: OntologyNode
  /** 类节点的层级深度（0 = 根类），用于层级配色 */
  depth?: number
}
export type FlowNode = Node<FlowNodeData, 'ontology'>

export interface FlowEdgeData extends Record<string, unknown> {
  edge: OntologyEdge
}
export type FlowEdge = Edge<FlowEdgeData, 'ontologyEdge'>

/** 新节点的默认摆放位置：网格级联 */
export function cascadePosition(index: number): { x: number; y: number } {
  const col = index % 5
  const row = Math.floor(index / 5)
  return { x: 60 + col * 260, y: 60 + row * 150 }
}

/** 本体节点 -> ReactFlow 节点 */
export function buildFlowNodes(
  ontology: Ontology,
  layout: NodeLayoutMap,
  selectedNodeId: string | null,
): FlowNode[] {
  // 一次性计算所有类的层级深度（供节点配色）
  const depths = computeClassDepths(ontology)
  return ontology.nodes.map((node, index) => {
    const pos = layout[node.id] ?? cascadePosition(index)
    return {
      id: node.id,
      type: 'ontology',
      position: pos,
      data: {
        node,
        depth: node.kind === 'class' ? (depths.get(node.id) ?? 0) : undefined,
      },
      selected: node.id === selectedNodeId,
    }
  })
}

/** 本体边 -> ReactFlow 边 */
export function buildFlowEdges(ontology: Ontology, selectedEdgeId: string | null): FlowEdge[] {
  return ontology.edges.map((edge) => {
    const stroke =
      edge.kind === 'subclass'
        ? '#94a3b8'
        : edge.kind === 'objectProperty'
          ? '#3390ff'
          : edge.kind === 'dataProperty'
            ? '#8b5cf6'
            : '#10b981'
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'ontologyEdge',
      data: { edge },
      selected: edge.id === selectedEdgeId,
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 18, height: 18 },
    }
  })
}

/** 处理画布节点变化（移动、选择等）—— 位置写入 layout store */
export function useGraphHandlers() {
  const setNodePosition = useOntologyStore((s) => s.setNodePosition)
  const selectNode = useUiStore((s) => s.selectNode)
  const selectEdge = useUiStore((s) => s.selectEdge)
  const clearSelection = useUiStore((s) => s.clearSelection)
  const setPendingConnection = useUiStore((s) => s.setPendingConnection)
  const openDialog = useUiStore((s) => s.openDialog)

  /** 节点拖拽结束：持久化位置 */
  const onNodeDragStop = useCallback(
    (_: unknown, node: FlowNode) => {
      setNodePosition(node.id, { x: node.position.x, y: node.position.y })
    },
    [setNodePosition],
  )

  /** 画布连线：打开属性创建对话框并预填 domain/range */
  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return
      setPendingConnection({ source: conn.source, target: conn.target })
      openDialog('addProperty')
    },
    [setPendingConnection, openDialog],
  )

  /** 选择同步：画布选中 -> uiStore */
  const onSelectionChange = useCallback(
    (params: { nodes: Node[]; edges: Edge[] }) => {
      if (params.nodes.length > 0) {
        selectNode(params.nodes[0].id)
      } else if (params.edges.length > 0) {
        selectEdge(params.edges[0].id)
      } else {
        clearSelection()
      }
    },
    [selectNode, selectEdge, clearSelection],
  )

  /** 点击空白画布：取消选择 */
  const onPaneClick = useCallback(() => clearSelection(), [clearSelection])

  return { onNodeDragStop, onConnect, onSelectionChange, onPaneClick }
}

/** 处理节点/边的删除（键盘 Delete 键） */
export function useGraphDeletion() {
  return useCallback(() => {
    const ui = useUiStore.getState()
    const store = useOntologyStore.getState()
    const { selectedNodeId, selectedEdgeId } = ui

    if (selectedNodeId) {
      const node = findNode(store.ontology, selectedNodeId)
      if (!node) return
      const relatedCount = store.ontology.edges.filter(
        (e) => e.source === selectedNodeId || e.target === selectedNodeId,
      ).length
      store.removeNode(selectedNodeId)
      ui.selectNode(null)
      ui.showToast(
        `已删除${node.kind === 'datatype' ? '数据类型' : '类'}「${node.label || node.name}」` +
          (relatedCount > 0 ? `及其 ${relatedCount} 条关联关系` : '') +
          '，可用 Ctrl+Z 撤销',
        'info',
      )
    } else if (selectedEdgeId) {
      const edge = store.ontology.edges.find((e) => e.id === selectedEdgeId)
      if (!edge) return
      const label = edge.label || edge.name || ''
      store.removeEdge(selectedEdgeId)
      ui.selectEdge(null)
      ui.showToast(`已删除关系「${label}」，可用 Ctrl+Z 撤销`, 'info')
    }
  }, [])
}

/** 快捷键：Delete/Backspace 删除选中元素 */
export function useDeleteShortcut(deleteSelected: () => void) {
  return useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      const { selectedNodeId, selectedEdgeId } = useUiStore.getState()
      if (selectedNodeId || selectedEdgeId) {
        e.preventDefault()
        deleteSelected()
      }
    },
    [deleteSelected],
  )
}

