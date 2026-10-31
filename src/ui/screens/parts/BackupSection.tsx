import { useCallback, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { exportBackup, importBackup, parseBackup } from '@/data/backup'
import type { Backup } from '@/data/backup'
import { currentTime, useApp } from '@/store/useApp'
import { ConfirmSheet } from './ConfirmSheet'
import { Glyph } from './Glyphs'
import { backupFileName, saveBackupFile } from './backupFile'

const tile =
  'flex min-h-[96px] flex-1 flex-col items-center justify-center gap-2 rounded-[22px] border-[1.5px] border-line bg-surface font-display font-bold active:scale-95 disabled:opacity-50'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** Export (share / download) and import (pick, validate, preview, confirm) of the full backup. */
export function BackupSection({ reducedMotion }: { reducedMotion?: boolean }) {
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
      await saveBackupFile(backupFileName(currentTime()), JSON.stringify(b, null, 2))
      setDone('Backup saved')
    } catch (e) {
      setError(`Export failed: ${errMsg(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setError(undefined)
    setDone(undefined)
    let text: string
    try {
      text = await file.text()
    } catch (e) {
      setError(`Could not read file: ${errMsg(e)}`)
      return
    }
    const r = parseBackup(text)
    if (r.ok) setPending(r.backup)
    else setError(r.error)
  }

  const onImport = async (b: Backup) => {
    setBusy(true)
    try {
      try {
        await importBackup(b)
      } catch (e) {
        setError(`Import failed: ${errMsg(e)}`)
        return
      }
      try {
        await useApp.getState().load()
        setDone('Backup restored')
      } catch {
        // The data is already replaced on disk; only the in-memory reload failed.
        setError('Restored — reopen the app')
      }
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
        <p role="alert" className="rounded-[18px] border-[1.5px] border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="flex items-center gap-2 px-1 text-sm font-semibold text-[#2f8a4f]">
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
