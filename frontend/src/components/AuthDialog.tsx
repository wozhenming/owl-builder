import { useState } from 'react'
import { KeyRound, Loader2, LogIn, UserPlus } from 'lucide-react'
import Button from './common/Button'
import Input from './common/Input'
import Modal from './common/Modal'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'

/** 登录 / 注册对话框 */
export default function AuthDialog() {
  const open = useAuthStore((s) => s.authDialogOpen)
  const busy = useAuthStore((s) => s.busy)
  const close = useAuthStore((s) => s.closeAuthDialog)
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const showToast = useUiStore((s) => s.showToast)

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!username.trim()) {
      setError('请输入用户名')
      return
    }
    if (!password) {
      setError('请输入密码')
      return
    }
    const action = mode === 'login' ? login : register
    const err = await action(username.trim(), password)
    if (err) {
      setError(err)
    } else {
      showToast(mode === 'login' ? `欢迎回来，${username.trim()}` : `注册成功，已登录为 ${username.trim()}`, 'success')
      setUsername('')
      setPassword('')
      setError(null)
    }
  }

  return (
    <Modal title={mode === 'login' ? '登录' : '注册账号'} open={open} onClose={close} width="max-w-sm">
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-slate-400">
          {mode === 'login'
            ? '登录后项目按用户隔离：可看到共享数据与自己的项目。不登录也能以匿名模式使用。'
            : '注册后项目归你的账户所有，其他人无法查看或修改。第一个注册的用户将接管历史数据。'}
        </p>

        <Input
          label="用户名"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="2-64 个字符"
          autoComplete="username"
        />
        <Input
          label="密码"
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'register' ? '至少 6 个字符' : '输入密码'}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
          }}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError(null)
            }}
            className="text-xs text-primary-600 hover:underline"
          >
            {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
          </button>
          <Button
            variant="primary"
            icon={busy ? <Loader2 size={15} className="animate-spin" /> : mode === 'login' ? <LogIn size={15} /> : <UserPlus size={15} />}
            onClick={() => void submit()}
            disabled={busy}
          >
            {mode === 'login' ? '登录' : '注册并登录'}
          </Button>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-400">
        <KeyRound size={13} />
        密码经 pbkdf2 加盐哈希存储，不会明文保存。
      </div>
    </Modal>
  )
}
