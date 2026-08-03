import { create } from 'zustand'
import type { EdgeKind } from '../types/ontology'

/** 右侧面板的标签页 */
export type SidePanelTab = 'detail' | 'add' | 'code'

/** 添加视图的子标签 */
export type AddViewTab = 'class' | 'property' | 'datatype'

/** 右键菜单状态 */
export interface ContextMenuState {
  x: number
  y: number
  type: 'node' | 'edge' | 'pane'
  id?: string
}

interface UiState {
  /** 当前选中的元素：节点 id 或边 id（同一时刻只选中一个） */
  selectedNodeId: string | null
  selectedEdgeId: string | null
  /** 右侧面板当前标签 */
  panelTab: SidePanelTab
  /** 添加视图当前子标签 */
  addTab: AddViewTab
  /** 画布连线拖放后待创建的关系（打开属性对话框时预填） */
  pendingConnection: { source: string; target: string } | null
  /** 打开属性对话框时预置的关系类型（如工具栏「子类关系」按钮） */
  pendingKind: EdgeKind | null
  /** 自动排版请求计数（GraphView 监听并执行；每次点击 +1） */
  layoutRequestId: number
  /** 使用文档对话框 */
  docsOpen: boolean
  /** 画布右键菜单 */
  contextMenu: ContextMenuState | null
  /** 对话框可见状态 */
  dialogs: {
    addClass: boolean
    addProperty: boolean
    addDatatype: boolean
    confirm: boolean
  }
  /** 确认对话框内容 */
  confirmState: {
    title: string
    message: string
    onConfirm: (() => void) | null
  }
  /** 轻量提示（toast） */
  toast: { message: string; kind: 'success' | 'error' | 'info' } | null

  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
  clearSelection: () => void
  setPanelTab: (tab: SidePanelTab) => void
  setAddTab: (tab: AddViewTab) => void
  openDialog: (name: keyof UiState['dialogs']) => void
  closeDialog: (name: keyof UiState['dialogs']) => void
  setPendingConnection: (conn: { source: string; target: string } | null) => void
  setPendingKind: (kind: EdgeKind | null) => void
  requestLayout: () => void
  openDocs: () => void
  closeDocs: () => void
  openContextMenu: (menu: ContextMenuState) => void
  closeContextMenu: () => void
  showConfirm: (title: string, message: string, onConfirm: () => void) => void
  hideConfirm: () => void
  showToast: (message: string, kind?: 'success' | 'error' | 'info') => void
  hideToast: () => void
}

export const useUiStore = create<UiState>((set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,
  panelTab: 'detail',
  addTab: 'class',
  pendingConnection: null,
  pendingKind: null,
  layoutRequestId: 0,
  docsOpen: false,
  contextMenu: null,
  dialogs: {
    addClass: false,
    addProperty: false,
    addDatatype: false,
    confirm: false,
  },
  confirmState: { title: '', message: '', onConfirm: null },
  toast: null,

  selectNode: (id) =>
    set((s) => {
      if (s.selectedNodeId === id && id !== null) return s
      return { selectedNodeId: id, selectedEdgeId: null, panelTab: 'detail' }
    }),
  selectEdge: (id) =>
    set((s) => {
      if (s.selectedEdgeId === id && id !== null) return s
      return { selectedEdgeId: id, selectedNodeId: null, panelTab: 'detail' }
    }),
  clearSelection: () => set({ selectedNodeId: null, selectedEdgeId: null, panelTab: 'detail' }),
  setPanelTab: (tab) => set({ panelTab: tab }),
  setAddTab: (tab) => set({ addTab: tab }),

  openDialog: (name) => set((s) => ({ dialogs: { ...s.dialogs, [name]: true } })),
  closeDialog: (name) => set((s) => ({ dialogs: { ...s.dialogs, [name]: false } })),
  setPendingConnection: (conn) => set({ pendingConnection: conn }),
  setPendingKind: (kind) => set({ pendingKind: kind }),
  requestLayout: () => set((s) => ({ layoutRequestId: s.layoutRequestId + 1 })),
  openDocs: () => set({ docsOpen: true }),
  closeDocs: () => set({ docsOpen: false }),
  openContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: null }),
  showConfirm: (title, message, onConfirm) =>
    set((s) => ({
      confirmState: { title, message, onConfirm },
      dialogs: { ...s.dialogs, confirm: true },
    })),
  hideConfirm: () =>
    set((s) => ({
      dialogs: { ...s.dialogs, confirm: false },
      confirmState: { title: '', message: '', onConfirm: null },
    })),
  showToast: (message, kind = 'info') =>
    set({ toast: { message, kind } }),
  hideToast: () => set({ toast: null }),
}))
