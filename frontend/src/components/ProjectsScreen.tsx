import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Boxes,
  Cloud,
  CloudOff,
  FileUp,
  FolderOpen,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import Button from './common/Button'
import Input, { Textarea } from './common/Input'
import Modal from './common/Modal'
import { apiClient, ApiUnavailableError, isBackendAvailable } from '../services/apiClient'
import { localOntology, localProjects } from '../services/storageService'
import { parseOwlXml } from '../services/owlParser'
import { SAMPLE_LAYOUT, SAMPLE_ONTOLOGY } from '../data/sampleOntology'
import { useUiStore } from '../store/uiStore'
import type { ProjectSummary } from '../types/api'
import type { NodeLayoutMap } from '../types/ontology'
import { formatRelativeTime } from '../utils/formatters'
import { validateProjectForm } from '../utils/validators'
import { HELP } from '../utils/helpTexts'

interface ProjectsScreenProps {
  onOpenProject: (id: string) => void
}

/** 项目管理页：项目列表 / 新建 / 导入 / 示例模板 */
export default function ProjectsScreen({ onOpenProject }: ProjectsScreenProps) {
  const showToast = useUiStore((s) => s.showToast)
  const showConfirm = useUiStore((s) => s.showConfirm)

  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newIri, setNewIri] = useState('http://example.org/cost-ontology#')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = async (useBackend: boolean) => {
    setLoading(true)
    try {
      if (useBackend) {
        setProjects(await apiClient.listProjects())
      } else {
        setProjects(localProjects.list())
      }
    } catch {
      setProjects(localProjects.list())
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

  const createProject = async () => {
    const v = validateProjectForm({ name: newName, description: newDesc, ontologyIri: newIri })
    if (!v.ok) {
      showToast(v.message ?? '校验失败', 'error')
      return
    }
    setCreating(true)
    try {
      let project: ProjectSummary
      if (backendAvailable) {
        project = await apiClient.createProject({ name: newName.trim(), description: newDesc.trim(), ontologyIri: newIri.trim() })
      } else {
        project = localProjects.create({ name: newName.trim(), description: newDesc.trim() })
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

  /** 使用示例模板：创建项目并载入示例本体 */
  const useSample = async () => {
    setCreating(true)
    try {
      let project: ProjectSummary
      if (backendAvailable) {
        project = await apiClient.createProject({
          name: SAMPLE_ONTOLOGY.name,
          description: SAMPLE_ONTOLOGY.description,
          ontologyIri: SAMPLE_ONTOLOGY.ontologyIri,
        })
        await apiClient.saveOntology(project.id, SAMPLE_ONTOLOGY as unknown as Record<string, unknown>)
      } else {
        project = localProjects.create({ name: SAMPLE_ONTOLOGY.name, description: SAMPLE_ONTOLOGY.description })
        localOntology.save(project.id, SAMPLE_ONTOLOGY, SAMPLE_LAYOUT)
      }
      showToast('已创建示例项目', 'success')
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
      // 本地解析导入
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

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* 顶栏 */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-600 p-2 text-white">
              <Boxes size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">CostOntology Editor</h1>
              <p className="text-xs text-slate-400">公路工程造价本体可视化编辑器</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-700">我的本体项目</h2>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Sparkles size={15} />} onClick={() => void useSample()} disabled={creating}>
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
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <FolderOpen size={40} strokeWidth={1.2} className="mx-auto text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">还没有项目</p>
            <p className="mt-1 text-xs text-slate-400">
              新建一个空项目开始建模，或点击「使用示例模板」快速查看造价本体结构
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {projects.map((p) => (
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 opacity-0 group-hover:opacity-100"
                    icon={<Trash2 size={14} className="text-red-500" />}
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteProject(p)
                    }}
                    title="删除项目"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>更新于 {formatRelativeTime(p.updatedAt)}</span>
                  <span className="font-medium text-primary-600">打开 →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        CostOntology Editor · 支持 OWL RDF/XML 导入导出 · 公路工程造价领域本体建模工具
      </footer>

      {/* 新建项目对话框 */}
      <Modal title="新建本体项目" open={createOpen} onClose={() => setCreateOpen(false)}>
        <div className="space-y-4">
          <Input
            label="项目名称"
            labelTip={HELP.projectName}
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="如：某某公路工程造价本体"
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
            <Button variant="primary" icon={creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} onClick={() => void createProject()} disabled={creating}>
              创建并打开
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
