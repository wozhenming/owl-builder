import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Box, Hash } from 'lucide-react'
import type { FlowNode } from './useGraph'
import type { OntologyNode } from '../../types/ontology'
import { levelColor } from '../../utils/autoLayout'

/** 类 / 数据类型 节点渲染 */
function NodeRenderer({ data, selected }: NodeProps<FlowNode>) {
  const node = data.node as OntologyNode
  const isClass = node.kind === 'class'
  // 类节点按层级深度着色，区分层级；数据类型保持紫色系
  const headerStyle = isClass
    ? { backgroundColor: levelColor(data.depth ?? 0) }
    : { backgroundColor: '#7c3aed' }

  return (
    <div
      className={`rounded-lg border-2 bg-white shadow-md transition-all ${
        isClass ? 'w-48' : 'w-40'
      } ${selected ? 'border-primary-500 shadow-lg ring-2 ring-primary-200' : 'border-slate-300'}`}
    >
      {/* 头部标签（颜色 = 层级深度） */}
      <div
        className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-semibold text-white ${
          isClass ? '' : 'bg-violet-600'
        }`}
        style={isClass ? headerStyle : undefined}
      >
        {isClass ? <Box size={13} /> : <Hash size={13} />}
        <span>{isClass ? '类 Class' : '数据类型'}</span>
      </div>
      {/* 主体 */}
      <div className="px-3 py-2">
        <div
          className="truncate text-sm font-medium text-slate-800"
          title={node.label ? `${node.label}（${node.name}）` : node.name}
        >
          {node.label || node.name}
        </div>
        <div className="truncate font-mono text-[10px] text-slate-400" title={node.iri}>
          {node.name}
        </div>
      </div>

      {/* 连线锚点：target 在左，source 在右（仅类可作为起点） */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-400"
      />
      {isClass && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-primary-500"
        />
      )}
    </div>
  )
}

export default memo(NodeRenderer)
