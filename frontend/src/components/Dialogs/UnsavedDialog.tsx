import { AlertTriangle, LogOut, Save } from 'lucide-react'
import Button from '../common/Button'
import Modal from '../common/Modal'
import { useUiStore } from '../../store/uiStore'

interface UnsavedDialogProps {
  /** 保存并退出 */
  onSaveAndExit: () => void
  /** 不保存直接退出 */
  onDiscardAndExit: () => void
}

/** 未保存修改退出确认框：保存并退出 / 不保存退出 / 取消 */
export default function UnsavedDialog({ onSaveAndExit, onDiscardAndExit }: UnsavedDialogProps) {
  const open = useUiStore((s) => s.unsavedDialog)
  const hide = useUiStore((s) => s.hideUnsavedDialog)

  return (
    <Modal
      title="有未保存的修改"
      open={open}
      onClose={hide}
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={hide}>
            取消
          </Button>
          <Button variant="ghost" icon={<LogOut size={15} />} onClick={onDiscardAndExit}>
            不保存退出
          </Button>
          <Button variant="primary" icon={<Save size={15} />} onClick={onSaveAndExit}>
            保存并退出
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-amber-50 p-2 text-amber-500">
          <AlertTriangle size={20} />
        </div>
        <div>
          <p className="text-sm text-slate-700">
            当前项目还有未保存的修改（画布内容与节点位置）。退出前是否先保存？
          </p>
          <p className="mt-2 text-xs text-slate-400">
            点击「保存并退出」会先保存到服务器/本地浏览器，再返回项目列表。
          </p>
        </div>
      </div>
    </Modal>
  )
}
