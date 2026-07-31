import type { Ontology } from '../types/ontology'
import { generateOwlXml } from './owlGenerator'
import { parseOwlXml, type OwlParseResult } from './owlParser'

/**
 * 文件操作服务：.owl 导入导出、JSON 备份、浏览器下载。
 * 全部在前端本地完成，不依赖后端。
 */

/** 读取 File 为文本 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error(`读取文件 ${file.name} 失败`))
    reader.readAsText(file, 'UTF-8')
  })
}

/** 解析 .owl 文件（RDF/XML），返回编辑器内部模型 */
export async function importOwlFile(file: File, fallbackName?: string): Promise<OwlParseResult> {
  const text = await readFileAsText(file)
  return parseOwlXml(text, fallbackName ?? file.name.replace(/\.owl$/i, ''))
}

/** 触发浏览器下载 */
export function downloadTextFile(content: string, filename: string, mime = 'application/octet-stream') {
  downloadBlob(new Blob([content], { type: mime }), filename)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 导出 .owl 文件（RDF/XML） */
export function downloadOwl(ontology: Ontology) {
  const xml = generateOwlXml(ontology)
  downloadTextFile(xml, `${ontology.name}.owl`, 'application/rdf+xml')
}

/** 导出 JSON 备份（包含布局信息） */
export function downloadJsonBackup(ontology: Ontology) {
  downloadTextFile(JSON.stringify(ontology, null, 2), `${ontology.name}.json`, 'application/json')
}

/** 读取 JSON 备份，恢复本体 */
export async function importJsonBackup(file: File): Promise<Ontology> {
  const text = await readFileAsText(file)
  try {
    const data = JSON.parse(text) as Ontology
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      throw new Error('文件格式不正确：缺少 nodes/edges 字段')
    }
    return { ...data, projectId: null }
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error('JSON 解析失败：文件已损坏')
    throw e
  }
}
