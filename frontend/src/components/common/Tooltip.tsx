import type { ReactNode } from 'react'

interface TooltipProps {
  /** 气泡内容（支持换行） */
  content: ReactNode
  children: ReactNode
  /** 气泡位置（默认上方） */
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

const POSITION: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

/**
 * 鼠标悬浮提示气泡（纯 CSS，hover/focus 即显，无 JS 状态）。
 * 用于解释名词与操作，避免界面上的说明文字过多。
 */
export default function Tooltip({ content, children, side = 'top', className = '' }: TooltipProps) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 hidden max-w-[240px] whitespace-pre-line rounded-lg bg-slate-800/95 px-2.5 py-1.5 text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:block group-hover:opacity-100 group-focus-within:block group-focus-within:opacity-100 ${POSITION[side]}`}
      >
        {content}
      </span>
    </span>
  )
}

/** 带解释的标签：文字 + 悬浮气泡 */
export function LabelWithTip({ label, tip }: { label: ReactNode; tip?: ReactNode }) {
  if (!tip) return <>{label}</>
  return (
    <Tooltip content={tip} side="top">
      <span className="cursor-help border-b border-dashed border-slate-300">{label}</span>
    </Tooltip>
  )
}
