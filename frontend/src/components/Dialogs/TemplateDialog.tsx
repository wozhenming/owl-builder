import { Sparkles } from 'lucide-react'
import Modal from '../common/Modal'

/** 模板选项（内置或管理员下发） */
export interface TemplateOption {
  id: string
  name: string
  domain: string
  description: string
  icon: string
  /** 来源：builtin = 编辑器内置；server = 管理员上传下发 */
  source: 'builtin' | 'server'
}

interface TemplateDialogProps {
  open: boolean
  onClose: () => void
  templates: TemplateOption[]
  onPick: (option: TemplateOption) => void
}

/** 示例模板选择对话框：管理员下发的模板 + 内置模板 */
export default function TemplateDialog({ open, onClose, templates, onPick }: TemplateDialogProps) {
  return (
    <Modal title="选择示例模板" open={open} onClose={onClose} width="max-w-2xl">
      <p className="mb-4 text-sm text-slate-500">
        选择一个领域的示例本体作为起点，创建后可直接在编辑器中修改。
        {templates.some((t) => t.source === 'server') && ' 含管理员下发的模板。'}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => onPick(t)}
            className="group rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-primary-300 hover:shadow-md"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{t.icon}</span>
              <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-600">
                {t.domain || '未分类'}
              </span>
              {t.source === 'server' && (
                <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">
                  管理员下发
                </span>
              )}
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-800">{t.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{t.description}</p>
            <p className="mt-2 text-xs font-medium text-primary-600 opacity-0 transition-opacity group-hover:opacity-100">
              使用此模板 →
            </p>
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
        <Sparkles size={13} />
        模板创建的是普通项目，可自由编辑、保存与删除。
      </div>
    </Modal>
  )
}
