import { useEffect, useRef } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Box,
  CloudOff,
  CloudUpload,
  Code2,
  FileDown,
  FileUp,
  GitFork,
  Loader2,
  Link2,
  Redo2,
  Save,
  Type,
  Undo2,
  Wand2,
} from 'lucide-react'
import Button from '../common/Button'
import { suppressHistoryPush, useOntologyStore } from '../../store/ontologyStore'
import { useUiStore } from '../../store/uiStore'
import { useHistoryStore } from '../../store/historyStore'
import { downloadOwl, importJsonBackup, importOwlFile } from '../../services/fileService'
import Tooltip from '../common/Tooltip'
import { HELP } from '../../utils/helpTexts'

interface ToolbarProps {
  projectName: string
  backendAvailable: boolean | null
  onBack: () => void
  onSave: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

/** 顶部工具栏：项目操作 + 编辑操作 + 导入导出 */
export default function Toolbar({
  projectName,
  backendAvailable,
  onBack,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ToolbarProps) {
  const dirty = useOntologyStore((s) => s.dirty)
  const busy = useOntologyStore((s) => s.busy)
  const setOntology = useOntologyStore((s) => s.setOntology)
  const setLayout = useOntologyStore((s) => s.setLayout)
  const markDirty = useOntologyStore((s) => s.markDirty)
  const setPanelTab = useUiStore((s) => s.setPanelTab)
  const openDialog = useUiStore((s) => s.openDialog)
  const showToast = useUiStore((s) => s.showToast)
  const showConfirm = useUiStore((s) => s.showConfirm)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Ctrl+O 导入文件
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'o') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      fileInputRef.current?.click()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /** 导入 .owl 或 .json 备份（覆盖当前内容） */
  const handleImportFile = async (file: File) => {
    const apply = async () => {
      try {
        if (/\.owl$/i.test(file.name)) {
          const result = await importOwlFile(file)
          suppressHistoryPush(() => setOntology(result.ontology, {}))
          useHistoryStore.getState().reset()
          markDirty()
          const classCount = result.ontology.nodes.filter((n) => n.kind === 'class').length
          const propCount = result.ontology.edges.filter((e) => e.kind !== 'subclass').length
          showToast(
            `导入成功：${classCount} 个类、${propCount} 条属性${result.warnings.length ? '，部分条目被跳过' : ''}`,
            'success',
          )
        } else if (/\.json$/i.test(file.name)) {
          const backup = await importJsonBackup(file)
          suppressHistoryPush(() => {
            setOntology(backup, {})
            setLayout({})
          })
          useHistoryStore.getState().reset()
          markDirty()
          showToast('JSON 备份导入成功', 'success')
        } else {
          showToast('不支持的文件类型，请选择 .owl 或 .json 文件', 'error')
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : '导入失败', 'error')
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    if (dirty) {
      showConfirm(
        '导入将覆盖当前内容',
        `导入「${file.name}」将替换当前未保存的编辑内容，确定继续吗？`,
        () => void apply(),
      )
    } else {
      await apply()
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4">
      {/* 返回与项目名 */}
      <Tooltip content={HELP.projectList}>
      <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={onBack}>
        项目列表
      </Button>
      </Tooltip>
      <div className="ml-1 flex items-center gap-2">
        <span className="max-w-[180px] truncate text-sm font-semibold text-slate-800" title={projectName}>
          {projectName}
        </span>
        {dirty && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">未保存</span>
        )}
      </div>

      <div className="mx-2 h-6 w-px bg-slate-200" />

      {/* 编辑操作 */}
      <Tooltip content={HELP.undo}>
      <Button variant="secondary" size="sm" icon={<Undo2 size={14} />} onClick={onUndo} disabled={!canUndo}>
        撤销
      </Button>
      </Tooltip>
      <Tooltip content={HELP.redo}>
      <Button variant="secondary" size="sm" icon={<Redo2 size={14} />} onClick={onRedo} disabled={!canRedo}>
        重做
      </Button>
      </Tooltip>
      <Tooltip content={HELP.save}>
      <Button
        variant="primary"
        size="sm"
        icon={busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        onClick={onSave}
        disabled={busy || !dirty}
      >
        保存
      </Button>
      </Tooltip>
      <Tooltip content={HELP.arrange}>
      <Button
        variant="secondary"
        size="sm"
        icon={<Wand2 size={14} />}
        onClick={() => useUiStore.getState().requestLayout()}
      >
        自动排版
      </Button>
      </Tooltip>

      <div className="mx-2 h-6 w-px bg-slate-200" />

      {/* 添加 */}
      <Tooltip content={HELP.addClass}>
      <Button variant="secondary" size="sm" icon={<Box size={14} />} onClick={() => openDialog('addClass')}>
        添加类
      </Button>
      </Tooltip>
      <Tooltip content={HELP.addSubclass}>
      <Button
        variant="secondary"
        size="sm"
        icon={<GitFork size={14} />}
        onClick={() => {
          useUiStore.getState().setPendingKind('subclass')
          openDialog('addProperty')
        }}
      >
        子类关系
      </Button>
      </Tooltip>
      <Tooltip content={HELP.addDatatype}>
      <Button variant="secondary" size="sm" icon={<Type size={14} />} onClick={() => openDialog('addDatatype')}>
        添加数据类型
      </Button>
      </Tooltip>
      <Tooltip content={HELP.addProperty}>
      <Button variant="secondary" size="sm" icon={<Link2 size={14} />} onClick={() => openDialog('addProperty')}>
        添加属性
      </Button>
      </Tooltip>

      <div className="mx-2 h-6 w-px bg-slate-200" />

      {/* 文件 */}
      <Tooltip content={HELP.importFile}>
      <Button
        variant="secondary"
        size="sm"
        icon={<FileUp size={14} />}
        onClick={() => fileInputRef.current?.click()}
      >
        导入
      </Button>
      </Tooltip>
      <Tooltip content={HELP.exportOwl}>
      <Button
        variant="secondary"
        size="sm"
        icon={<FileDown size={14} />}
        onClick={() => {
          downloadOwl(useOntologyStore.getState().ontology)
          showToast('已导出 .owl 文件', 'success')
        }}
      >
        导出 OWL
      </Button>
      </Tooltip>

      <input
        ref={fileInputRef}
        type="file"
        accept=".owl,.xml,.rdf,.json"
        className="hidden"
        id="toolbar-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleImportFile(file)
        }}
      />

      <div className="flex-1" />

      {/* 后端状态 + 源码 */}
      {backendAvailable === false && (
        <span className="flex items-center gap-1 text-xs text-slate-400" title="后端未连接，数据将保存在浏览器本地">
          <CloudOff size={13} /> 本地模式
        </span>
      )}
      {backendAvailable === true && (
        <span className="flex items-center gap-1 text-xs text-emerald-600" title="已连接后端服务">
          <CloudUpload size={13} /> 已连接
        </span>
      )}
      <Tooltip content={HELP.codeView}>
      <Button variant="ghost" size="sm" icon={<Code2 size={14} />} onClick={() => setPanelTab('code')}>
        源码
      </Button>
      </Tooltip>
      <Button
        variant="ghost"
        size="sm"
        icon={<BookOpen size={14} />}
        onClick={() => useUiStore.getState().openDocs()}
        title="使用文档"
      >
        帮助
      </Button>
    </header>
  )
}
