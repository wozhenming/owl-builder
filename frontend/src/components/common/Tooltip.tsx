import { useCallback, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  /** 气泡内容（支持换行） */
  content: ReactNode
  children: ReactNode
  /** 气泡优先位置（越界时自动翻转） */
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

const GAP = 8
const EST_WIDTH = 280
const EST_HEIGHT = 100

/**
 * 鼠标悬浮提示气泡。
 * 通过 createPortal 渲染到 body 顶层（fixed 定位），
 * 避免被滚动容器裁剪或低层级遮挡；越界时自动翻转方向。
 */
export default function Tooltip({ content, children, side = 'top', className = '' }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number; finalSide: 'top' | 'bottom' | 'left' | 'right' } | null>(null)

  const show = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let x = 0
    let y = 0
    let finalSide = side

    // 视口边界翻转（top 不够 -> bottom；left 不够 -> right 等）
    switch (side) {
      case 'top':
        if (rect.top < GAP + EST_HEIGHT) {
          finalSide = 'bottom'
          y = rect.bottom + GAP
        } else {
          y = rect.top - GAP
        }
        x = rect.left + rect.width / 2
        break
      case 'bottom':
        if (rect.bottom + GAP + EST_HEIGHT > window.innerHeight) {
          finalSide = 'top'
          y = rect.top - GAP
        } else {
          y = rect.bottom + GAP
        }
        x = rect.left + rect.width / 2
        break
      case 'left':
        if (rect.left < GAP + EST_WIDTH) {
          finalSide = 'right'
          x = rect.right + GAP
        } else {
          x = rect.left - GAP
        }
        y = rect.top + rect.height / 2
        break
      case 'right':
        if (rect.right + GAP + EST_WIDTH > window.innerWidth) {
          finalSide = 'left'
          x = rect.left - GAP
        } else {
          x = rect.right + GAP
        }
        y = rect.top + rect.height / 2
        break
    }
    // 水平夹取，避免横向溢出视口
    x = Math.max(140, Math.min(x, window.innerWidth - 140))
    setPos({ x, y, finalSide })
  }, [side])

  const hide = useCallback(() => setPos(null), [])

  const transform =
    pos?.finalSide === 'top'
      ? 'translate(-50%, -100%)'
      : pos?.finalSide === 'bottom'
        ? 'translate(-50%, 0)'
        : pos?.finalSide === 'left'
          ? 'translate(-100%, -50%)'
          : 'translate(0, -50%)'

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-flex ${className}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {pos &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[9999] w-max max-w-[300px] whitespace-pre-line rounded-lg bg-slate-800/95 px-3 py-2 text-xs leading-relaxed text-white shadow-xl"
            style={{ left: pos.x, top: pos.y, transform }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
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
