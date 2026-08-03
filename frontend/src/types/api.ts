/** 后端 API 接口类型定义 */

/** 项目摘要 */
export interface ProjectSummary {
  id: string
  name: string
  description: string
  /** 所属文件夹 id（未分类时为 null） */
  folderId?: string | null
  createdAt: string
  updatedAt: string
}

/** 文件夹 */
export interface FolderSummary {
  id: string
  name: string
  createdAt: string
}

/** 管理员视角的用户 */
export interface UserAdmin {
  id: string
  username: string
  isAdmin: boolean
  projectCount: number
  createdAt: string
}

/** 示例模板（含本体内容） */
export interface TemplateSummary {
  id: string
  name: string
  domain: string
  description: string
  icon: string
  scope: 'public' | 'assigned'
  /** 模板内容 { ontology, layout } */
  data: { ontology: Record<string, unknown>; layout?: Record<string, unknown> | null }
  createdAt: string
}

/** 管理员视角的模板 */
export interface TemplateAdmin extends TemplateSummary {
  assignedUserIds: string[]
}

/** 管理员视角的 MCP 令牌 */
export interface McpTokenAdmin {
  id: string
  token: string
  userId: string
  username: string
  revoked: boolean
  createdAt: string
}

/** 项目详情（含本体 JSON 数据） */
export interface ProjectDetail extends ProjectSummary {
  ontology: Record<string, unknown>
}

/** API 统一错误响应 */
export interface ApiError {
  detail: string
}

/** 导入结果 */
export interface ImportResult {
  projectId: string
  projectName: string
  classNameCount: number
  propertyCount: number
  message: string
}
