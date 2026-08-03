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
 *   Ctrl+Shift+1/2/3 切换右侧面板（详情 / 添加 / 源码）
 *   （注意：不能用 Ctrl+1/2/3，浏览器会切换标签页且无法被网页拦截）
 */
export function useKeyboardShortcuts({ onSave }: ShortcutOptions) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      const code = e.code // 物理按键位置（Digit1/2/3），不受 Shift 影响
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
        default:
          break
      }

      // 面板切换：用 e.code 匹配数字键。
      // 注意不能用 e.key——真实键盘事件中 Shift+数字 的 key 是符号（'!'、'@'、'#'）。
      if (e.shiftKey && (code === 'Digit1' || code === 'Numpad1')) {
        e.preventDefault()
        ui.setPanelTab('detail')
      } else if (e.shiftKey && (code === 'Digit2' || code === 'Numpad2')) {
        e.preventDefault()
        ui.setPanelTab('add')
      } else if (e.shiftKey && (code === 'Digit3' || code === 'Numpad3')) {
        e.preventDefault()
        ui.setPanelTab('code')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onSave])
}
