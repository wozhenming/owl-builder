import { useEffect, useMemo } from 'react'
import {
  Box,
  GitFork,
  PencilLine,
  Trash2,
  Type,
  Wand2,
  type LucideIcon,
} from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useOntologyStore } from '../../store/ontologyStore'
import { findNode, nodeDisplayName } from '../../utils/helpers'

interface MenuItem {
  icon: LucideIcon
  label: string
  danger?: boolean
  onClick: () => void
}

function deleteNodeById(id: string) {
  const store = useOntologyStore.getState()
  const ui = useUiStore.getState()
  const node = findNode(store.ontology, id)
  if (!node) return
  const related = store.ontology.edges.filter((e) => e.source === id || e.target === id).length
  store.removeNode(id)
  ui.selectNode(null)
  ui.showToast(
    `已删除${node.kind === 'datatype' ? '数据类型' : '类'}「${node.label || node.name}」` +
      (related > 0 ? `及其 ${related} 条关联关系` : '') +
      '，可用 Ctrl+Z 撤销',
    'info',
  )
}

function deleteEdgeById(id: string) {
  const store = useOntologyStore.getState()
  const ui = useUiStore.getState()
  const edge = store.ontology.edges.find((e) => e.id === id)
  if (!edge) return
  store.removeEdge(id)
  ui.selectEdge(null)
  ui.showToast(`已删除关系「${edge.label || edge.name || ''}」，可用 Ctrl+Z 撤销`, 'info')
}

/** 画布右键上下文菜单 */
export default function ContextMenu() {
  const menu = useUiStore((s) => s.contextMenu)
  const close = useUiStore((s) => s.closeContextMenu)

  // 点击菜单外 / Esc / 滚动关闭。
  // 注意：必须用「捕获阶段」（capture: true）——ReactFlow 画布会在 mousedown
  // 中阻止事件冒泡，冒泡阶段监听收不到点击，菜单将无法关闭。
  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target && target.closest('[data-context-menu]')) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onScroll = () => close()
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('wheel', onScroll, { passive: true, capture: true })
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('wheel', onScroll, { capture: true })
    }
  }, [menu, close])

  const items = useMemo<MenuItem[]>(() => {
    if (!menu) return []
    const ui = useUiStore.getState()
    const ontology = useOntologyStore.getState().ontology

    const editSelection = () => {
      if (menu.type === 'node' && menu.id) {
        ui.selectNode(menu.id)
        ui.setPanelTab('detail')
      } else if (menu.type === 'edge' && menu.id) {
        ui.selectEdge(menu.id)
        ui.setPanelTab('detail')
      }
    }
    const addSubclass = () => {
      if (!menu.id) return
      ui.setPendingKind('subclass')
      ui.setPendingConnection({ source: menu.id, target: '' })
      ui.openDialog('addProperty')
    }

    switch (menu.type) {
      case 'node': {
        const node = menu.id ? findNode(ontology, menu.id) : undefined
        if (node?.kind === 'class') {
          return [
            { icon: PencilLine, label: '编辑详情', onClick: editSelection },
            { icon: GitFork, label: `添加子类（以「${node.label || node.name}」为父类）`, onClick: addSubclass },
            { icon: Trash2, label: '删除', danger: true, onClick: () => menu.id && deleteNodeById(menu.id) },
          ]
        }
        return [
          { icon: PencilLine, label: '编辑详情', onClick: editSelection },
          { icon: Trash2, label: '删除', danger: true, onClick: () => menu.id && deleteNodeById(menu.id) },
        ]
      }
      case 'edge':
        return [
          { icon: PencilLine, label: '编辑关系', onClick: editSelection },
          { icon: Trash2, label: '删除关系', danger: true, onClick: () => menu.id && deleteEdgeById(menu.id) },
        ]
      case 'pane':
        return [
          { icon: Box, label: '添加类', onClick: () => ui.openDialog('addClass') },
          { icon: GitFork, label: '添加子类关系', onClick: () => ui.openDialog('addProperty') },
          { icon: Type, label: '添加数据类型', onClick: () => ui.openDialog('addDatatype') },
          { icon: Wand2, label: '自动排版', onClick: () => ui.requestLayout() },
        ]
      default:
        return []
    }
  }, [menu])

  if (!menu || items.length === 0) return null

  // 防止菜单超出视口
  const x = Math.min(menu.x, window.innerWidth - 200)
  const y = Math.min(menu.y, window.innerHeight - items.length * 36 - 16)

  return (
    <div
      data-context-menu
      className="fixed z-[9998] min-w-[190px] rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            close()
            item.onClick()
          }}
          className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors ${
            item.danger
              ? 'text-red-600 hover:bg-red-50'
              : 'text-slate-700 hover:bg-primary-50 hover:text-primary-700'
          }`}
        >
          <item.icon size={14} className="shrink-0 opacity-70" />
          <span className="truncate">{item.label}</span>
        </button>
      ))}
      {menu.type === 'node' && menu.id && (
        <p className="border-t border-slate-100 px-3 py-1 text-[11px] text-slate-400">
          {nodeDisplayName(useOntologyStore.getState().ontology, menu.id)}
        </p>
      )}
      <p className="border-t border-slate-100 px-3 py-1 text-[11px] text-slate-300">
        {menu.type === 'pane' ? '画布操作' : '右键菜单 · Esc 关闭'}
      </p>
    </div>
  )
}
