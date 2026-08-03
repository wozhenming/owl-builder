import { useEffect, useState } from 'react'
import {
  FileUp,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  Boxes,
} from 'lucide-react'
import Button from './common/Button'
import Input, { Textarea } from './common/Input'
import Modal from './common/Modal'
import { apiClient } from '../services/apiClient'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import type { TemplateAdmin, UserAdmin } from '../types/api'
import { formatRelativeTime } from '../utils/formatters'

/** 管理后台对话框：用户管理 + 模板管理（仅管理员可见入口） */
export default function AdminDialog() {
  const open = useAuthStore((s) => s.adminDialogOpen)
  const close = useAuthStore((s) => s.closeAdminDialog)
  const showToast = useUiStore((s) => s.showToast)
  const showConfirm = useUiStore((s) => s.showConfirm)

  const [tab, setTab] = useState<'users' | 'templates'>('users')
  const [users, setUsers] = useState<UserAdmin[]>([])
  const [templates, setTemplates] = useState<TemplateAdmin[]>([])
  const [loading, setLoading] = useState(false)
  // 模板编辑状态
  const [editTemplate, setEditTemplate] = useState<TemplateAdmin | 'new' | null>(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const [u, t] = await Promise.all([apiClient.adminListUsers(), apiClient.adminListTemplates()])
      setUsers(u)
      setTemplates(t)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const resetPassword = (user: UserAdmin) => {
    showConfirm('重置密码', `为「${user.username}」设置新密码？其现有登录会话将全部失效。`, () => {
      // 内嵌输入新密码
      setResetTarget(user)
    })
  }
  const [resetTarget, setResetTarget] = useState<UserAdmin | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const doResetPassword = async () => {
    if (!resetTarget) return
    if (newPassword.length < 6) {
      showToast('密码至少 6 个字符', 'error')
      return
    }
    try {
      await apiClient.adminResetPassword(resetTarget.id, newPassword)
      showToast(`已重置「${resetTarget.username}」的密码`, 'success')
      setResetTarget(null)
      setNewPassword('')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '重置失败', 'error')
    }
  }

  const [deleteUserTarget, setDeleteUserTarget] = useState<UserAdmin | null>(null)

  const doDeleteUser = async (mode: 'public' | 'transfer' | 'delete', targetUserId?: string) => {
    if (!deleteUserTarget) return
    try {
      await apiClient.adminDeleteUser(deleteUserTarget.id, { mode, targetUserId })
      showToast('用户已删除', 'success')
      setDeleteUserTarget(null)
      void refresh()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '删除失败', 'error')
    }
  }

  const deleteTemplate = (tpl: TemplateAdmin) => {
    showConfirm('删除模板', `确定删除模板「${tpl.name}」吗？`, async () => {
      try {
        await apiClient.adminDeleteTemplate(tpl.id)
        showToast('模板已删除', 'success')
        void refresh()
      } catch (e) {
        showToast(e instanceof Error ? e.message : '删除失败', 'error')
      }
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={close} />
      <div className="relative flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <ShieldCheck size={18} className="text-primary-600" />
            管理后台
          </h3>
          <button
            onClick={close}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>

        {/* Tab 栏 */}
        <div className="flex gap-1 border-b border-slate-200 px-4 pt-2">
          {(
            [
              { key: 'users', label: '用户管理', icon: <Users size={14} /> },
              { key: 'templates', label: '模板管理', icon: <Boxes size={14} /> },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'border-b-2 border-primary-500 text-primary-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="mr-2 animate-spin" size={18} /> 加载中…
            </div>
          ) : tab === 'users' ? (
            <UserTable users={users} onReset={resetPassword} onDelete={setDeleteUserTarget} />
          ) : (
            <TemplateTable
              templates={templates}
              users={users}
              onEdit={(t) => setEditTemplate(t)}
              onNew={() => setEditTemplate('new')}
              onDelete={deleteTemplate}
            />
          )}
        </div>
      </div>

      {/* 模板编辑对话框 */}
      <TemplateEditDialog
        template={editTemplate}
        users={users}
        onClose={() => setEditTemplate(null)}
        onSaved={() => {
          setEditTemplate(null)
          void refresh()
        }}
      />

      {/* 删除用户对话框（含项目处理方式选项） */}
      <DeleteUserDialog
        user={deleteUserTarget}
        users={users}
        onClose={() => setDeleteUserTarget(null)}
        onConfirm={(mode, targetUserId) => void doDeleteUser(mode, targetUserId)}
      />

      {/* 重置密码对话框 */}
      <Modal title={`重置「${resetTarget?.username ?? ''}」的密码`} open={resetTarget !== null} onClose={() => setResetTarget(null)} width="max-w-sm">
        <div className="space-y-4">
          <Input
            label="新密码"
            required
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="至少 6 个字符"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void doResetPassword()
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResetTarget(null)}>
              取消
            </Button>
            <Button variant="primary" onClick={() => void doResetPassword()}>
              确认重置
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 删除用户对话框：项目处理方式选择
// ---------------------------------------------------------------------------

function DeleteUserDialog({
  user,
  users,
  onClose,
  onConfirm,
}: {
  user: UserAdmin | null
  users: UserAdmin[]
  onClose: () => void
  onConfirm: (mode: 'public' | 'transfer' | 'delete', targetUserId?: string) => void
}) {
  const [mode, setMode] = useState<'public' | 'transfer' | 'delete'>('public')
  const [targetUserId, setTargetUserId] = useState('')

  useEffect(() => {
    if (user) {
      setMode('public')
      setTargetUserId('')
    }
  }, [user])

  const candidates = users.filter((u) => u.id !== user?.id)

  return (
    <Modal
      title={`删除用户「${user?.username ?? ''}」`}
      open={user !== null}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="danger"
            icon={<Trash2 size={14} />}
            disabled={mode === 'transfer' && !targetUserId}
            onClick={() => onConfirm(mode, mode === 'transfer' ? targetUserId : undefined)}
          >
            删除用户
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          该用户有 <b>{user?.projectCount ?? 0}</b> 个项目。请选择这些项目的处理方式：
        </p>
        <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${mode === 'public' ? 'border-primary-400 bg-primary-50' : 'border-slate-200'}`}>
          <input type="radio" name="delmode" checked={mode === 'public'} onChange={() => setMode('public')} className="mt-0.5 h-4 w-4 text-primary-600" />
          <span>
            <span className="block text-sm font-medium text-slate-800">转为公开项目</span>
            <span className="block text-xs text-slate-500">所有登录用户可见、可编辑（数据保留）</span>
          </span>
        </label>
        <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${mode === 'transfer' ? 'border-primary-400 bg-primary-50' : 'border-slate-200'}`}>
          <input type="radio" name="delmode" checked={mode === 'transfer'} onChange={() => setMode('transfer')} className="mt-0.5 h-4 w-4 text-primary-600" />
          <span className="flex-1">
            <span className="block text-sm font-medium text-slate-800">转给指定用户</span>
            <span className="block text-xs text-slate-500">项目与文件夹移交给所选用户</span>
            {mode === 'transfer' && (
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">请选择接收用户…</option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
            )}
          </span>
        </label>
        <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${mode === 'delete' ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}>
          <input type="radio" name="delmode" checked={mode === 'delete'} onChange={() => setMode('delete')} className="mt-0.5 h-4 w-4 text-red-600" />
          <span>
            <span className="block text-sm font-medium text-slate-800">连同项目一起删除</span>
            <span className="block text-xs text-slate-500">项目及全部本体数据将被永久删除，不可恢复</span>
          </span>
        </label>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// 用户管理表格
// ---------------------------------------------------------------------------

function UserTable({
  users,
  onReset,
  onDelete,
}: {
  users: UserAdmin[]
  onReset: (u: UserAdmin) => void
  onDelete: (u: UserAdmin) => void
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs text-slate-500">
            <th className="px-3 py-2 font-medium">用户名</th>
            <th className="px-3 py-2 font-medium">角色</th>
            <th className="px-3 py-2 font-medium">项目数</th>
            <th className="px-3 py-2 font-medium">注册时间</th>
            <th className="px-3 py-2 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium text-slate-800">{u.username}</td>
              <td className="px-3 py-2">
                {u.isAdmin ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">管理员</span>
                ) : (
                  <span className="text-xs text-slate-400">普通用户</span>
                )}
              </td>
              <td className="px-3 py-2 text-slate-600">{u.projectCount}</td>
              <td className="px-3 py-2 text-xs text-slate-400">{formatRelativeTime(u.createdAt)}</td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-1">
                  <button
                    onClick={() => onReset(u)}
                    className="rounded p-1 text-slate-400 hover:text-primary-600"
                    title="重置密码"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => onDelete(u)}
                    className="rounded p-1 text-slate-400 hover:text-red-500"
                    title="删除用户"
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && <p className="p-6 text-center text-sm text-slate-400">暂无用户</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 模板管理
// ---------------------------------------------------------------------------

function TemplateTable({
  templates,
  users,
  onEdit,
  onNew,
  onDelete,
}: {
  templates: TemplateAdmin[]
  users: UserAdmin[]
  onEdit: (t: TemplateAdmin) => void
  onNew: () => void
  onDelete: (t: TemplateAdmin) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          共 {templates.length} 个模板 · 可上传 .owl / .json 创建，并下发给指定用户
        </p>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={onNew}>
          新建模板
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {templates.map((t) => {
          const assignedNames = users.filter((u) => t.assignedUserIds.includes(u.id)).map((u) => u.username)
          return (
            <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{t.icon}</span>
                  <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-600">
                    {t.domain || '未分类'}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      t.scope === 'public' ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'
                    }`}
                  >
                    {t.scope === 'public' ? '所有人可见' : '指定用户'}
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <button
                    onClick={() => onEdit(t)}
                    className="rounded p-1 text-slate-400 hover:text-primary-600"
                    title="编辑"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => onDelete(t)}
                    className="rounded p-1 text-slate-400 hover:text-red-500"
                    title="删除模板"
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-800">{t.name}</p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{t.description || '（暂无描述）'}</p>
              {t.scope === 'assigned' && (
                <p className="mt-2 text-[11px] text-slate-400">
                  下发至：{assignedNames.length ? assignedNames.join('、') : '（未选择用户）'}
                </p>
              )}
              <p className="mt-1 text-[11px] text-slate-300">更新于 {formatRelativeTime(t.createdAt)}</p>
            </div>
          )
        })}
        {templates.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 sm:col-span-2">
            暂无模板，点击「新建模板」创建并下发
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 模板编辑表单
// ---------------------------------------------------------------------------

function TemplateEditDialog({
  template,
  users,
  onClose,
  onSaved,
}: {
  template: TemplateAdmin | 'new' | null
  users: UserAdmin[]
  onClose: () => void
  onSaved: () => void
}) {
  const showToast = useUiStore((s) => s.showToast)
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('📦')
  const [scope, setScope] = useState<'public' | 'assigned'>('public')
  const [assigned, setAssigned] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!template) return
    if (template === 'new') {
      setName('')
      setDomain('')
      setDescription('')
      setIcon('📦')
      setScope('public')
      setAssigned([])
      setFile(null)
    } else {
      setName(template.name)
      setDomain(template.domain)
      setDescription(template.description)
      setIcon(template.icon)
      setScope(template.scope)
      setAssigned(template.assignedUserIds)
      setFile(null)
    }
  }, [template])

  const isNew = template === 'new'
  if (!template) return null

  const save = async () => {
    if (!name.trim()) {
      showToast('模板名称不能为空', 'error')
      return
    }
    if (!file && isNew) {
      showToast('请上传 .owl 或 .json 文件作为模板内容', 'error')
      return
    }
    setSaving(true)
    try {
      await apiClient.adminSaveTemplate(isNew ? null : (template as TemplateAdmin).id, {
        name: name.trim(),
        domain: domain.trim(),
        description: description.trim(),
        icon: icon.trim() || '📦',
        scope,
        assignedUserIds: assigned,
        file: file ?? null,
      })
      showToast(isNew ? '模板已创建' : '模板已更新', 'success')
      onSaved()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isNew ? '新建模板' : '编辑模板'}
      open={true}
      onClose={onClose}
      width="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            icon={saving ? <Loader2 size={15} className="animate-spin" /> : undefined}
            onClick={() => void save()}
            disabled={saving}
          >
            保存模板
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="模板名称" required value={name} onChange={(e) => setName(e.target.value)} placeholder="如：工程造价示例" />
          <Input label="领域" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="如：工程建设" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="图标（emoji）" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="📦" />
          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">模板内容（.owl / .json）</span>
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm transition-colors ${
                file ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-300 text-slate-500 hover:border-primary-400'
              }`}
            >
              <FileUp size={15} />
              {file ? file.name : isNew ? '选择文件…' : '（保留原内容则不上传）'}
              <input
                type="file"
                accept=".owl,.xml,.rdf,.json"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </label>
        </div>
        <Textarea
          label="模板描述"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="对该模板的说明，显示在模板选择对话框"
          rows={2}
        />
        <div className="space-y-1">
          <span className="block text-sm font-medium text-slate-700">可见范围</span>
          <div className="flex gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
              <input
                type="radio"
                name="scope"
                checked={scope === 'public'}
                onChange={() => setScope('public')}
                className="h-4 w-4 text-primary-600"
              />
              所有人可见
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
              <input
                type="radio"
                name="scope"
                checked={scope === 'assigned'}
                onChange={() => setScope('assigned')}
                className="h-4 w-4 text-primary-600"
              />
              仅下发给指定用户
            </label>
          </div>
        </div>
        {scope === 'assigned' && (
          <div className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">下发用户</span>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
              {users.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 px-1 py-0.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={assigned.includes(u.id)}
                    onChange={(e) =>
                      setAssigned((prev) => (e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id)))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-primary-600"
                  />
                  {u.username}
                  {u.isAdmin && <span className="text-[10px] text-amber-600">（管理员）</span>}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
