import { Bot, History, RotateCcw, User as UserIcon } from 'lucide-react'
import Button from './common/Button'
import Modal from './common/Modal'
import { useOperationLogStore, type OperationLogEntry } from '../store/operationLogStore'
import { applySnapshot, snapshotFrom, useHistoryStore } from '../store/historyStore'
import { suppressHistoryPush, useOntologyStore } from '../store/ontologyStore'
import { useUiStore } from '../store/uiStore'
import { formatRelativeTime } from '../utils/formatters'

/** 撤回：撤销到指定历史位置（该操作之前） */
export function undoTo(before: number): void {
  const history = useHistoryStore.getState()
  const ui = useUiStore.getState()
  const store = useOntologyStore.getState()

  while (history.past.length > before) {
    const snap = history.undo()
    if (!snap) break
    history.recordFuture(snapshotFrom(store.ontology, store.layout))
    suppressHistoryPush(() => {
      store.setOntology(applySnapshot(snap, store.ontology))
      store.setLayout(snap.layout ?? {})
      store.markDirty()
    })
  }
  ui.clearSelection()
  ui.showToast('已撤回该操作及其后的修改', 'info')
}

interface OperationLogDialogProps {
  open: boolean
  onClose: () => void
}

/** 本次打开项目期间的操作记录（用户 + AI），可逐条撤回 */
export default function OperationLogDialog({ open, onClose }: OperationLogDialogProps) {
  const logs = useOperationLogStore((s) => s.logs)
  const pastLength = useHistoryStore((s) => s.past.length)

  const canUndo = (log: OperationLogEntry) => pastLength > log.undoBefore

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
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 !px-1.5 !py-0.5 text-[11px]"
                icon={<RotateCcw size={11} />}
                disabled={!canUndo(log)}
                title="撤回该操作及其之后的所有修改"
                onClick={() => undoTo(log.undoBefore)}
              >
                撤回
              </Button>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
        <History size={13} />
        撤回 = 撤销到该操作之前的状态（连同其后的修改）；撤回后可用 Ctrl+Y 重做。
      </p>
    </Modal>
  )
}
