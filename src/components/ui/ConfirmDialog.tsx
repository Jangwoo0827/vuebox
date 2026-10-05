import type { ReactNode } from 'react'
import { Modal } from './Modal'

interface Props {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ open, title, children, confirmLabel = '확인', danger, busy, onConfirm, onClose }: Props) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            취소
          </button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy} data-autofocus>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-text-secondary">{children}</div>
    </Modal>
  )
}
