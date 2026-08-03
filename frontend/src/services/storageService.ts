/**
 * 本地存储服务（后端不可用时的降级方案）。
 * 项目列表与本体数据保存在浏览器 localStorage 中。
 */

import type { FolderSummary, ProjectSummary } from '../types/api'
import type { NodeLayoutMap, Ontology } from '../types/ontology'
import { generateId } from '../utils/helpers'

const LS_PROJECTS_KEY = 'cost-ontology:projects'
const LS_ONTOLOGY_PREFIX = 'cost-ontology:project:'
const LS_LAYOUT_PREFIX = 'cost-ontology:layout:'
const LS_FOLDERS_KEY = 'cost-ontology:folders'

interface LocalProjectMeta {
  id: string
  name: string
  description: string
  folderId?: string | null
  createdAt: number
  updatedAt: number
}

interface LocalFolderMeta {
  id: string
  name: string
  createdAt: number
}

function readProjects(): LocalProjectMeta[] {
  try {
    const raw = localStorage.getItem(LS_PROJECTS_KEY)
    return raw ? (JSON.parse(raw) as LocalProjectMeta[]) : []
  } catch {
    return []
  }
}

function writeProjects(projects: LocalProjectMeta[]) {
  localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(projects))
}

function readFolders(): LocalFolderMeta[] {
  try {
    const raw = localStorage.getItem(LS_FOLDERS_KEY)
    return raw ? (JSON.parse(raw) as LocalFolderMeta[]) : []
  } catch {
    return []
  }
}

function writeFolders(folders: LocalFolderMeta[]) {
  localStorage.setItem(LS_FOLDERS_KEY, JSON.stringify(folders))
}

/** 同步项目摘要到后端结构 */
function toSummary(p: LocalProjectMeta): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    folderId: p.folderId ?? null,
    createdAt: new Date(p.createdAt).toISOString(),
    updatedAt: new Date(p.updatedAt).toISOString(),
  }
}

export const localProjects = {
  list(): ProjectSummary[] {
    return readProjects().map(toSummary)
  },

  create(data: { name: string; description?: string; folderId?: string | null }): ProjectSummary {
    const now = Date.now()
    const meta: LocalProjectMeta = {
      id: generateId('proj'),
      name: data.name,
      description: data.description ?? '',
      folderId: data.folderId ?? null,
      createdAt: now,
      updatedAt: now,
    }
    writeProjects([...readProjects(), meta])
    return toSummary(meta)
  },

  update(id: string, patch: { name?: string; description?: string; folderId?: string | null }) {
    const projects = readProjects().map((p) =>
      p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
    )
    writeProjects(projects)
  },

  remove(id: string) {
    writeProjects(readProjects().filter((p) => p.id !== id))
    localStorage.removeItem(`${LS_ONTOLOGY_PREFIX}${id}`)
    localStorage.removeItem(`${LS_LAYOUT_PREFIX}${id}`)
  },

  get(id: string): ProjectSummary | null {
    const p = readProjects().find((x) => x.id === id)
    return p ? toSummary(p) : null
  },
}

export const localFolders = {
  list(): FolderSummary[] {
    return readFolders().map((f) => ({
      id: f.id,
      name: f.name,
      createdAt: new Date(f.createdAt).toISOString(),
    }))
  },

  create(name: string): FolderSummary {
    const folder: LocalFolderMeta = { id: generateId('fld'), name, createdAt: Date.now() }
    writeFolders([...readFolders(), folder])
    return { id: folder.id, name: folder.name, createdAt: new Date(folder.createdAt).toISOString() }
  },

  rename(id: string, name: string) {
    writeFolders(readFolders().map((f) => (f.id === id ? { ...f, name } : f)))
  },

  remove(id: string) {
    writeFolders(readFolders().filter((f) => f.id !== id))
    // 文件夹中的项目置为未分类
    writeProjects(readProjects().map((p) => (p.folderId === id ? { ...p, folderId: null } : p)))
  },
}

export const localOntology = {
  save(projectId: string, ontology: Ontology, layout: NodeLayoutMap) {
    localStorage.setItem(`${LS_ONTOLOGY_PREFIX}${projectId}`, JSON.stringify(ontology))
    localStorage.setItem(`${LS_LAYOUT_PREFIX}${projectId}`, JSON.stringify(layout))
  },

  load(projectId: string): { ontology: Ontology; layout: NodeLayoutMap } | null {
    try {
      const raw = localStorage.getItem(`${LS_ONTOLOGY_PREFIX}${projectId}`)
      if (!raw) return null
      const ontology = JSON.parse(raw) as Ontology
      const layoutRaw = localStorage.getItem(`${LS_LAYOUT_PREFIX}${projectId}`)
      const layout = layoutRaw ? (JSON.parse(layoutRaw) as NodeLayoutMap) : {}
      return { ontology: { ...ontology, projectId }, layout }
    } catch {
      return null
    }
  },
}
