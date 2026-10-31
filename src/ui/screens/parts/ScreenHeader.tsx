import type { ReactNode } from 'react'
import { Glyph } from './Glyphs'

export const iconBtn = 'grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/5 text-white/80 active:scale-90'

/** Back button + title row shared by the secondary screens. */
export function ScreenHeader({ title, onBack, children }: { title: ReactNode; onBack(): void; children?: ReactNode }) {
  return (
    <header className="mb-4 flex items-center gap-3">
      <button type="button" aria-label="Back" className={iconBtn} onClick={onBack}>
        <Glyph name="back" />
      </button>
      <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-bold tracking-tight">{title}</h1>
      {children}
    </header>
  )
}
