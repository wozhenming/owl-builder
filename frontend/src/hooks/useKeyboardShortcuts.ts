import { useEffect } from 'react'
import { useUiStore } from '../store/uiStore'

/** 是否正在输入（输入框内不触发全局快捷键） */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

interface ShortcutOptions {
  /** Ctrl+S 保存 */
  onSave: () => void
}

/**
 * 编辑器常用快捷键：
 *   Ctrl+S           保存
 *   Ctrl+N           添加类
 *   Ctrl+Shift+S     添加子类关系
 *   Ctrl+Shift+P     添加属性
 *   Ctrl+E           自动排版
 *   Ctrl+1 / 2 / 3   切换右侧面板（详情 / 添加 / 源码）
 */
export function useKeyboardShortcuts({ onSave }: ShortcutOptions) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      const ui = useUiStore.getState()

      switch (key) {
        case 's':
          e.preventDefault() // 阻止浏览器「保存页面」/「另存为」
          if (e.shiftKey) {
            ui.setPendingKind('subclass')
            ui.openDialog('addProperty')
          } else {
            onSave()
          }
          break
        case 'n':
          e.preventDefault() // 阻止浏览器「新建窗口」
          ui.openDialog('addClass')
          break
        case 'p':
          if (e.shiftKey) {
            e.preventDefault()
            ui.openDialog('addProperty')
          }
          break
        case 'e':
          e.preventDefault()
          ui.requestLayout()
          break
        case '1':
          ui.setPanelTab('detail')
          break
        case '2':
          ui.setPanelTab('add')
          break
        case '3':
          ui.setPanelTab('code')
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onSave])
}
