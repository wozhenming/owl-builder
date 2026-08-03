import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Bot, ChevronDown, ChevronUp, Download, Loader2, MessageSquarePlus, Send, Trash2, Wrench } from 'lucide-react'
import Button from './common/Button'
import { apiClient } from '../services/apiClient'
import { useAuthStore } from '../store/authStore'
import { reloadProjectData } from '../hooks/useOntology'
import { downloadTextFile } from '../services/fileService'
import { snapshotFrom, useHistoryStore } from '../store/historyStore'
import { useOntologyStore } from '../store/ontologyStore'
import { useOperationLogStore } from '../store/operationLogStore'

/** AI 回复的 Markdown 渲染（轻量样式，过滤链接/图片防注入） */
function MarkdownReply({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        ul: ({ children }) => <ul className="mb-1 list-disc pl-4 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-1 list-decimal pl-4 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ children }) => (
          <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[0.85em] text-slate-800">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="mb-1 overflow-x-auto rounded-md bg-slate-100 p-2 font-mono text-xs last:mb-0">
            {children}
          </pre>
        ),
        h1: ({ children }) => <p className="mb-1 font-semibold last:mb-0">{children}</p>,
        h2: ({ children }) => <p className="mb-1 font-semibold last:mb-0">{children}</p>,
        h3: ({ children }) => <p className="mb-1 font-semibold last:mb-0">{children}</p>,
        blockquote: ({ children }) => (
          <blockquote className="mb-1 border-l-2 border-slate-300 pl-2 italic text-slate-500 last:mb-0">
            {children}
          </blockquote>
        ),
        a: () => null, // 不渲染外部链接
        img: () => null, // 不渲染图片
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  operations?: Array<{ tool: string; result: string }>
}

interface AiAssistantPanelProps {
  projectId: string
}

/** 编辑页底部的大模型助手对话框：自然语言编辑本体（登录后可用，对话持久化） */
export default function AiAssistantPanel({ projectId }: AiAssistantPanelProps) {
  const user = useAuthStore((s) => s.user)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sessions, setSessions] = useState<
    Array<{ id: string; title: string; messageCount: number; updatedAt: string }>
  >([])
  const [sessionId, setSessionId] = useState('')
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const addLog = useOperationLogStore((s) => s.addLog)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, expanded, sending])

  // 项目切换：重置会话
  useEffect(() => {
    setMessages([])
    setSessionId('')
    if (user) {
      setSessionsLoading(true)
      apiClient
        .aiListSessions(projectId)
        .then(setSessions)
        .catch(() => setSessions([]))
        .finally(() => setSessionsLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user])

  const refreshSessions = async () => {
    try {
      setSessions(await apiClient.aiListSessions(projectId))
    } catch {
      /* 忽略 */
    }
  }

  const newSession = async () => {
    if (!user) return
    try {
      const s = await apiClient.aiCreateSession(projectId)
      setSessions((prev) => [{ id: s.id, title: s.title, messageCount: 0, updatedAt: '' }, ...prev])
      setSessionId(s.id)
      setMessages([])
    } catch (e) {
      // 忽略
    }
  }

  const openSession = async (id: string) => {
    try {
      const s = await apiClient.aiGetSession(id)
      setSessionId(id)
      setMessages(s.messages.map((m) => ({ role: m.role as ChatMessage['role'], content: m.content })))
    } catch {
      /* 忽略 */
    }
  }

  const deleteSession = async () => {
    if (!sessionId) return
    try {
      await apiClient.aiDeleteSession(sessionId)
    } catch {
      /* 忽略 */
    }
    setSessionId('')
    setMessages([])
    void refreshSessions()
  }

  const send = async () => {
    const text = input.trim()
    if (!text || sending || !user) return
    setInput('')
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)
    // 记录「AI 操作前」快照：AI 修改后可 Ctrl+Z 撤回
    const store = useOntologyStore.getState()
    const before = useHistoryStore.getState().past.length
    useHistoryStore.getState().push(snapshotFrom(store.ontology, store.layout))
    try {
      const res = await apiClient.aiChat(projectId, [...history, { role: 'user', content: text }], sessionId)
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: res.error ?? res.reply ?? '（无回复）',
        operations: res.operations?.length ? res.operations : undefined,
      }
      setMessages((prev) => [...prev, assistantMsg])
      if (res.operations?.length) {
        // 记录 AI 操作日志（undoBefore 指向 AI 前快照）
        for (const op of res.operations) {
          addLog(
            'ai',
            `${toolLabel(op.tool)}${op.result?.slice(0, 40) ? `（${op.result.slice(0, 40)}）` : ''}`,
            before,
          )
        }
        // 刷新画布：保留历史（可撤回 AI 操作）、标记未保存（可保存）
        void reloadProjectData(projectId, { resetHistory: false, markDirty: true })
        void refreshSessions()
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: e instanceof Error ? e.message : '调用失败，请稍后重试' },
      ])
    } finally {
      setSending(false)
    }
  }

  const toolLabel = (name: string) =>
    ({
      add_class: '添加类',
      add_relation: '添加关系',
      add_datatype: '添加数据类型',
      update_class: '更新类',
      delete_class: '删除类',
      delete_relation: '删除关系',
      create_project: '创建项目',
      import_owl: '导入 OWL',
      export_owl: '导出 OWL',
    })[name] ?? name

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white">
      {/* 折叠栏 */}
      <div className="flex items-center justify-between px-4 py-1.5">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary-600"
        >
          <Bot size={14} className="text-primary-600" />
          AI 本体助手
          <span className="text-slate-300">·</span>
          <span className="text-slate-400">用自然语言添加类、建立关系、导入导出…</span>
        </button>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="rounded p-1 text-slate-400 hover:bg-slate-100"
          title={expanded ? '收起' : '展开'}
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>

      {/* 对话区 */}
      {expanded && (
        <div className="flex h-64 flex-col border-t border-slate-100">
          {/* 会话栏 */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-1.5">
            <select
              value={sessionId}
              onChange={(e) => e.target.value && void openSession(e.target.value)}
              disabled={!user || sessionsLoading}
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-primary-500 focus:outline-none"
              title="选择历史对话"
            >
              <option value="">（新对话，未保存）</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || '新对话'}
                  {s.messageCount > 0 ? ` · ${s.messageCount} 条` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => void newSession()}
              disabled={!user}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 disabled:text-slate-300"
              title="新对话"
            >
              <MessageSquarePlus size={13} /> 新对话
            </button>
            {sessionId && (
              <button
                onClick={() => void deleteSession()}
                className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                title="删除当前对话"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <p className="max-w-sm text-center text-xs leading-relaxed text-slate-400">
                  {user ? (
                    <>
                      可以这样问我：
                      <br />「添加一个类叫 梁式桥，作为 桥梁 的子类」
                      <br />「给 清单项 添加数据属性 工程量，值域 decimal」
                    </>
                  ) : (
                    '登录后可与我对话，帮你编辑本体（需先在首页配置大模型）'
                  )}
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {m.role === 'assistant' && m.operations && m.operations.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-1">
                      {m.operations.map((op, j) => (
                        <span
                          key={j}
                          className="flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
                          title={op.result}
                        >
                          <Wrench size={10} />
                          {toolLabel(op.tool)}
                          {op.tool === 'export_owl' && typeof op.result === 'string' && op.result.length > 100 && (
                            <button
                              onClick={() => downloadTextFile(op.result, '导出本体.owl', 'application/rdf+xml')}
                              className="ml-0.5 flex items-center gap-0.5 rounded bg-emerald-600 px-1 py-0.5 text-white hover:bg-emerald-700"
                              title="下载导出的 OWL 文件"
                            >
                              <Download size={9} /> 下载
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.role === 'assistant' ? (
                    <MarkdownReply content={m.content} />
                  ) : (
                    <span className="whitespace-pre-wrap break-words">{m.content}</span>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 size={14} className="animate-spin" /> AI 正在操作本体…
              </div>
            )}
          </div>

          {/* 输入区 */}
          <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              disabled={!user || sending}
              placeholder={user ? '输入指令，回车发送…' : '登录后可用'}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <Button
              variant="primary"
              size="sm"
              icon={sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              onClick={() => void send()}
              disabled={!user || sending || !input.trim()}
            >
              发送
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
