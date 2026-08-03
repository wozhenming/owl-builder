# 本体可视化编辑器（Ontology Visual Editor）

基于 Web 的可视化 **OWL 本体编辑器**，通用多领域：
无需手写 XML，通过图形化界面即可创建、编辑和查看 OWL 本体。

![Tech](<https://img.shields.io/badge/前端-React%20%2B%20TypeScript%20%2B%20Tailwind-blue>)
![Tech](<https://img.shields.io/badge/后端-FastAPI%20%2B%20SQLite-green>)

## ✨ 核心功能

| 功能            | 说明                                                                                |
| --------------- | ----------------------------------------------------------------------------------- |
| 🕸️ 图形化建模 | 节点-关系图展示类（Class）、属性（Property）与继承/关联关系，支持缩放、平移、小地图 |
| ✏️ 可视化编辑 | 拖拽添加节点、节点间连线建立关系（自动预填 domain/range）、右侧面板编辑详情         |
| 📦 OWL 导入导出 | 加载现有`.owl` 文件（支持 CURIE 前缀/中文编码），导出标准 OWL RDF/XML             |
| 🇨🇳 中文友好   | 界面、类名、属性名、注释（rdfs:label / rdfs:comment）全部支持中文                   |
| 📁 多项目管理   | 创建多个本体项目，分别保存管理；后端不可用时自动降级为浏览器本地存储                |
| ↩️ 撤销重做   | Ctrl+Z / Ctrl+Y 全量操作可撤销                                                      |
| 👀 源码预览     | 实时查看生成的 OWL XML 并一键复制/下载                                              |

## 🚀 快速开始

### 方式一：本地开发（推荐）

需要 Node.js ≥ 18 与 Python ≥ 3.10。

**Windows 用户：双击 [start-dev.bat](start-dev.bat) 一键启动**（自动创建虚拟环境、安装依赖、启动前后端）。

手动启动：

```bash
# 1. 启动后端（端口 8000）
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # Windows
# source .venv/bin/pip install -r requirements.txt   # macOS / Linux
.venv/Scripts/python -m uvicorn app.main:app --port 8000 --reload

# 2. 启动前端（端口 5173，自动代理 /api 到后端）
cd ../frontend        # 注意：必须在 frontend 目录下执行，否则代理配置不生效
npm install
npm run dev
```

浏览器打开 **http://localhost:5173**。

> 💡 后端可选：即使不启动后端，前端也可独立使用（数据保存在浏览器 localStorage，
> 顶部工具栏会显示「本地模式」）。

### 方式二：Docker 一键部署

```bash
docker compose up --build
```

- 前端：http://localhost:8080
- 后端 API：http://localhost:8000/api/health
- 数据持久化在 Docker 卷 `ontology-data`（SQLite 文件）

## 🎮 使用指南

1. **新建项目** —— 首页点击「新建项目」或「使用示例模板」快速体验（示例为公路工程造价本体）
2. **添加类** —— 工具栏「添加类」或右侧「添加」面板；填写类名（将作为 IRI 本地名）、中文显示名与注释
3. **建立关系** —— 从类的右侧锚点拖拽连线到另一个类，弹出属性对话框自动预填 domain/range
4. **添加属性** —— 对象属性（类→类）、数据属性（类→数据类型）、注解属性；可勾选函数型属性
5. **编辑详情** —— 点击图中的类或关系边，右侧「详情」面板修改名称、注释、定义域/值域
6. **导入导出** —— 工具栏「导入」支持 `.owl` 与 `.json` 备份；「导出 OWL」下载标准 RDF/XML
7. **查看源码** —— 右侧「源码」标签实时预览生成的 OWL XML
8. **保存** —— 工具栏「保存」：已连接后端时保存到服务器，否则保存到本地浏览器

### 快捷键

| 按键                                       | 功能                  |
| ------------------------------------------ | --------------------- |
| `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` | 撤销 / 重做           |
| `Delete` / `Backspace`                 | 删除选中的类或关系边  |
| `Esc`                                    | 关闭对话框 / 取消选中 |

## 🏗️ 项目结构

```
cost-ontology-editor/
├── frontend/                        # 前端应用（React + TS + Vite + Tailwind）
│   ├── index.html                   # 入口 HTML（Vite 约定位于根目录）
│   ├── src/
│   │   ├── main.tsx                 # 应用入口
│   │   ├── App.tsx                  # 根组件（项目页/编辑器页路由切换）
│   │   ├── components/
│   │   │   ├── GraphView/           # 图形化视图（ReactFlow）
│   │   │   ├── SidePanel/           # 右侧面板（详情/添加/源码）
│   │   │   ├── Toolbar/             # 顶部工具栏
│   │   │   ├── Dialogs/             # 添加类/属性/数据类型/确认对话框
│   │   │   └── common/              # 通用组件（Button/Input/Select/Modal/Toast）
│   │   ├── store/                   # zustand 状态（本体/UI/历史）
│   │   ├── services/                # OWL 解析生成、API 客户端、文件服务
│   │   ├── hooks/                   # useOntology / useHistory / useGraph
│   │   ├── types/                   # TypeScript 类型定义
│   │   ├── utils/                   # 校验/格式化/辅助函数
│   │   └── data/                    # 示例本体模板
│   └── Dockerfile                   # nginx 部署（代理 /api 到后端）
├── backend/                         # 后端服务（FastAPI + SQLAlchemy + SQLite）
│   ├── app/
│   │   ├── main.py                  # 应用入口（CORS、路由、建表）
│   │   ├── api/                     # 项目 CRUD、本体数据、文件导入导出
│   │   ├── models/                  # SQLAlchemy 模型
│   │   ├── services/                # OWL 解析/生成（纯标准库）、数据服务
│   │   └── schemas/                 # Pydantic 模型
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## 🔌 API 概览

| 方法   | 路径                            | 说明                        |
| ------ | ------------------------------- | --------------------------- |
| GET    | `/api/health`                 | 健康检查                    |
| GET    | `/api/projects`               | 项目列表                    |
| POST   | `/api/projects`               | 创建项目                    |
| GET    | `/api/projects/{id}`          | 项目详情（含本体 JSON）     |
| PUT    | `/api/projects/{id}`          | 更新项目信息                |
| PUT    | `/api/projects/{id}/ontology` | 保存本体数据                |
| DELETE | `/api/projects/{id}`          | 删除项目                    |
| POST   | `/api/file/import`            | 上传`.owl` 解析并创建项目 |
| GET    | `/api/file/export/{id}`       | 导出项目为`.owl` 下载     |

接口文档（Swagger UI）：http://localhost:8000/docs

## 🧠 数据模型设计

编辑器内部统一模型（`frontend/src/types/ontology.ts`）：

```
节点（Node）          —— 类 Class / 数据类型 Datatype
边（Edge）            —— 子类关系 / 对象属性 / 数据属性 / 注解属性
```

**属性以「边」的形式建模**：属性 = domain 节点 → range 节点，
属性名、注释、函数型标记等元数据挂在边上。这种设计让图形编辑直观，
且与 OWL 语义一一对应（rdfs:domain / rdfs:range / owl:FunctionalProperty）。

OWL 生成支持：`owl:Class`、`rdfs:subClassOf`、`rdfs:label`（中文）、`rdfs:comment`、
`owl:ObjectProperty`、`owl:DatatypeProperty`、`owl:AnnotationProperty`、
`owl:FunctionalProperty`、`owl:versionInfo`。
解析支持：CURIE 前缀展开（`cost:类名` / `#类名`）、`owl:Thing` 等内置实体跳过、
匿名限制提示跳过、GB18030 编码兼容。

## 🤖 MCP（AI 助手集成）

本项目的编辑功能已封装为 MCP 服务，AI 助手（Claude Desktop、Cursor 等）可直接创建项目、增删改类与关系、导入导出 OWL。

**两种连接方式：**

1. **stdio**（推荐桌面客户端）：编辑 Claude Desktop 配置 `claude_desktop_config.json`：
```json
{
  "mcpServers": {
    "cost-ontology": {
      "command": "D:/GKTL/owl-builder/backend/.venv/Scripts/python.exe",
      "args": ["-m", "app.mcp_server"],
      "cwd": "D:/GKTL/owl-builder/backend"
    }
  }
}
```
2. **HTTP**：后端已挂载，端点 `http://localhost:8000/mcp`（streamable HTTP）。

**提供的 14 个工具：** `list_projects`、`create_project`、`delete_project`、`get_ontology`、`add_class`、`update_class`、`delete_class`、`add_relation`、`delete_relation`、`add_datatype`、`list_templates`、`create_project_from_template`、`export_owl`、`import_owl`

## 📝 说明

- **登录**：首页可注册/登录账号，项目与文件夹按用户隔离（公共数据 + 自己的数据，退出登录后看不到他人的私有项目）；不登录也可匿名使用（仅可见公共数据）。密码经 pbkdf2 加盐哈希存储，第一个注册的用户接管历史数据并成为管理员
- 后端数据存储为 SQLite（`backend/cost_ontology.db`），可通过环境变量 `COST_ONTOLOGY_DB` 指定路径
- 前端 OWL 解析/生成在浏览器本地完成（`services/owlParser.ts` / `owlGenerator.ts`），
  后端亦有等价实现（`services/owl_service.py`），两者行为一致
- 布局（节点坐标）随本体保存在一起：后端保存时随本体 JSON 存储，本地模式存于 localStorage
