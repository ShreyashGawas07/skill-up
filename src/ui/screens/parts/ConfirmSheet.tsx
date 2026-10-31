import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Sheet } from '@/ui/kit'

interface Props {
  title: string
  children?: ReactNode
  /** Visual shown above the title. */
  art?: ReactNode
  confirmLabel: string
  danger?: boolean
  /** While true, both buttons are disabled and Escape/backdrop do nothing. */
  busy?: boolean
  /** Failure message shown inside the sheet (role=alert); the sheet stays open. */
  error?: string
  onConfirm(): void
  onCancel(): void
  reducedMotion?: boolean
}

/** Bottom-sheet confirmation. Tapping the backdrop or pressing Escape cancels (unless busy). */
export function ConfirmSheet({ title, children, art, confirmLabel, danger, busy, error, onConfirm, onCancel, reducedMotion }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const busyRef = useRef(busy)
  busyRef.current = busy
  const cancel = () => {
    if (!busyRef.current) onCancel()
  }
  const cancelLatest = useRef(cancel)
  cancelLatest.current = cancel

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelLatest.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Sheet label={title} onClose={cancel} reducedMotion={reducedMotion} initialFocus={cancelRef}>
      {art && <div className="mb-3 flex justify-center">{art}</div>}
      <p className="font-display text-lg font-bold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      {error && (
        <p role="alert" className="mt-3 rounded-2xl border-[1.5px] border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-5 flex gap-3">
        <button ref={cancelRef} type="button" disabled={busy} onClick={cancel} className="pill-btn flex-1 bg-surface">
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={`pill-btn flex-1 ${danger ? 'bg-danger text-white' : 'bg-accent text-on-tint'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  )
}
