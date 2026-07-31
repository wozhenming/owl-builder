import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import type { FlowEdge } from './useGraph'
import type { EdgeKind } from '../../types/ontology'
import { useUiStore } from '../../store/uiStore'

/** 各关系类型的视觉样式 */
const KIND_STYLE: Record<EdgeKind, { stroke: string; labelBg: string; selectedBg: string }> = {
  subclass: { stroke: '#94a3b8', labelBg: 'bg-slate-200 text-slate-700', selectedBg: 'bg-slate-400 text-white' },
  objectProperty: { stroke: '#3390ff', labelBg: 'bg-blue-100 text-blue-700', selectedBg: 'bg-blue-600 text-white' },
  dataProperty: { stroke: '#8b5cf6', labelBg: 'bg-violet-100 text-violet-700', selectedBg: 'bg-violet-600 text-white' },
  annotationProperty: { stroke: '#10b981', labelBg: 'bg-emerald-100 text-emerald-700', selectedBg: 'bg-emerald-600 text-white' },
}

/** 关系边渲染：圆角路径 + 类型标签胶囊 */
function EdgeRenderer(props: EdgeProps<FlowEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd } = props
  const edge = data?.edge
  if (!edge) return null

  const style = KIND_STYLE[edge.kind]
  const label = edge.kind === 'subclass' ? 'subClassOf' : edge.label || edge.name || ''

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: style.stroke,
          strokeWidth: selected ? 2.5 : 1.8,
          strokeDasharray: edge.kind === 'annotationProperty' ? '6 4' : undefined,
          transition: 'stroke-width 0.15s',
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                useUiStore.getState().selectEdge(edge.id)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  useUiStore.getState().selectEdge(edge.id)
                }
              }}
              className={`pointer-events-auto cursor-pointer whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium shadow-sm transition-colors ${
                selected ? style.selectedBg : style.labelBg
              }`}
            >
              {label}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(EdgeRenderer)
