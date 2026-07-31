import type { Ontology, OntologyEdge, OntologyNode } from '../types/ontology'

/**
 * 公路工程造价领域示例本体（用于「使用示例模板」快速演示）。
 */

const NS = 'http://example.org/cost-ontology#'

const now = 0

const node = (id: string, kind: 'class' | 'datatype', name: string, label?: string, comment?: string): OntologyNode => ({
  id,
  kind,
  name,
  iri: `${NS}${name}`,
  label,
  comment,
  createdAt: now,
})

const subclass = (id: string, source: string, target: string): OntologyEdge => ({
  id,
  kind: 'subclass',
  source,
  target,
  createdAt: now,
})

const objectProp = (id: string, name: string, label: string, source: string, target: string, comment?: string): OntologyEdge => ({
  id,
  kind: 'objectProperty',
  source,
  target,
  name,
  iri: `${NS}${name}`,
  label,
  comment,
  createdAt: now,
})

const dataProp = (id: string, name: string, label: string, source: string, target: string, comment?: string): OntologyEdge => ({
  id,
  kind: 'dataProperty',
  source,
  target,
  name,
  iri: `${NS}${name}`,
  label,
  comment,
  createdAt: now,
})

export const SAMPLE_ONTOLOGY: Ontology = {
  projectId: null,
  name: '公路工程造价本体（示例）',
  ontologyIri: NS,
  description: '公路工程造价领域的类与属性示例，涵盖建设项目分解、清单计价与定额套用。',
  version: '1.0.0',
  updatedAt: now,
  nodes: [
    node('cls_project', 'class', '建设项目', '建设项目', '公路工程建设项目，如某高速公路项目'),
    node('cls_unit', 'class', '单位工程', '单位工程', '可独立组织施工的工程，如路基工程、路面工程'),
    node('cls_section', 'class', '分部工程', '分部工程', '单位工程的组成部分，如路基土石方工程'),
    node('cls_subsection', 'class', '分项工程', '分项工程', '分部工程的基本组成单元，按主要工种划分'),
    node('cls_item', 'class', '清单项', '清单项', '工程量清单中的计价条目'),
    node('cls_quota', 'class', '定额子目', '定额子目', '消耗量定额中的最小计价单元'),
    node('cls_material', 'class', '材料', '材料', '工程消耗的材料'),
    node('cls_labor', 'class', '人工', '人工', '参与施工的劳动力'),
    node('cls_machine', 'class', '机械', '机械', '施工机械设备'),
    node('dty_decimal', 'datatype', 'decimal', '小数 (decimal)', 'XML Schema 十进制数'),
    node('dty_string', 'datatype', 'string', '字符串 (string)', 'XML Schema 字符串'),
  ],
  edges: [
    subclass('sub_1', 'cls_unit', 'cls_project'),
    subclass('sub_2', 'cls_section', 'cls_unit'),
    subclass('sub_3', 'cls_subsection', 'cls_section'),
    subclass('sub_4', 'cls_item', 'cls_subsection'),
    subclass('sub_5', 'cls_quota', 'cls_subsection'),
    objectProp('prp_1', '包含分项', '包含分项', 'cls_unit', 'cls_subsection', '单位工程由多个分项工程组成'),
    objectProp('prp_2', '套用定额', '套用定额', 'cls_item', 'cls_quota', '清单项按定额子目计价'),
    objectProp('prp_3', '消耗材料', '消耗材料', 'cls_quota', 'cls_material', '定额子目消耗材料'),
    objectProp('prp_4', '消耗人工', '消耗人工', 'cls_quota', 'cls_labor', '定额子目消耗人工'),
    objectProp('prp_5', '使用机械', '使用机械', 'cls_quota', 'cls_machine', '定额子目使用机械'),
    dataProp('prp_6', '工程量', '工程量', 'cls_item', 'dty_decimal', '清单项的工程数量'),
    dataProp('prp_7', '单位造价', '单位造价', 'cls_item', 'dty_decimal', '清单项的综合单价'),
    dataProp('prp_8', '计量单位', '计量单位', 'cls_item', 'dty_string', '清单项的计量单位'),
  ],
}

/** 示例模板的新节点默认布局 */
export const SAMPLE_LAYOUT: Record<string, { x: number; y: number }> = {
  cls_project: { x: 380, y: 40 },
  cls_unit: { x: 380, y: 190 },
  cls_section: { x: 380, y: 340 },
  cls_subsection: { x: 380, y: 490 },
  cls_item: { x: 120, y: 620 },
  cls_quota: { x: 640, y: 620 },
  cls_material: { x: 560, y: 790 },
  cls_labor: { x: 720, y: 790 },
  cls_machine: { x: 880, y: 790 },
  dty_decimal: { x: 40, y: 620 },
  dty_string: { x: 40, y: 760 },
}
