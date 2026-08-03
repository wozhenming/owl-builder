import { useEffect, useState } from 'react'
import { Bot, Loader2, Save } from 'lucide-react'
import Button from './common/Button'
import Input from './common/Input'
import Modal from './common/Modal'
import Select from './common/Select'
import { apiClient } from '../services/apiClient'
import { useUiStore } from '../store/uiStore'

/** 大模型供应商预设 */
const PROVIDERS = [
  { key: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { key: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { key: 'qwen', label: '通义千问（阿里云）', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { key: 'kimi', label: 'Kimi（月之暗面）', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { key: 'custom', label: '自定义（OpenAI 兼容）', baseUrl: '', model: '' },
]

interface AiSettingsDialogProps {
  open: boolean
  onClose: () => void
}

/** 大模型配置对话框（首页，登录后使用） */
export default function AiSettingsDialog({ open, onClose }: AiSettingsDialogProps) {
  const showToast = useUiStore((s) => s.showToast)
  const [provider, setProvider] = useState('custom')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [thinking, setThinking] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    apiClient
      .getAiSettings()
      .then((s) => {
        setProvider(s.provider || 'custom')
        setBaseUrl(s.baseUrl)
        setModel(s.model)
        setThinking(s.thinking ?? false)
        setHasApiKey(s.hasApiKey)
        setApiKey('')
      })
      .catch((e) => showToast(e instanceof Error ? e.message : '加载配置失败', 'error'))
      .finally(() => setLoading(false))
  }, [open, showToast])

  const applyProvider = (key: string) => {
    setProvider(key)
    const p = PROVIDERS.find((x) => x.key === key)
    if (p && key !== 'custom') {
      setBaseUrl(p.baseUrl)
      setModel(p.model)
    }
  }

  const save = async () => {
    if (!baseUrl.trim() || !model.trim()) {
      showToast('请填写接口地址与模型名称', 'error')
      return
    }
    if (!apiKey.trim() && !hasApiKey) {
      showToast('请填写 API Key', 'error')
      return
    }
    setSaving(true)
    try {
      await apiClient.saveAiSettings({
        provider,
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(), // 留空时后端保持原 Key（见后端约定）
        model: model.trim(),
        thinking,
      })
      showToast('大模型配置已保存', 'success')
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="AI 助手配置" open={open} onClose={onClose} width="max-w-md">
      <div className="space-y-4">
        <p className="flex items-center gap-1.5 text-xs leading-relaxed text-slate-400">
          <Bot size={14} />
          配置后，项目编辑页底部的大模型对话框可通过自然语言编辑本体（调用 MCP 工具）。
        </p>

        <Select
          label="服务商"
          value={provider}
          onChange={(e) => applyProvider(e.target.value)}
          options={PROVIDERS.map((p) => ({ value: p.key, label: p.label }))}
        />
        <Input
          label="接口地址（Base URL）"
          labelTip="OpenAI 兼容接口地址，如 https://api.deepseek.com/v1"
          required
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
        />
        <Input
          label="API Key"
          labelTip={hasApiKey ? '已设置 Key，留空表示保持不变' : '服务商的 API 密钥'}
          type="password"
          required={!hasApiKey}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={hasApiKey ? '已设置（留空保持不变）' : 'sk-...'}
          autoComplete="off"
        />
        <Input
          label="模型名称"
          required
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="如 gpt-4o-mini / deepseek-chat / qwen-plus"
        />

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 p-3">
          <span>
            <span className="block text-sm font-medium text-slate-800">深度思考</span>
            <span className="block text-xs text-slate-500">
              开启后模型会详细推理（更严谨但较慢）；关闭时快速执行、简要总结
            </span>
          </span>
          <span
            role="switch"
            aria-checked={thinking}
            onClick={() => setThinking((v) => !v)}
            className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
              thinking ? 'bg-primary-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                thinking ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </span>
        </label>

        {loading && (
          <div className="flex items-center justify-center py-2 text-slate-400">
            <Loader2 className="mr-2 animate-spin" size={15} /> 加载配置…
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" icon={saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} onClick={() => void save()} disabled={saving || loading}>
            保存配置
          </Button>
        </div>
      </div>
    </Modal>
  )
}
