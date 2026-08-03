import { create } from 'zustand'

/** 登录用户信息 */
export interface AuthUser {
  id: string
  username: string
  isAdmin?: boolean
}

const TOKEN_KEY = 'cost-ontology:auth-token'

interface AuthState {
  token: string | null
  user: AuthUser | null
  /** 登录对话框 */
  authDialogOpen: boolean
  /** 认证请求进行中 */
  busy: boolean

  login: (username: string, password: string) => Promise<string | null>
  register: (username: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
  /** 启动时用本地 token 恢复会话 */
  bootstrap: () => Promise<void>
  openAuthDialog: () => void
  closeAuthDialog: () => void
  clearAuth: () => void
}

/** 读取本地 token（供 apiClient 等模块使用，避免循环依赖） */
export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function storeAuth(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* 忽略 */
  }
}

async function postAuth(path: string, body: { username: string; password: string }): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`/api/auth${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = `认证失败（HTTP ${res.status}）`
    try {
      const data = (await res.json()) as { detail?: string }
      if (data.detail) detail = data.detail
    } catch {
      /* 忽略 */
    }
    throw new Error(detail)
  }
  return (await res.json()) as { token: string; user: AuthUser }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  authDialogOpen: false,
  busy: false,

  login: async (username, password) => {
    set({ busy: true })
    try {
      const { token, user } = await postAuth('/login', { username, password })
      storeAuth(token)
      set({ token, user, authDialogOpen: false })
      return null
    } catch (e) {
      return e instanceof Error ? e.message : '登录失败'
    } finally {
      set({ busy: false })
    }
  },

  register: async (username, password) => {
    set({ busy: true })
    try {
      const { token, user } = await postAuth('/register', { username, password })
      storeAuth(token)
      set({ token, user, authDialogOpen: false })
      return null
    } catch (e) {
      return e instanceof Error ? e.message : '注册失败'
    } finally {
      set({ busy: false })
    }
  },

  logout: async () => {
    const token = get().token
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } catch {
      /* 后端不可用时直接清除本地 */
    }
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* 忽略 */
    }
    set({ token: null, user: null })
  },

  bootstrap: async () => {
    const token = getStoredToken()
    if (!token) return
    set({ token })
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('token 失效')
      const user = (await res.json()) as AuthUser
      set({ user })
    } catch {
      try {
        localStorage.removeItem(TOKEN_KEY)
      } catch {
        /* 忽略 */
      }
      set({ token: null, user: null })
    }
  },

  openAuthDialog: () => set({ authDialogOpen: true }),
  closeAuthDialog: () => set({ authDialogOpen: false }),
  clearAuth: () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* 忽略 */
    }
    set({ token: null, user: null })
  },
}))
