import type { OntologyEdge } from '../types/ontology'
import { EDGE_KIND_LABELS, toLocalName } from './helpers'

/** 时间戳 -> 本地时间字符串（yyyy-MM-dd HH:mm） */
export function formatTimestamp(ts: number | string): string {
  const d = typeof ts === 'string' ? new Date(ts) : new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 时间戳 -> 相对时间（中文） */
export function formatRelativeTime(ts: number | string): string {
  const d = typeof ts === 'string' ? new Date(ts) : new Date(ts)
  const diff = Date.now() - d.getTime()
  if (Number.isNaN(diff)) return '—'
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`
  return formatTimestamp(ts)
}

/** IRI -> 简化显示（本地名称），过长时截断 */
export function formatIri(iri: string, maxLength = 60): string {
  const local = toLocalName(iri)
  if (local.length <= maxLength) return local
  return `${local.slice(0, maxLength - 3)}…`
}

/** 统计本体概览信息 */
export function summarizeOntology(nodesCount: number, edges: OntologyEdge[]) {
  const byKind: Record<string, number> = {}
  for (const e of edges) {
    byKind[e.kind] = (byKind[e.kind] ?? 0) + 1
  }
  return {
    classCount: nodesCount,
    subclassCount: byKind.subclass ?? 0,
    objectPropertyCount: byKind.objectProperty ?? 0,
    dataPropertyCount: byKind.dataProperty ?? 0,
    annotationPropertyCount: byKind.annotationProperty ?? 0,
  }
}

/** 边的类型标签（用于 UI 展示） */
export function edgeKindLabel(kind: OntologyEdge['kind']): string {
  return EDGE_KIND_LABELS[kind]
}

/** 文件大小格式化 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
