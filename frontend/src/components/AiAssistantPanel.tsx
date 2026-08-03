import { useEffect, useRef, useState } from 'react'
import { Bot, ChevronDown, ChevronUp, Loader2, Send, Wrench } from 'lucide-react'
import Button from './common/Button'
import { apiClient } from '../services/apiClient'
import { useAuthStore } from '../store/authStore'
import { reloadProjectData } from '../hooks/useOntology'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  operations?: Array<{ tool: string; result: string }>
}

interface AiAssistantPanelProps {
  projectId: string
}

/** 编辑页底部的大模型助手对话框：自然语言编辑本体（登录后可用） */
export default function AiAssistantPanel({ projectId }: AiAssistantPanelProps) {
  const user = useAuthStore((s) => s.user)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, expanded, sending])

  const send = async () => {
    const text = input.trim()
    if (!text || sending || !user) return
    setInput('')
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)
    try {
      const res = await apiClient.aiChat(projectId, [...history, { role: 'user', content: text }])
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: res.error ?? res.reply ?? '（无回复）',
        operations: res.operations?.length ? res.operations : undefined,
      }
      setMessages((prev) => [...prev, assistantMsg])
      // AI 可能修改了本体：刷新画布
      if (res.operations?.length) {
        void reloadProjectData(projectId)
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
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {m.operations.map((op, j) => (
                        <span
                          key={j}
                          className="flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
                          title={op.result}
                        >
                          <Wrench size={10} />
                          {toolLabel(op.tool)}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="whitespace-pre-wrap">{m.content}</span>
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
