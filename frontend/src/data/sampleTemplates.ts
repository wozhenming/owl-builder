import type { NodeLayoutMap, Ontology, OntologyEdge, OntologyNode } from '../types/ontology'

/**
 * 多领域示例模板：点击「使用示例模板」时从这些模板中创建项目。
 */

export interface SampleTemplate {
  id: string
  name: string
  domain: string
  description: string
  icon: string
  ontology: Ontology
  layout: NodeLayoutMap
}

// ---------------------------------------------------------------------------
// 构造辅助
// ---------------------------------------------------------------------------

const cls = (id: string, name: string, label: string, comment?: string): OntologyNode => ({
  id,
  kind: 'class',
  name,
  iri: `http://example.org/tpl#${name}`,
  label,
  comment,
  createdAt: 0,
})

const dty = (id: string, name: string, label: string): OntologyNode => ({
  id,
  kind: 'datatype',
  name,
  iri: `http://www.w3.org/2001/XMLSchema#${name}`,
  label,
  createdAt: 0,
})

const sub = (id: string, source: string, target: string): OntologyEdge => ({
  id,
  kind: 'subclass',
  source,
  target,
  createdAt: 0,
})

const prop = (
  id: string,
  kind: 'objectProperty' | 'dataProperty' | 'annotationProperty',
  name: string,
  label: string,
  source: string,
  target: string,
  comment?: string,
): OntologyEdge => ({
  id,
  kind,
  source,
  target,
  name,
  iri: `http://example.org/tpl#${name}`,
  label,
  comment,
  createdAt: 0,
})

/** 简单网格布局生成器（列优先） */
function gridLayout(nodes: OntologyNode[], cols = 4, gapX = 260, gapY = 150): NodeLayoutMap {
  const layout: NodeLayoutMap = {}
  nodes.forEach((n, i) => {
    layout[n.id] = {
      x: 60 + (i % cols) * gapX,
      y: 60 + Math.floor(i / cols) * gapY,
    }
  })
  return layout
}

function makeTemplate(
  id: string,
  name: string,
  domain: string,
  description: string,
  icon: string,
  nodes: OntologyNode[],
  edges: OntologyEdge[],
  layout?: NodeLayoutMap,
): SampleTemplate {
  return {
    id,
    name,
    domain,
    description,
    icon,
    ontology: {
      projectId: null,
      name,
      ontologyIri: 'http://example.org/tpl#',
      description,
      version: '1.0.0',
      nodes,
      edges,
      updatedAt: 0,
    },
    layout: layout ?? gridLayout(nodes),
  }
}

// ---------------------------------------------------------------------------
// 模板 1：公路造价
// ---------------------------------------------------------------------------

const costNodes = [
  cls('cost_proj', '建设项目', '建设项目', '公路工程建设项目，如某高速公路项目'),
  cls('cost_unit', '单位工程', '单位工程', '可独立组织施工的工程，如路基工程、路面工程'),
  cls('cost_sec', '分部工程', '分部工程', '单位工程的组成部分，如路基土石方工程'),
  cls('cost_sub', '分项工程', '分项工程', '分部工程的基本组成单元，按主要工种划分'),
  cls('cost_item', '清单项', '清单项', '工程量清单中的计价条目'),
  cls('cost_quota', '定额子目', '定额子目', '消耗量定额中的最小计价单元'),
  cls('cost_mat', '材料', '材料', '工程消耗的材料'),
  cls('cost_lab', '人工', '人工', '参与施工的劳动力'),
  cls('cost_mac', '机械', '机械', '施工机械设备'),
  dty('cost_dec', 'decimal', '小数 (decimal)'),
  dty('cost_str', 'string', '字符串 (string)'),
]

const costEdges = [
  sub('cost_s1', 'cost_unit', 'cost_proj'),
  sub('cost_s2', 'cost_sec', 'cost_unit'),
  sub('cost_s3', 'cost_sub', 'cost_sec'),
  sub('cost_s4', 'cost_item', 'cost_sub'),
  sub('cost_s5', 'cost_quota', 'cost_sub'),
  prop('cost_p1', 'objectProperty', '包含分项', '包含分项', 'cost_unit', 'cost_sub', '单位工程由多个分项工程组成'),
  prop('cost_p2', 'objectProperty', '套用定额', '套用定额', 'cost_item', 'cost_quota', '清单项按定额子目计价'),
  prop('cost_p3', 'objectProperty', '消耗材料', '消耗材料', 'cost_quota', 'cost_mat', '定额子目消耗材料'),
  prop('cost_p4', 'objectProperty', '消耗人工', '消耗人工', 'cost_quota', 'cost_lab', '定额子目消耗人工'),
  prop('cost_p5', 'objectProperty', '使用机械', '使用机械', 'cost_quota', 'cost_mac', '定额子目使用机械'),
  prop('cost_p6', 'dataProperty', '工程量', '工程量', 'cost_item', 'cost_dec', '清单项的工程数量'),
  prop('cost_p7', 'dataProperty', '计量单位', '计量单位', 'cost_item', 'cost_str', '清单项的计量单位'),
]

// ---------------------------------------------------------------------------
// 模板 2：医疗健康
// ---------------------------------------------------------------------------

const medicalNodes = [
  cls('med_patient', '患者', '患者', '接受医疗服务的个体'),
  cls('med_disease', '疾病', '疾病', '疾病诊断概念，如高血压、糖尿病'),
  cls('med_symptom', '症状', '症状', '疾病的外在表现，如发热、咳嗽'),
  cls('med_med', '药物', '药物', '治疗用药品'),
  cls('med_dept', '科室', '科室', '医院诊疗科室，如内科、外科'),
  cls('med_doc', '医生', '医生', '执业医师'),
  cls('med_check', '检查项目', '检查项目', '检验检查项目，如血常规、CT'),
  dty('med_dec', 'decimal', '小数 (decimal)'),
  dty('med_str', 'string', '字符串 (string)'),
]

const medicalEdges = [
  sub('med_s1', 'med_symptom', 'med_disease'),
  sub('med_s2', 'med_check', 'med_disease'),
  prop('med_p1', 'objectProperty', '患有', '患有', 'med_patient', 'med_disease', '患者患有某种疾病'),
  prop('med_p2', 'objectProperty', '表现为', '表现为', 'med_disease', 'med_symptom', '疾病表现为某些症状'),
  prop('med_p3', 'objectProperty', '治疗使用', '治疗使用', 'med_disease', 'med_med', '疾病使用药物治疗'),
  prop('med_p4', 'objectProperty', '开具处方', '开具处方', 'med_doc', 'med_med', '医生开具药物处方'),
  prop('med_p5', 'objectProperty', '隶属于', '隶属于', 'med_doc', 'med_dept', '医生隶属于科室'),
  prop('med_p6', 'dataProperty', '剂量', '剂量', 'med_med', 'med_dec', '单次用药剂量'),
  prop('med_p7', 'dataProperty', '给药途径', '给药途径', 'med_med', 'med_str', '口服/注射等'),
]

// ---------------------------------------------------------------------------
// 模板 3：教育领域
// ---------------------------------------------------------------------------

const eduNodes = [
  cls('edu_school', '学校', '学校', '教育机构，如大学、中学'),
  cls('edu_college', '学院', '学院', '大学下属的二级学院'),
  cls('edu_major', '专业', '专业', '培养方向，如软件工程、土木工程'),
  cls('edu_course', '课程', '课程', '教学单元，如数据结构、高等数学'),
  cls('edu_teacher', '教师', '教师', '授课教师'),
  cls('edu_student', '学生', '学生', '在读学生'),
  cls('edu_grade', '成绩', '成绩', '课程成绩记录'),
  dty('edu_dec', 'decimal', '小数 (decimal)'),
  dty('edu_str', 'string', '字符串 (string)'),
]

const eduEdges = [
  sub('edu_s1', 'edu_college', 'edu_school'),
  sub('edu_s2', 'edu_major', 'edu_college'),
  sub('edu_s3', 'edu_course', 'edu_major'),
  prop('edu_p1', 'objectProperty', '开设', '开设', 'edu_college', 'edu_course', '学院开设课程'),
  prop('edu_p2', 'objectProperty', '讲授', '讲授', 'edu_teacher', 'edu_course', '教师讲授课程'),
  prop('edu_p3', 'objectProperty', '选修', '选修', 'edu_student', 'edu_course', '学生选修课程'),
  prop('edu_p4', 'objectProperty', '获得', '获得', 'edu_student', 'edu_grade', '学生获得成绩'),
  prop('edu_p5', 'dataProperty', '学分', '学分', 'edu_course', 'edu_dec', '课程的学分数'),
  prop('edu_p6', 'dataProperty', '课程编号', '课程编号', 'edu_course', 'edu_str', '课程的唯一编号'),
]

// ---------------------------------------------------------------------------
// 模板 4：图书管理
// ---------------------------------------------------------------------------

const bookNodes = [
  cls('bk_book', '图书', '图书', '馆藏图书'),
  cls('bk_author', '作者', '作者', '图书作者'),
  cls('bk_pub', '出版社', '出版社', '出版机构'),
  cls('bk_cat', '图书分类', '图书分类', '中图法分类，如文学、科技'),
  cls('bk_shelf', '书架', '书架', '馆藏书架位置'),
  cls('bk_reader', '读者', '读者', '借阅读者'),
  cls('bk_loan', '借阅记录', '借阅记录', '借书/还书记录'),
  dty('bk_int', 'integer', '整数 (integer)'),
  dty('bk_date', 'date', '日期 (date)'),
  dty('bk_str', 'string', '字符串 (string)'),
]

const bookEdges = [
  sub('bk_s1', 'bk_book', 'bk_cat'),
  prop('bk_p1', 'objectProperty', '著者', '著者', 'bk_book', 'bk_author', '图书的作者'),
  prop('bk_p2', 'objectProperty', '出版于', '出版于', 'bk_book', 'bk_pub', '图书的出版机构'),
  prop('bk_p3', 'objectProperty', '存放于', '存放于', 'bk_book', 'bk_shelf', '图书的馆藏位置'),
  prop('bk_p4', 'objectProperty', '产生', '产生', 'bk_reader', 'bk_loan', '读者产生借阅记录'),
  prop('bk_p5', 'objectProperty', '借阅', '借阅', 'bk_loan', 'bk_book', '借阅记录关联的图书'),
  prop('bk_p6', 'dataProperty', '出版年份', '出版年份', 'bk_book', 'bk_int', '图书出版年份'),
  prop('bk_p7', 'dataProperty', 'ISBN', 'ISBN', 'bk_book', 'bk_str', '国际标准书号'),
  prop('bk_p8', 'dataProperty', '借出日期', '借出日期', 'bk_loan', 'bk_date', '借书日期'),
]

// ---------------------------------------------------------------------------
// 模板列表
// ---------------------------------------------------------------------------

export const SAMPLE_TEMPLATES: SampleTemplate[] = [
  makeTemplate(
    'cost',
    '公路工程造价（示例）',
    '工程建设',
    '建设项目分解、清单计价与定额套用：建设项目 → 单位工程 → 分部工程 → 分项工程 → 清单项/定额子目',
    '🚧',
    costNodes,
    costEdges,
    {
      cost_proj: { x: 380, y: 40 },
      cost_unit: { x: 380, y: 215 },
      cost_sec: { x: 380, y: 390 },
      cost_sub: { x: 380, y: 565 },
      cost_item: { x: 160, y: 740 },
      cost_quota: { x: 640, y: 740 },
      cost_mat: { x: 560, y: 920 },
      cost_lab: { x: 760, y: 920 },
      cost_mac: { x: 960, y: 920 },
      cost_dec: { x: 120, y: 740 },
      cost_str: { x: 120, y: 890 },
    },
  ),
  makeTemplate(
    'medical',
    '医疗健康（示例）',
    '医疗健康',
    '疾病、症状、药物与诊疗关系：患者患有疾病、疾病表现为症状、医生开具处方',
    '🏥',
    medicalNodes,
    medicalEdges,
    {
      med_patient: { x: 400, y: 40 },
      med_disease: { x: 400, y: 215 },
      med_symptom: { x: 140, y: 390 },
      med_check: { x: 400, y: 390 },
      med_med: { x: 660, y: 390 },
      med_doc: { x: 120, y: 60 },
      med_dept: { x: 300, y: 60 },
      med_dec: { x: 820, y: 390 },
      med_str: { x: 980, y: 390 },
    },
  ),
  makeTemplate(
    'education',
    '教育领域（示例）',
    '教育',
    '学校—学院—专业—课程的教学组织：教师讲授课程、学生选修并获得成绩',
    '🎓',
    eduNodes,
    eduEdges,
    {
      edu_school: { x: 380, y: 40 },
      edu_college: { x: 380, y: 215 },
      edu_major: { x: 380, y: 390 },
      edu_course: { x: 380, y: 565 },
      edu_teacher: { x: 120, y: 565 },
      edu_student: { x: 200, y: 740 },
      edu_grade: { x: 380, y: 740 },
      edu_dec: { x: 640, y: 565 },
      edu_str: { x: 640, y: 715 },
    },
  ),
  makeTemplate(
    'library',
    '图书管理（示例）',
    '图书管理',
    '馆藏图书、作者、出版社与借阅：图书著者、出版于、读者借阅产生记录',
    '📚',
    bookNodes,
    bookEdges,
    {
      bk_cat: { x: 380, y: 40 },
      bk_book: { x: 380, y: 215 },
      bk_author: { x: 100, y: 390 },
      bk_pub: { x: 320, y: 390 },
      bk_shelf: { x: 540, y: 390 },
      bk_loan: { x: 380, y: 580 },
      bk_reader: { x: 200, y: 760 },
      bk_int: { x: 760, y: 215 },
      bk_str: { x: 940, y: 215 },
      bk_date: { x: 560, y: 580 },
    },
  ),
]
