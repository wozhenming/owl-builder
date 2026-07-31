/**
 * 本地存储服务（后端不可用时的降级方案）。
 * 项目列表与本体数据保存在浏览器 localStorage 中。
 */

import type { ProjectSummary } from '../types/api'
import type { NodeLayoutMap, Ontology } from '../types/ontology'
import { generateId } from '../utils/helpers'

const LS_PROJECTS_KEY = 'cost-ontology:projects'
const LS_ONTOLOGY_PREFIX = 'cost-ontology:project:'
const LS_LAYOUT_PREFIX = 'cost-ontology:layout:'

interface LocalProjectMeta {
  id: string
  name: string
  description: string
  createdAt: number
  updatedAt: number
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

/** 同步项目摘要到后端结构 */
function toSummary(p: LocalProjectMeta): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    createdAt: new Date(p.createdAt).toISOString(),
    updatedAt: new Date(p.updatedAt).toISOString(),
  }
}

export const localProjects = {
  list(): ProjectSummary[] {
    return readProjects().map(toSummary)
  },

  create(data: { name: string; description?: string }): ProjectSummary {
    const now = Date.now()
    const meta: LocalProjectMeta = {
      id: generateId('proj'),
      name: data.name,
      description: data.description ?? '',
      createdAt: now,
      updatedAt: now,
    }
    writeProjects([...readProjects(), meta])
    return toSummary(meta)
  },

  update(id: string, patch: { name?: string; description?: string }) {
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
