import type { NodeLayoutMap, Ontology } from '../types/ontology'

/**
 * 一键自动排版：将类按「层级」组织为树形布局。
 *
 * 规则：
 * - 根类（没有父类的类）排在最上层，子类逐层向下（Y = 深度 × 层高）
 * - 同一父类的子类横向排开，父类位于子类中间（居中）
 * - 多个根类左右排列
 * - 数据类型节点放在其所属类（domain）右侧，多个则纵向堆叠
 * - 每个层级有清晰的纵向间距与颜色区分（见 LEVEL_COLORS）
 */

/** 层级纵向间距（px） */
export const LEVEL_HEIGHT = 175
/** 叶子节点横向槽位宽（px） */
export const LEAF_SLOT_WIDTH = 245
/** 节点近似宽度（px，用于根树间距与数据类型偏移） */
export const NODE_WIDTH = 195

/** 层级深度 -> 头部颜色（越深层级颜色越浅，与层级区分对应） */
export const LEVEL_COLORS = [
  '#1e3a8a', // 0 根类
  '#1d4ed8', // 1
  '#2563eb', // 2
  '#3b82f6', // 3
  '#0284c7', // 4
  '#0369a1', // 5
  '#0e7490', // 6
  '#155e75', // 7+
]

/** 按深度取层级颜色（超过色板上限时取最浅色） */
export function levelColor(depth: number): string {
  return LEVEL_COLORS[Math.min(Math.max(depth, 0), LEVEL_COLORS.length - 1)]
}

/** 计算每个类的层级深度（沿 rdfs:subClassOf 向根的最长路径） */
export function computeClassDepths(ontology: Ontology): Map<string, number> {
  // parentsOf[childId] = 父类 id 列表（subclass 边：source 是子类，target 是父类）
  const parentsOf = new Map<string, string[]>()
  for (const e of ontology.edges) {
    if (e.kind !== 'subclass') continue
    const list = parentsOf.get(e.source) ?? []
    list.push(e.target)
    parentsOf.set(e.source, list)
  }

  const depth = new Map<string, number>()
  const visiting = new Set<string>()

  const getDepth = (id: string): number => {
    const cached = depth.get(id)
    if (cached !== undefined) return cached
    if (visiting.has(id)) return 0 // 环保护
    visiting.add(id)
    const parents = parentsOf.get(id) ?? []
    const d = parents.length === 0
      ? 0
      : Math.max(...parents.map((p) => getDepth(p))) + 1
    visiting.delete(id)
    depth.set(id, d)
    return d
  }

  for (const n of ontology.nodes) {
    if (n.kind === 'class') getDepth(n.id)
  }
  return depth
}

/**
 * 自动排版：返回每个节点的画布坐标。
 * 纯函数，不修改任何状态。
 */
export function autoLayout(ontology: Ontology): NodeLayoutMap {
  const depths = computeClassDepths(ontology)
  const classes = ontology.nodes.filter((n) => n.kind === 'class')
  const positions: NodeLayoutMap = {}

  if (classes.length === 0) return positions

  // ---- 1. 主父类树（多继承时取第一条 subclass 边，保证是树） ----
  const primaryParent = new Map<string, string>()
  for (const e of ontology.edges) {
    if (e.kind !== 'subclass') continue
    if (primaryParent.has(e.source)) continue
    primaryParent.set(e.source, e.target)
  }
  const childrenOf = new Map<string, string[]>()
  for (const [child, parent] of primaryParent) {
    const list = childrenOf.get(parent) ?? []
    list.push(child)
    childrenOf.set(parent, list)
  }
  // 排序保证布局确定性
  for (const list of childrenOf.values()) {
    list.sort((a, b) =>
      (depths.get(a) ?? 0) - (depths.get(b) ?? 0) ||
      a.localeCompare(b, 'zh-CN'),
    )
  }

  // ---- 2. 子树叶子数（用于分配横向空间） ----
  const leafCount = new Map<string, number>()
  const counting = new Set<string>()
  const countLeaves = (id: string): number => {
    const cached = leafCount.get(id)
    if (cached !== undefined) return cached
    if (counting.has(id)) return 1 // 环保护
    counting.add(id)
    const children = childrenOf.get(id) ?? []
    const c = children.length === 0
      ? 1
      : children.reduce((sum, cid) => sum + countLeaves(cid), 0)
    counting.delete(id)
    leafCount.set(id, c)
    return c
  }
  for (const c of classes) countLeaves(c.id)

  // ---- 3. 树形布局：叶子均匀分布，父类居子类中心 ----
  const roots = classes
    .filter((c) => !primaryParent.has(c.id))
    .sort((a, b) => (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0) || a.name.localeCompare(b.name, 'zh-CN'))

  let cursorX = 60
  let maxX = 60

  const place = (id: string): { x: number; width: number } => {
    const placed = positions[id]
    if (placed) return { x: placed.x, width: LEAF_SLOT_WIDTH } // 环保护
    const children = childrenOf.get(id) ?? []
    const depth = depths.get(id) ?? 0

    if (children.length === 0) {
      const x = cursorX + LEAF_SLOT_WIDTH / 2
      cursorX += LEAF_SLOT_WIDTH
      positions[id] = { x, y: depth * LEVEL_HEIGHT + 60 }
      maxX = Math.max(maxX, cursorX)
      return { x, width: LEAF_SLOT_WIDTH }
    }

    const results = children.map(place)
    const minX = Math.min(...results.map((r) => r.x - r.width / 2))
    const spanMax = Math.max(...results.map((r) => r.x + r.width / 2))
    const center = (minX + spanMax) / 2
    positions[id] = { x: center, y: depth * LEVEL_HEIGHT + 60 }
    maxX = Math.max(maxX, spanMax)
    return { x: center, width: spanMax - minX }
  }

  for (const root of roots) {
    place(root.id)
    cursorX += NODE_WIDTH // 根树之间的间距
  }

  // ---- 4. 兜底：环中的类 / 未布局的类，排到最右侧 ----
  let strayIndex = 0
  for (const c of classes) {
    if (!positions[c.id]) {
      positions[c.id] = {
        x: maxX + 220 + (strayIndex % 4) * LEAF_SLOT_WIDTH,
        y: 60 + Math.floor(strayIndex / 4) * 120,
      }
      strayIndex++
    }
  }

  // ---- 5. 数据类型节点：放在其 domain 类右侧，多个纵向堆叠 ----
  const domainOf = new Map<string, string>()
  for (const e of ontology.edges) {
    if (e.kind === 'dataProperty' || e.kind === 'annotationProperty') {
      const targetNode = ontology.nodes.find((n) => n.id === e.target)
      if (targetNode?.kind === 'datatype' && !domainOf.has(targetNode.id)) {
        domainOf.set(targetNode.id, e.source)
      }
    }
  }
  const datatypes = ontology.nodes.filter((n) => n.kind === 'datatype')
  const placedPerClass = new Map<string, number>()
  const strayDatatypes: string[] = []
  for (const d of datatypes) {
    const clsId = domainOf.get(d.id)
    const clsPos = clsId ? positions[clsId] : undefined
    if (clsId && clsPos) {
      const i = placedPerClass.get(clsId) ?? 0
      placedPerClass.set(clsId, i + 1)
      positions[d.id] = {
        x: clsPos.x + NODE_WIDTH,
        y: (depths.get(clsId) ?? 0) * LEVEL_HEIGHT + 60 + i * 80,
      }
    } else {
      strayDatatypes.push(d.id)
    }
  }
  for (let i = 0; i < strayDatatypes.length; i++) {
    positions[strayDatatypes[i]] = {
      x: maxX + 260 + i * 160,
      y: 60,
    }
  }

  return positions
}
