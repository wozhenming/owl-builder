/** 后端 API 接口类型定义 */

/** 项目摘要 */
export interface ProjectSummary {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
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
