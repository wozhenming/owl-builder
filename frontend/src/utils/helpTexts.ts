/**
 * 名词与操作解释（用于鼠标悬浮气泡 Tooltip）。
 */

export const HELP = {
  className:
    '类在命名空间下的唯一标识名，将拼入完整 IRI（例如 http://…/分项工程）。\n仅允许中文、字母、数字、下划线、连字符与句点，不含空格。',
  displayName: '显示在画布与列表中的中文名称，写入 OWL 的 rdfs:label。',
  comment: '对该实体的文字说明，写入 OWL 的 rdfs:comment。',
  parentClass:
    '新类的父类（rdfs:subClassOf）。选择后自动建立子类关系：\n新类将继承父类的属性，并按层级显示正确的颜色。\n不选择则新类作为根类（顶层）。',
  propKind:
    '对象属性：连接两个类，如「清单项 的 工程量」\n数据属性：连接类与数据类型，如「项目 的 开工日期」\n注解属性：类的附加说明信息',
  relationKind:
    '子类关系：类与类之间的继承（rdfs:subClassOf），子类继承父类的属性\n对象属性：连接两个类\n数据属性：连接类与数据类型\n注解属性：类的附加说明信息',
  propName:
    '属性在命名空间下的唯一标识名，将拼入完整 IRI。\n仅允许中文、字母、数字、下划线、连字符与句点，不含空格。',
  domain: '属性的起点（主体）。例如属性「工程量」的定义域是「清单项」。',
  range: '属性的终点（取值）。对象属性的值域是另一个类；数据属性的值域是数据类型。',
  functional:
    '函数型属性：每个个体至多有一个该属性的值（写入 owl:FunctionalProperty）。\n例如「单位造价」只能有一个值。',
  datatype: '标准 XML Schema 数据类型（xsd:*），用作数据属性的值域。',
  namespaceIri:
    '本体命名空间：所有新建类与属性的 IRI 以此为前缀。\n例如 http://example.org/cost-ontology#，实体「分项工程」的 IRI 为 http://example.org/cost-ontology#分项工程',
  projectName: '本体项目的名称，会写入 owl:Ontology 的 rdfs:label。',
  projectDesc: '对本体用途与范围的说明，写入 owl:Ontology 的 rdfs:comment。',
  undo: '撤销上一步操作（Ctrl+Z）。\n支持：添加/编辑/删除实体、建立关系、移动节点、自动排版。',
  redo: '重做已撤销的操作（Ctrl+Y 或 Ctrl+Shift+Z）。',
  save: '保存当前项目：已连接后端时保存到服务器，否则保存到浏览器本地。',
  arrange: '按类层级自动整理布局：根类在上、子类逐层向下，颜色区分层级深度。',
  addClass: '在画布中新增一个类（Class）节点，可选择父类直接建立继承关系。',
  addSubclass: '创建子类关系（rdfs:subClassOf）：选择子类与父类，子类自动继承父类属性。\n也可在画布上从子类拖拽连线到父类后选择「子类关系」。',
  addProperty: '创建对象属性 / 数据属性 / 注解属性。\n也可直接在画布上拖拽连线，系统会自动预填起点与终点。',
  addDatatype: '添加一个标准数据类型节点（xsd:string、xsd:decimal 等）。',
  importFile:
    '导入文件并将替换当前内容：\n.owl —— 标准 OWL RDF/XML 本体文件\n.json —— 本编辑器的 JSON 备份',
  exportOwl: '将当前本体生成为标准 OWL RDF/XML 文件并下载。',
  projectList: '返回项目列表页。建议先保存未保存的修改。',
  codeView: '实时预览当前本体生成的 OWL XML 源码，可复制或下载。',
} as const

/** 图例说明 */
export const LEGEND_HELP = {
  subclass: 'rdfs:subClassOf：子类继承父类的全部属性。',
  objectProperty: '对象属性：从定义域类指向值域类的关系边。',
  dataProperty: '数据属性：从类指向数据类型节点的关系边。',
  annotationProperty: '注解属性：类的附加说明信息（虚线）。',
  level: '类节点的头部颜色表示层级深度：根类最深色，子类逐层变浅。',
} as const
