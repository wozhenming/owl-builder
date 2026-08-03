import { AlertTriangle } from 'lucide-react'
import Button from '../common/Button'
import Modal from '../common/Modal'
import { useUiStore } from '../../store/uiStore'

/** 通用确认对话框（删除项目等危险操作） */
export default function ConfirmDialog() {
  const open = useUiStore((s) => s.dialogs.confirm)
  const { title, message, onConfirm } = useUiStore((s) => s.confirmState)
  const hideConfirm = useUiStore((s) => s.hideConfirm)

  const handleConfirm = () => {
    hideConfirm()
    onConfirm?.()
  }

  return (
    <Modal
      title={title}
      open={open}
      onClose={hideConfirm}
      width="max-w-md"
      zIndex="z-[70]"
      footer={
        <>
          <Button variant="secondary" onClick={hideConfirm}>
            取消
          </Button>
          <Button variant="danger" onClick={handleConfirm}>
            确认删除
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-red-50 p-2 text-red-500">
          <AlertTriangle size={20} />
        </div>
        <div>
          <p className="text-sm text-slate-700">{message}</p>
          <p className="mt-2 text-xs text-slate-400">此操作不可恢复，请谨慎确认。</p>
        </div>
      </div>
    </Modal>
  )
}
