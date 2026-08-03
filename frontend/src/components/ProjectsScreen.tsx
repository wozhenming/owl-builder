import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  Bot,
  Boxes,
  Cloud,
  CloudOff,
  FileUp,
  Folder as FolderIcon,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Inbox,
  Layers,
  Loader2,
  LogIn,
  LogOut,
  Pencil,
  ShieldCheck,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import AiSettingsDialog from './AiSettingsDialog'
import Button from './common/Button'
import Input, { Textarea } from './common/Input'
import Modal from './common/Modal'
import { apiClient, ApiUnavailableError, isBackendAvailable } from '../services/apiClient'
import { localFolders, localOntology, localProjects } from '../services/storageService'
import { parseOwlXml } from '../services/owlParser'
import { SAMPLE_TEMPLATES } from '../data/sampleTemplates'
import { useUiStore } from '../store/uiStore'
import type { FolderSummary, ProjectSummary, TemplateSummary } from '../types/api'
import type { NodeLayoutMap } from '../types/ontology'
import { formatRelativeTime } from '../utils/formatters'
import { validateProjectForm } from '../utils/validators'
import { HELP } from '../utils/helpTexts'
import TemplateDialog, { type TemplateOption } from './Dialogs/TemplateDialog'

interface ProjectsScreenProps {
  onOpenProject: (id: string) => void
}

/** 分类过滤：全部 / 未分类 / 指定文件夹 */
type Filter = { kind: 'all' } | { kind: 'uncategorized' } | { kind: 'folder'; id: string }

/** 项目管理页：项目列表 / 文件夹分类 / 新建 / 导入 / 示例模板 */
export default function ProjectsScreen({ onOpenProject }: ProjectsScreenProps) {
  const showToast = useUiStore((s) => s.showToast)
  const showConfirm = useUiStore((s) => s.showConfirm)
  const authUser = useAuthStore((s) => s.user)
  const authToken = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const openAuthDialog = useAuthStore((s) => s.openAuthDialog)
  const openAdminDialog = useAuthStore((s) => s.openAdminDialog)
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)

  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [folders, setFolders] = useState<FolderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newIri, setNewIri] = useState('http://example.org/cost-ontology#')
  const [filter, setFilter] = useState<Filter>({ kind: 'all' })
  // 文件夹编辑对话框
  const [folderDialog, setFolderDialog] = useState<{ mode: 'create' } | { mode: 'rename'; id: string; name: string } | null>(null)
  const [folderName, setFolderName] = useState('')
  // 移动项目对话框
  const [moveTarget, setMoveTarget] = useState<ProjectSummary | null>(null)
  const [serverTemplates, setServerTemplates] = useState<TemplateSummary[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = async (useBackend: boolean) => {
    setLoading(true)
    try {
      if (useBackend) {
        const [p, f] = await Promise.all([apiClient.listProjects(), apiClient.listFolders()])
        setProjects(p)
        setFolders(f)
      } else {
        setProjects(localProjects.list())
        setFolders(localFolders.list())
      }
    } catch {
      setProjects(localProjects.list())
      setFolders(localFolders.list())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    isBackendAvailable().then((ok) => {
      setBackendAvailable(ok)
      void refresh(ok)
    })
  }, [])

  // 登录/登出后刷新项目列表（数据按用户隔离）
  useEffect(() => {
    if (backendAvailable !== null) void refresh(backendAvailable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken])

  // 拉取当前用户可见的模板（管理员下发的 + 公共的）
  useEffect(() => {
    if (backendAvailable === true) {
      apiClient
        .listTemplates()
        .then(setServerTemplates)
        .catch(() => setServerTemplates([]))
    }
  }, [backendAvailable, authToken])

  /** 模板选择项：后端下发 + 内置 */
  const templateOptions = useMemo<TemplateOption[]>(() => {
    const server: TemplateOption[] = serverTemplates.map((t) => ({
      id: t.id,
      name: t.name,
      domain: t.domain,
      description: t.description,
      icon: t.icon,
      source: 'server',
    }))
    const builtin: TemplateOption[] = SAMPLE_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.ontology.name,
      domain: t.domain,
      description: t.ontology.description,
      icon: t.icon,
      source: 'builtin',
    }))
    return [...server, ...builtin]
  }, [serverTemplates])

  // ---- 项目操作 ----
  const createProject = async (folderId?: string | null) => {
    const v = validateProjectForm({ name: newName, description: newDesc, ontologyIri: newIri })
    if (!v.ok) {
      showToast(v.message ?? '校验失败', 'error')
      return
    }
    setCreating(true)
    try {
      let project: ProjectSummary
      if (backendAvailable) {
        project = await apiClient.createProject({
          name: newName.trim(),
          description: newDesc.trim(),
          ontologyIri: newIri.trim(),
          folderId,
        })
      } else {
        project = localProjects.create({ name: newName.trim(), description: newDesc.trim(), folderId })
      }
      showToast(`已创建项目「${project.name}」`, 'success')
      setCreateOpen(false)
      setNewName('')
      setNewDesc('')
      void refresh(backendAvailable ?? false)
      onOpenProject(project.id)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '创建失败', 'error')
    } finally {
      setCreating(false)
    }
  }

  const deleteProject = (project: ProjectSummary) => {
    showConfirm(
      '删除项目',
      `确定删除项目「${project.name}」吗？项目中的全部本体数据将被删除。`,
      async () => {
        try {
          if (backendAvailable) {
            await apiClient.deleteProject(project.id)
          } else {
            localProjects.remove(project.id)
          }
          showToast('项目已删除', 'success')
          void refresh(backendAvailable ?? false)
        } catch (e) {
          showToast(e instanceof Error ? e.message : '删除失败', 'error')
        }
      },
    )
  }

  /** 移动项目到文件夹（null = 未分类） */
  const moveProject = async (project: ProjectSummary, folderId: string | null) => {
    try {
      if (backendAvailable) {
        await apiClient.updateProject(project.id, { folderId })
      } else {
        localProjects.update(project.id, { folderId })
      }
      showToast(`已移动到${folderId ? '文件夹' : '未分类'}`, 'success')
      setMoveTarget(null)
      void refresh(backendAvailable ?? false)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '移动失败', 'error')
    }
  }

  // ---- 文件夹操作 ----
  const createFolder = async () => {
    const name = folderName.trim()
    if (!name) {
      showToast('文件夹名称不能为空', 'error')
      return
    }
    try {
      if (backendAvailable) {
        await apiClient.createFolder({ name })
      } else {
        localFolders.create(name)
      }
      showToast(`已创建文件夹「${name}」`, 'success')
      setFolderDialog(null)
      setFolderName('')
      void refresh(backendAvailable ?? false)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '创建失败', 'error')
    }
  }

  const renameFolder = async () => {
    if (!folderDialog || folderDialog.mode !== 'rename') return
    const name = folderName.trim()
    if (!name) {
      showToast('文件夹名称不能为空', 'error')
      return
    }
    try {
      if (backendAvailable) {
        await apiClient.renameFolder(folderDialog.id, { name })
      } else {
        localFolders.rename(folderDialog.id, name)
      }
      showToast('已重命名', 'success')
      setFolderDialog(null)
      void refresh(backendAvailable ?? false)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '重命名失败', 'error')
    }
  }

  const deleteFolder = (folder: FolderSummary) => {
    showConfirm(
      '删除文件夹',
      `确定删除文件夹「${folder.name}」吗？其中的项目不会被删除，将变为「未分类」。`,
      async () => {
        try {
          if (backendAvailable) {
            await apiClient.deleteFolder(folder.id)
          } else {
            localFolders.remove(folder.id)
          }
          showToast('文件夹已删除', 'success')
          if (filter.kind === 'folder' && filter.id === folder.id) setFilter({ kind: 'all' })
          void refresh(backendAvailable ?? false)
        } catch (e) {
          showToast(e instanceof Error ? e.message : '删除失败', 'error')
        }
      },
    )
  }

  // ---- 示例模板 ----
  const useTemplate = async (option: TemplateOption) => {
    setTemplateOpen(false)
    setCreating(true)
    try {
      let name: string
      let domain: string
      let ontology: unknown
      let layout: Record<string, { x: number; y: number }> | undefined
      if (option.source === 'server') {
        const tpl = serverTemplates.find((t) => t.id === option.id)
        if (!tpl) throw new Error('模板不存在或已删除')
        name = tpl.name
        domain = tpl.domain
        ontology = tpl.data.ontology
        layout = (tpl.data.layout as Record<string, { x: number; y: number }> | undefined) ?? undefined
      } else {
        const tpl = SAMPLE_TEMPLATES.find((t) => t.id === option.id)
        if (!tpl) throw new Error('模板不存在')
        name = tpl.ontology.name
        domain = tpl.domain
        ontology = tpl.ontology
        layout = tpl.layout
      }
      let project: ProjectSummary
      if (backendAvailable) {
        project = await apiClient.createProject({ name, description: option.description, ontologyIri: 'http://example.org/tpl#' })
        await apiClient.saveOntology(
          project.id,
          { ...(ontology as Record<string, unknown>), projectId: project.id, layout } as Record<string, unknown>,
        )
      } else {
        project = localProjects.create({ name, description: option.description })
        localOntology.save(project.id, ontology as import('../types/ontology').Ontology, layout ?? {})
      }
      showToast(`已从「${domain}」模板创建项目`, 'success')
      onOpenProject(project.id)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '创建示例失败', 'error')
    } finally {
      setCreating(false)
    }
  }

  /** 导入 .owl 文件创建项目 */
  const importFile = async (file: File) => {
    try {
      if (backendAvailable) {
        try {
          const result = await apiClient.importOwlFile(file)
          showToast(result.message, 'success')
          onOpenProject(result.projectId)
          return
        } catch (e) {
          if (!(e instanceof ApiUnavailableError)) throw e
          setBackendAvailable(false)
        }
      }
      const text = await file.text()
      const result = parseOwlXml(text, file.name.replace(/\.owl$/i, ''))
      const project = localProjects.create({ name: result.ontology.name, description: '通过本地导入 .owl 文件创建' })
      const layout: NodeLayoutMap = {}
      result.ontology.nodes.forEach((n, i) => {
        layout[n.id] = { x: 80 + (i % 5) * 240, y: 80 + Math.floor(i / 5) * 150 }
      })
      localOntology.save(project.id, result.ontology, layout)
      showToast(
        `导入成功：${result.ontology.nodes.length} 个节点${result.warnings.length ? '，部分条目被跳过' : ''}`,
        'success',
      )
      void refresh(false)
      onOpenProject(project.id)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '导入失败', 'error')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ---- 过滤与统计 ----
  const visibleProjects = projects.filter((p) => {
    if (filter.kind === 'all') return true
    if (filter.kind === 'uncategorized') return !p.folderId
    return p.folderId === filter.id
  })
  const countIn = (folderId: string | null) =>
    projects.filter((p) => (folderId ? p.folderId === folderId : !p.folderId)).length
  const folderNameOf = (id?: string | null) => folders.find((f) => f.id === id)?.name

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* 顶栏（全宽布局，避免按钮挤压） */}
      <header className="border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-lg bg-primary-600 p-2 text-white">
              <Boxes size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-slate-800">本体可视化编辑器</h1>
              <p className="truncate text-xs text-slate-400">通用 OWL 本体可视化编辑器 · 支持多领域建模</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {authUser && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Bot size={14} />}
                onClick={() => setAiSettingsOpen(true)}
                title="配置 AI 助手使用的大模型"
              >
                AI 设置
              </Button>
            )}
            {authUser?.isAdmin && (
              <Button variant="secondary" size="sm" icon={<ShieldCheck size={14} />} onClick={openAdminDialog}>
                管理后台
              </Button>
            )}
            {authUser ? (
              <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                <UserRound size={13} className="text-primary-600" />
                {authUser.username}
                {authUser.isAdmin && (
                  <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-700">管理员</span>
                )}
                <button
                  onClick={() => {
                    void logout()
                    showToast('已退出登录', 'info')
                  }}
                  className="ml-1 flex items-center gap-1 text-slate-400 hover:text-red-500"
                  title="退出登录"
                >
                  <LogOut size={13} />
                </button>
              </span>
            ) : (
              <Button variant="ghost" size="sm" icon={<LogIn size={14} />} onClick={openAuthDialog}>
                登录
              </Button>
            )}
            {backendAvailable === true && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <Cloud size={13} /> 已连接后端（云端存储）
              </span>
            )}
            {backendAvailable === false && (
              <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                <CloudOff size={13} /> 本地模式（数据保存在浏览器）
              </span>
            )}
            <Button variant="secondary" icon={<BookOpen size={15} />} onClick={() => useUiStore.getState().openDocs()}>
              使用文档
            </Button>
            <Button variant="primary" icon={<FileUp size={15} />} onClick={() => fileInputRef.current?.click()}>
              导入 .owl 文件
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".owl,.xml,.rdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importFile(f)
              }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-6 py-6">
        {/* 左侧文件夹栏 */}
        <aside className="w-56 shrink-0">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-slate-400">项目分类</p>
            <button
              onClick={() => {
                setFolderName('')
                setFolderDialog({ mode: 'create' })
              }}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-primary-600"
              title="新建文件夹"
            >
              <FolderPlus size={15} />
            </button>
          </div>
          <div className="mt-2 space-y-0.5">
            <button
              onClick={() => setFilter({ kind: 'all' })}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
                filter.kind === 'all' ? 'bg-primary-50 font-medium text-primary-700' : 'text-slate-600 hover:bg-white'
              }`}
            >
              <Layers size={15} />
              <span className="flex-1 text-left">全部项目</span>
              <span className="text-xs text-slate-400">{projects.length}</span>
            </button>
            <button
              onClick={() => setFilter({ kind: 'uncategorized' })}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
                filter.kind === 'uncategorized'
                  ? 'bg-primary-50 font-medium text-primary-700'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              <Inbox size={15} />
              <span className="flex-1 text-left">未分类</span>
              <span className="text-xs text-slate-400">{countIn(null)}</span>
            </button>

            <div className="mt-3 border-t border-slate-200 pt-2" />
            {folders.length === 0 && (
              <p className="px-2.5 py-1 text-xs text-slate-300">暂无文件夹，点击右上角 + 新建</p>
            )}
            {folders.map((f) => (
              <div
                key={f.id}
                className={`group flex items-center gap-1 rounded-md transition-colors ${
                  filter.kind === 'folder' && filter.id === f.id
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                <button
                  onClick={() => setFilter({ kind: 'folder', id: f.id })}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-2 text-sm ${
                    filter.kind === 'folder' && filter.id === f.id ? 'font-medium' : ''
                  }`}
                >
                  <FolderIcon size={15} className="shrink-0" />
                  <span className="flex-1 truncate text-left" title={f.name}>
                    {f.name}
                  </span>
                  <span className="text-xs text-slate-400">{countIn(f.id)}</span>
                </button>
                <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => {
                      setFolderName(f.name)
                      setFolderDialog({ mode: 'rename', id: f.id, name: f.name })
                    }}
                    className="rounded p-1 text-slate-400 hover:text-primary-600"
                    title="重命名"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => deleteFolder(f)}
                    className="rounded p-1 text-slate-400 hover:text-red-500"
                    title="删除文件夹"
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </aside>

        {/* 右侧项目列表 */}
        <section className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700">
              {filter.kind === 'all' && '我的本体项目'}
              {filter.kind === 'uncategorized' && '未分类项目'}
              {filter.kind === 'folder' && (
                <>
                  <FolderOpen size={16} className="text-primary-600" />
                  {folderNameOf(filter.id) ?? '文件夹'}
                </>
              )}
            </h2>
            <div className="flex gap-2">
              <Button variant="secondary" icon={<Sparkles size={15} />} onClick={() => setTemplateOpen(true)}>
                使用示例模板
              </Button>
              <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>
                新建项目
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-400">
              <Loader2 className="mr-2 animate-spin" size={18} /> 加载中…
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
              <FolderOpen size={40} strokeWidth={1.2} className="mx-auto text-slate-300" />
              <p className="mt-4 text-sm text-slate-500">这里还没有项目</p>
              <p className="mt-1 text-xs text-slate-400">
                新建一个空项目开始建模，或点击「使用示例模板」从多领域模板起步
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleProjects.map((p) => (
                <div
                  key={p.id}
                  className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-primary-300 hover:shadow-md"
                  onClick={() => onOpenProject(p.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-800" title={p.name}>
                        {p.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 min-h-[2rem] text-xs text-slate-400">
                        {p.description || '（暂无描述）'}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMoveTarget(p)
                        }}
                        className="rounded p-1 text-slate-400 hover:text-primary-600"
                        title="移动到文件夹"
                      >
                        <FolderInput size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteProject(p)
                        }}
                        className="rounded p-1 text-slate-400 hover:text-red-500"
                        title="删除项目"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    {p.folderId && filter.kind === 'all' ? (
                      <span className="flex items-center gap-1 truncate text-slate-400">
                        <FolderIcon size={11} /> {folderNameOf(p.folderId)}
                      </span>
                    ) : (
                      <span>更新于 {formatRelativeTime(p.updatedAt)}</span>
                    )}
                    <span className="ml-2 shrink-0 font-medium text-primary-600">打开 →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        本体可视化编辑器 · 支持 OWL RDF/XML 导入导出 · 多领域本体建模工具
      </footer>

      {/* AI 配置对话框 */}
      <AiSettingsDialog open={aiSettingsOpen} onClose={() => setAiSettingsOpen(false)} />

      {/* 示例模板选择对话框 */}
      <TemplateDialog
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        templates={templateOptions}
        onPick={(t) => void useTemplate(t)}
      />

      {/* 新建项目对话框 */}
      <Modal title="新建本体项目" open={createOpen} onClose={() => setCreateOpen(false)}>
        <div className="space-y-4">
          <Input
            label="项目名称"
            labelTip={HELP.projectName}
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="如：某高速公路造价本体"
          />
          <Textarea
            label="项目描述"
            labelTip={HELP.projectDesc}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="对本体的用途与范围的说明"
            rows={3}
          />
          <Input
            label="本体命名空间 IRI"
            labelTip={HELP.namespaceIri}
            value={newIri}
            onChange={(e) => setNewIri(e.target.value)}
            hint="所有类与属性的 IRI 将以该命名空间为前缀"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              icon={creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              onClick={() => void createProject()}
              disabled={creating}
            >
              创建并打开
            </Button>
          </div>
        </div>
      </Modal>

      {/* 文件夹 创建/重命名 对话框 */}
      <Modal
        title={folderDialog?.mode === 'rename' ? '重命名文件夹' : '新建文件夹'}
        open={folderDialog !== null}
        onClose={() => setFolderDialog(null)}
      >
        <div className="space-y-4">
          <Input
            label="文件夹名称"
            required
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="如：医疗健康领域、进行中"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void (folderDialog?.mode === 'rename' ? renameFolder() : createFolder())
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setFolderDialog(null)}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={() => void (folderDialog?.mode === 'rename' ? renameFolder() : createFolder())}
            >
              {folderDialog?.mode === 'rename' ? '保存' : '创建'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 移动项目对话框 */}
      <Modal title={`移动「${moveTarget?.name ?? ''}」`} open={moveTarget !== null} onClose={() => setMoveTarget(null)}>
        <div className="space-y-1">
          <button
            onClick={() => moveTarget && void moveProject(moveTarget, null)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Inbox size={15} className="text-slate-400" /> 未分类
            <span className="ml-auto text-xs text-slate-400">{countIn(null)}</span>
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => moveTarget && void moveProject(moveTarget, f.id)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <FolderIcon size={15} className="text-slate-400" /> {f.name}
              <span className="ml-auto text-xs text-slate-400">{countIn(f.id)}</span>
            </button>
          ))}
          {folders.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400">还没有文件夹，可先在左侧新建。</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
