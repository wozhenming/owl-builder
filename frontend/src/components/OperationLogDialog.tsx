import { Bot, History, User as UserIcon } from 'lucide-react'
import Modal from './common/Modal'
import { useOperationLogStore } from '../store/operationLogStore'
import { formatRelativeTime } from '../utils/formatters'

interface OperationLogDialogProps {
  open: boolean
  onClose: () => void
}

/** 本次打开项目期间的操作记录（用户 + AI） */
export default function OperationLogDialog({ open, onClose }: OperationLogDialogProps) {
  const logs = useOperationLogStore((s) => s.logs)

  return (
    <Modal title="历史操作（本次打开）" open={open} onClose={onClose} width="max-w-lg">
      {logs.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">本次打开项目后还没有操作记录</p>
      ) : (
        <ol className="max-h-80 space-y-1 overflow-y-auto">
          {[...logs].reverse().map((log) => (
            <li key={log.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
              <span
                className={`mt-0.5 rounded p-0.5 ${
                  log.actor === 'ai' ? 'bg-primary-50 text-primary-600' : 'bg-slate-100 text-slate-500'
                }`}
                title={log.actor === 'ai' ? 'AI 助手' : '用户'}
              >
                {log.actor === 'ai' ? <Bot size={12} /> : <UserIcon size={12} />}
              </span>
              <span className="flex-1 text-sm text-slate-700">{log.text}</span>
              <span className="shrink-0 text-xs text-slate-300">{formatRelativeTime(log.time)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
        <History size={13} />
        仅记录本次打开项目期间的操作；AI 的修改可用 Ctrl+Z 撤回，未保存时可点击「保存」。
      </p>
    </Modal>
  )
}
