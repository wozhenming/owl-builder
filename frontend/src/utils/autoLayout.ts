import type { NodeLayoutMap, Ontology } from '../types/ontology'

/**
 * 一键自动排版：将类按「层级」组织为树形布局（保证零重叠）。
 *
 * 几何约束（重要）：
 * - 类节点宽约 192px（半宽 96），相邻子节点中心间距必须 ≥ 2×(96+96+边距)，
 *   否则父类居中于子类之上时盒子必然与子类重叠；
 * - 奇数个子类时，正中间的子类恰在父类正下方，必须将该子类及其右侧子树
 *   整体右移一个「带宽」，移到父类盒子之外；
 * - 单子类：直接排在父类正下方（不同行，不重叠）。
 *
 * 布局规则：
 * - 根类（无父类）在最上层，子类逐层向下（Y = 深度 × 层高）
 * - 同一父类的子类横向排开，父类位于子类间距的中间
 * - 多个根类左右排列
 * - 数据类型节点放在其所属类（domain）右侧，多个纵向堆叠
 */

/** 层级纵向间距（px） */
export const LEVEL_HEIGHT = 175
/** 顶部留白（px） */
export const TOP_MARGIN = 60
/** 类节点布局宽度（px，实际渲染约 192） */
export const NODE_WIDTH = 192
/** 子节点中心间距（px）：2×(96 父半宽 + 96 子半宽 + 24 边距) */
export const CHILD_SPACING = 432
/** 「带宽」：父类盒子与子类盒子之间允许的最小中心距离 */
const BAND = 96 + 96 + 24
/** 数据类型节点与所属类之间的水平间距 */
const DATATYPE_GAP = NODE_WIDTH + 24

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

interface Subtree {
  /** 子树根节点中心的 x 坐标 */
  x: number
  /** 子树中全部节点 id（用于整体平移） */
  nodes: string[]
}

/**
 * 自动排版：返回每个节点的画布坐标。
 * 纯函数，不修改任何状态。保证任意两个节点的矩形不相交。
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

  // ---- 2. 树形布局（自底向上，零重叠） ----
  const roots = classes
    .filter((c) => !primaryParent.has(c.id))
    .sort((a, b) => (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0) || a.name.localeCompare(b.name, 'zh-CN'))

  let cursorX = 80
  let globalMaxRight = 80

  const yOf = (id: string) => (depths.get(id) ?? 0) * LEVEL_HEIGHT + TOP_MARGIN

  const place = (id: string): Subtree => {
    const placed = positions[id]
    if (placed) {
      return { x: placed.x, nodes: [] } // 环保护
    }
    const children = childrenOf.get(id) ?? []

    if (children.length === 0) {
      // 叶子：占一个完整槽位
      const x = cursorX + CHILD_SPACING / 2
      cursorX += CHILD_SPACING
      positions[id] = { x, y: yOf(id) }
      globalMaxRight = Math.max(globalMaxRight, x + NODE_WIDTH / 2)
      return { x, nodes: [id] }
    }

    // 依次放置子节点（cursorX 依次推进，保证兄弟子树互不重叠）
    const childResults: Subtree[] = []
    for (const c of children) {
      childResults.push(place(c))
    }
    const childXs = childResults.map((r) => r.x)

    // 父类居中于子类跨度中央
    const minX = Math.min(...childXs) - NODE_WIDTH / 2
    const maxX = Math.max(...childXs) + NODE_WIDTH / 2
    const px = (minX + maxX) / 2

    // 奇数（≥3）个子类时：正中间的子类恰在父类正下方，整体右移出带宽
    if (children.length >= 3 && children.length % 2 === 1) {
      const mid = Math.floor(children.length / 2)
      const midX = childXs[mid]
      const shift = px + BAND - midX
      if (shift > 0) {
        for (let i = mid; i < childResults.length; i++) {
          for (const nid of childResults[i].nodes) {
            positions[nid] = { ...positions[nid], x: positions[nid].x + shift }
          }
        }
      }
      // 平移可能超出当前游标，推进游标避免与后续兄弟子树重叠
      const shiftedMax = Math.max(
        ...childResults.slice(mid).flatMap((r) => r.nodes.map((n) => positions[n].x)),
      )
      cursorX = Math.max(cursorX, shiftedMax + NODE_WIDTH / 2 + 24)
      globalMaxRight = Math.max(globalMaxRight, shiftedMax + NODE_WIDTH / 2)
    }

    positions[id] = { x: px, y: yOf(id) }
    globalMaxRight = Math.max(globalMaxRight, px + NODE_WIDTH / 2)
    return { x: px, nodes: [id, ...childResults.flatMap((r) => r.nodes)] }
  }

  for (const root of roots) {
    place(root.id)
    cursorX += CHILD_SPACING // 根树之间的间距
  }

  // ---- 3. 数据类型节点 ----
  // 统计每个类的数据类型属性数量：恰好 1 个的类，其数据类型放在类右侧空隙；
  // 多个（或共享）的进入全局右侧数据列，保证与任何节点不相交。
  const dtCountPerClass = new Map<string, number>()
  const domainOf = new Map<string, string>()
  for (const e of ontology.edges) {
    if (e.kind === 'dataProperty' || e.kind === 'annotationProperty') {
      const targetNode = ontology.nodes.find((n) => n.id === e.target)
      if (targetNode?.kind === 'datatype') {
        dtCountPerClass.set(e.source, (dtCountPerClass.get(e.source) ?? 0) + 1)
        if (!domainOf.has(targetNode.id)) domainOf.set(targetNode.id, e.source)
      }
    }
  }

  const laneX = globalMaxRight + 260
  const laneEntries: Array<{ id: string }> = [] // 按顺序堆叠在数据列中
  for (const d of ontology.nodes.filter((n) => n.kind === 'datatype')) {
    const clsId = domainOf.get(d.id)
    const clsPos = clsId ? positions[clsId] : undefined
    const isSingle = clsId !== undefined && (dtCountPerClass.get(clsId) ?? 0) === 1
    if (clsId && clsPos && isSingle) {
      // 放在类右侧的兄弟间隙中（相邻兄弟间距 432，右邻左侧 336，数据类型 160 宽）
      positions[d.id] = { x: clsPos.x + DATATYPE_GAP, y: yOf(clsId) }
    } else {
      laneEntries.push({ id: d.id })
    }
  }
  for (let i = 0; i < laneEntries.length; i++) {
    positions[laneEntries[i].id] = { x: laneX, y: TOP_MARGIN + i * 100 }
  }

  // ---- 4. 兜底：环中的类 / 未布局的类，排在数据列右侧 ----
  let strayIndex = 0
  for (const c of classes) {
    if (!positions[c.id]) {
      positions[c.id] = {
        x: laneX + 260 + (strayIndex % 4) * CHILD_SPACING,
        y: TOP_MARGIN + Math.floor(strayIndex / 4) * 120,
      }
      strayIndex++
    }
  }

  return positions
}
