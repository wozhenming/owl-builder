import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { BookOpen, X } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import docsContent from '../../../docs/usage.md?raw'

/** 文档引用的截图资源（markdown 中写文件名即可，如 ![编辑器](editor.png)） */
const docImages = import.meta.glob('../../../docs/images/*.{png,jpg,jpeg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const IMAGE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(docImages).map(([path, url]) => [path.split('/').pop() ?? '', url]),
)

/** 从 Markdown 中提取二级标题作为目录 */
function extractHeadings(raw: string): string[] {
  return raw
    .split('\n')
    .filter((line) => /^##\s+/.test(line))
    .map((line) => line.replace(/^##\s+/, '').trim())
}

/** 使用文档对话框：左侧目录 + 右侧内容 */
export default function DocsDialog() {
  const open = useUiStore((s) => s.docsOpen)
  const closeDocs = useUiStore((s) => s.closeDocs)
  const [active, setActive] = useState<string | null>(null)

  const headings = useMemo(() => extractHeadings(docsContent), [])

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDocs()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeDocs])

  if (!open) return null

  const jumpTo = (title: string) => {
    setActive(title)
    document.getElementById(`doc-${title}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={closeDocs} />
      <div className="relative flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <BookOpen size={18} className="text-primary-600" />
            CostOntology Editor 使用文档
          </h3>
          <button
            onClick={closeDocs}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭文档"
          >
            <X size={18} />
          </button>
        </div>

        {/* 主体：左目录 + 右内容 */}
        <div className="flex flex-1 overflow-hidden">
          <nav className="w-48 shrink-0 space-y-0.5 overflow-y-auto border-r border-slate-100 bg-slate-50 p-3">
            <p className="mb-2 px-2 text-xs font-semibold text-slate-400">目录</p>
            {headings.map((h) => (
              <button
                key={h}
                onClick={() => jumpTo(h)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                  active === h
                    ? 'bg-primary-50 font-medium text-primary-700'
                    : 'text-slate-600 hover:bg-white hover:text-slate-800'
                }`}
              >
                {h}
              </button>
            ))}
          </nav>

          <article className="flex-1 overflow-y-auto bg-white px-8 py-6">
            <div className="prose-sm prose-slate max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ children }) => (
                    <h2
                      id={`doc-${children}`}
                      className="mb-3 mt-8 border-b border-slate-200 pb-2 text-lg font-semibold text-slate-800 first:mt-0"
                    >
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mb-2 mt-6 text-base font-semibold text-slate-800">{children}</h3>
                  ),
                  p: ({ children }) => <p className="mb-3 text-sm leading-relaxed text-slate-600">{children}</p>,
                  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-slate-600">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  table: ({ children }) => (
                    <div className="mb-3 overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left font-medium text-slate-700">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => <td className="border-b border-slate-100 px-3 py-2 text-slate-600">{children}</td>,
                  code: ({ children }) => (
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-700">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="mb-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-200">
                      {children}
                    </pre>
                  ),
                  strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
                  blockquote: ({ children }) => (
                    <blockquote className="mb-3 border-l-4 border-primary-300 bg-primary-50 px-3 py-2 text-sm text-slate-600">
                      {children}
                    </blockquote>
                  ),
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noreferrer" className="text-primary-600 underline">
                      {children}
                    </a>
                  ),
                  img: ({ src, alt }) => (
                    <img
                      src={IMAGE_MAP[src ?? ''] ?? src}
                      alt={alt ?? ''}
                      className="my-3 w-full rounded-lg border border-slate-200 shadow-sm"
                    />
                  ),
                }}
              >
                {docsContent}
              </ReactMarkdown>
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}
