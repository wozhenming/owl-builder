import { getStoredToken } from '../store/authStore'
import type {
  FolderSummary,
  ImportResult,
  ProjectDetail,
  ProjectSummary,
  TemplateAdmin,
  TemplateSummary,
  UserAdmin,
} from '../types/api'

/**
 * 后端 API 客户端。
 *
 * 注意：后端是可选的 —— 当后端不可用时，前端可退化为
 * localStorage 模式（由 useOntology hook 处理）。
 * 本模块所有方法在后端不可用时抛出 ApiUnavailableError。
 * 已登录时自动附带 Authorization: Bearer <token>。
 */

export class ApiUnavailableError extends Error {
  constructor(message = '无法连接后端服务，请确认后端已启动（见 README）') {
    super(message)
    this.name = 'ApiUnavailableError'
  }
}

/** 登录失效错误（token 过期/被登出） */
export class AuthRequiredError extends Error {
  constructor(message = '登录已过期，请重新登录') {
    super(message)
    this.name = 'AuthRequiredError'
  }
}

const BASE = '/api'

/** 附带认证头的请求头 */
function authHeaders(): Record<string, string> {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    // FormData 由浏览器自动设置 multipart 头，不能手动指定 Content-Type
    const isFormData = init?.body instanceof FormData
    res = await fetch(`${BASE}${path}`, {
      headers: isFormData ? authHeaders() : { 'Content-Type': 'application/json', ...authHeaders() },
      ...init,
    })
  } catch {
    throw new ApiUnavailableError()
  }
  if (res.status === 503 || res.status === 502) throw new ApiUnavailableError()
  if (!res.ok) {
    let detail = `请求失败（HTTP ${res.status}）`
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      /* 非 JSON 响应 */
    }
    if (res.status === 401) {
      // token 失效：清除本地会话
      try {
        localStorage.removeItem('cost-ontology:auth-token')
      } catch {
        /* 忽略 */
      }
      throw new AuthRequiredError(detail)
    }
    throw new Error(detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** 探测后端是否可用 */
export async function isBackendAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch {
    return false
  }
}

export const apiClient = {
  // ---- 项目 CRUD ----
  listProjects: () => request<ProjectSummary[]>('/projects'),
  createProject: (data: { name: string; description?: string; ontologyIri?: string; folderId?: string | null }) =>
    request<ProjectSummary>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (id: string) => request<ProjectDetail>(`/projects/${id}`),
  updateProject: (
    id: string,
    data: { name?: string; description?: string; folderId?: string | null; ontology?: Record<string, unknown> },
  ) => request<ProjectSummary>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),

  // ---- 文件夹 CRUD ----
  listFolders: () => request<FolderSummary[]>('/folders'),
  createFolder: (data: { name: string }) =>
    request<FolderSummary>('/folders', { method: 'POST', body: JSON.stringify(data) }),
  renameFolder: (id: string, data: { name: string }) =>
    request<FolderSummary>(`/folders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFolder: (id: string) => request<void>(`/folders/${id}`, { method: 'DELETE' }),

  // ---- 模板（普通用户可见） ----
  listTemplates: () => request<TemplateSummary[]>('/templates'),

  // ---- 管理后台（仅管理员） ----
  adminListUsers: () => request<UserAdmin[]>('/admin/users'),
  adminResetPassword: (userId: string, password: string) =>
    request<{ message: string }>(`/admin/users/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    }),
  adminDeleteUser: (
    userId: string,
    options?: { mode?: 'public' | 'transfer' | 'delete'; targetUserId?: string },
  ) => {
    const params = new URLSearchParams()
    if (options?.mode) params.set('mode', options.mode)
    if (options?.targetUserId) params.set('targetUserId', options.targetUserId)
    const qs = params.toString()
    return request<void>(`/admin/users/${userId}${qs ? `?${qs}` : ''}`, { method: 'DELETE' })
  },
  adminListTemplates: () => request<TemplateAdmin[]>('/admin/templates'),
  adminSaveTemplate: (
    id: string | null,
    data: {
      name: string
      domain: string
      description: string
      icon: string
      scope: 'public' | 'assigned'
      assignedUserIds: string[]
      file?: File | null
    },
  ) => {
    const form = new FormData()
    form.append('name', data.name)
    form.append('domain', data.domain)
    form.append('description', data.description)
    form.append('icon', data.icon)
    form.append('scope', data.scope)
    form.append('assignedUserIds', JSON.stringify(data.assignedUserIds))
    if (data.file) form.append('file', data.file)
    return request<TemplateAdmin>(id ? `/admin/templates/${id}` : '/admin/templates', {
      method: id ? 'PUT' : 'POST',
      body: form,
    })
  },
  adminDeleteTemplate: (id: string) => request<void>(`/admin/templates/${id}`, { method: 'DELETE' }),

  // ---- 本体数据 ----
  saveOntology: (projectId: string, ontology: Record<string, unknown>) =>
    request<ProjectSummary>(`/projects/${projectId}/ontology`, {
      method: 'PUT',
      body: JSON.stringify(ontology),
    }),

  // ---- 文件导入导出 ----
  /** 上传 .owl 文件，由后端解析并创建项目（登录用户的导入归其所有） */
  importOwlFile: async (file: File): Promise<ImportResult> => {
    const form = new FormData()
    form.append('file', file)
    let res: Response
    try {
      res = await fetch(`${BASE}/file/import`, { method: 'POST', body: form, headers: authHeaders() })
    } catch {
      throw new ApiUnavailableError()
    }
    if (!res.ok) {
      let detail = `导入失败（HTTP ${res.status}）`
      try {
        const body = (await res.json()) as { detail?: string }
        if (body.detail) detail = body.detail
      } catch {
        /* 忽略 */
      }
      throw new Error(detail)
    }
    return (await res.json()) as ImportResult
  },

  /** 导出项目为 .owl 文件（返回 Blob 供下载） */
  exportOwlFile: async (projectId: string): Promise<Blob> => {
    let res: Response
    try {
      res = await fetch(`${BASE}/file/export/${projectId}`, { headers: authHeaders() })
    } catch {
      throw new ApiUnavailableError()
    }
    if (!res.ok) {
      let detail = `导出失败（HTTP ${res.status}）`
      try {
        const body = (await res.json()) as { detail?: string }
        if (body.detail) detail = body.detail
      } catch {
        /* 忽略 */
      }
      throw new Error(detail)
    }
    return await res.blob()
  },
}
