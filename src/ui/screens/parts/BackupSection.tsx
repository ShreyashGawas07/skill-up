import { useCallback, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { exportBackup, importBackup, parseBackup } from '@/data/backup'
import type { Backup } from '@/data/backup'
import { useApp } from '@/store/useApp'
import { ConfirmSheet } from './ConfirmSheet'
import { Glyph } from './Glyphs'
import { backupFileName, saveBackupFile } from './backupFile'

const tile =
  'flex min-h-[96px] flex-1 flex-col items-center justify-center gap-2 rounded-3xl bg-white/[0.05] font-semibold active:scale-95 disabled:opacity-50'

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** Export (share / download) and import (pick, validate, preview, confirm) of the full backup. */
export function BackupSection({ reducedMotion }: { reducedMotion?: boolean }) {
  const now = useApp((s) => s.now)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [done, setDone] = useState<string>()
  const [pending, setPending] = useState<Backup>()
  const cancel = useCallback(() => setPending(undefined), [])

  const onExport = async () => {
    setBusy(true)
    setError(undefined)
    setDone(undefined)
    try {
      const b = await exportBackup()
      await saveBackupFile(backupFileName(now), JSON.stringify(b, null, 2))
      setDone('Backup saved')
    } catch (e) {
      setError(`Export failed: ${(e as Error)?.message ?? String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setError(undefined)
    setDone(undefined)
    const r = parseBackup(await file.text())
    if (r.ok) setPending(r.backup)
    else setError(r.error)
  }

  const onImport = async (b: Backup) => {
    setBusy(true)
    try {
      await importBackup(b)
      await useApp.getState().load()
      setDone('Backup restored')
    } catch (e) {
      setError(`Import failed: ${(e as Error)?.message ?? String(e)}`)
    } finally {
      setBusy(false)
      setPending(undefined)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <button type="button" disabled={busy} onClick={() => void onExport()} className={tile}>
          <Glyph name="upload" size={28} />
          Export backup
        </button>
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={tile}>
          <Glyph name="download" size={28} />
          Import backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          aria-label="Backup file"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
      {error && (
        <p role="alert" className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="flex items-center gap-2 px-1 text-sm text-[#69db7c]">
          <Glyph name="check" size={16} />
          {done}
        </p>
      )}

      <AnimatePresence>
        {pending && (
          <ConfirmSheet
            title="Replace all data?"
            art={<Glyph name="download" size={40} />}
            confirmLabel="Replace"
            danger
            busy={busy}
            onConfirm={() => void onImport(pending)}
            onCancel={cancel}
            reducedMotion={reducedMotion}
          >
            {plural(pending.habits.length, 'habit')}, {plural(pending.sessions.length, 'session')} will replace current data
          </ConfirmSheet>
        )}
      </AnimatePresence>
    </div>
  )
}
