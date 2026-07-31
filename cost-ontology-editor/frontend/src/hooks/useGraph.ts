/**
 * 图形交互 Hook（复用 GraphView/useGraph 中的实现）。
 * 保持项目结构与指南一致：hooks/useGraph.ts 为入口，逻辑在组件目录内。
 */
export {
  buildFlowEdges,
  buildFlowNodes,
  cascadePosition,
  useDeleteShortcut,
  useGraphDeletion,
  useGraphHandlers,
} from '../components/GraphView/useGraph'

export type { FlowEdge, FlowEdgeData, FlowNode, FlowNodeData } from '../components/GraphView/useGraph'
