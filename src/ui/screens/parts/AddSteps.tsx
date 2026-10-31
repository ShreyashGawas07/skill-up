import { HABIT_COLORS } from '@/ui/theme'
import { HABIT_ICONS, ICON_IDS } from '@/ui/icons'
import { fmtInt } from './format'
import { Glyph } from './Glyphs'

export function NameStep(p: {
  name: string
  icon: string
  color: string
  onName(v: string): void
  onIcon(v: string): void
  onColor(v: string): void
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      <input
        aria-label="Name"
        value={p.name}
        maxLength={30}
        autoFocus
        placeholder="Guitar, Coding, Spanish…"
        onChange={(e) => p.onName(e.target.value)}
        className="w-full rounded-full border-[1.5px] border-line bg-surface px-5 py-4 text-center font-display text-xl font-bold outline-none placeholder:font-semibold placeholder:text-muted/60 focus:ring-2 focus:ring-accent"
      />
      <div role="radiogroup" aria-label="Icon" className="grid grid-cols-6 gap-2">
        {ICON_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={p.icon === id}
            aria-label={id}
            onClick={() => p.onIcon(id)}
            className={`grid h-12 w-12 place-items-center rounded-2xl border-[1.5px] text-2xl transition active:scale-90 ${
              p.icon === id ? 'border-line' : 'border-transparent bg-sunk'
            }`}
            style={p.icon === id ? { background: p.color } : undefined}
          >
            {HABIT_ICONS[id]}
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Colour" className="grid grid-cols-4 gap-x-3">
        {HABIT_COLORS.map((c, i) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={p.color === c}
            aria-label={`Colour ${i + 1}`}
            onClick={() => p.onColor(c)}
            className="grid h-11 w-11 place-items-center rounded-full active:scale-90"
          >
            <span
              className={`grid h-9 w-9 place-items-center rounded-full border-[1.5px] border-line transition ${p.color === c ? 'scale-110' : ''}`}
              style={{ background: c }}
            >
              {p.color === c && <span className="text-on-tint"><Glyph name="check" size={16} /></span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

const PRESETS = [100, 1000, 5000, 10000]
const short = (h: number) => (h >= 1000 ? `${h / 1000}k` : `${h}`)

export function TargetStep(p: { value: number; min: number; color: string; onChange(v: number): void }) {
  const step = p.value >= 1000 ? 500 : 50
  const set = (v: number) => p.onChange(Math.max(p.min, Math.round(v)))
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-5">
        <button type="button" aria-label="Less" onClick={() => set(p.value - step)} className="grid h-14 w-14 place-items-center rounded-full border-[1.5px] border-line bg-surface active:scale-90">
          <Glyph name="minus" size={26} />
        </button>
        <div className="flex min-w-[150px] flex-col items-center">
          <span className="font-display text-5xl font-bold tabular-nums">
            {fmtInt(p.value)}
          </span>
          <span className="label">hours to master</span>
        </div>
        <button type="button" aria-label="More" onClick={() => set(p.value + step)} className="grid h-14 w-14 place-items-center rounded-full border-[1.5px] border-line bg-surface active:scale-90">
          <Glyph name="plus" size={26} />
        </button>
      </div>
      <div className="flex gap-2">
        {PRESETS.filter((h) => h >= p.min).map((h) => (
          <button
            key={h}
            type="button"
            aria-label={`${h} hours`}
            onClick={() => set(h)}
            className={`h-11 min-w-[60px] rounded-full border-[1.5px] px-4 font-display font-bold active:scale-90 ${
              p.value === h ? 'border-line text-on-tint' : 'border-transparent bg-sunk'
            }`}
            style={p.value === h ? { background: p.color } : undefined}
          >
            {short(h)}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ReminderStep(p: { value: string; color: string; onChange(v: string): void }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <p className="max-w-[260px] text-center text-sm text-muted">A nudge at this time if today isn't done yet, plus a last call at 22:30.</p>
      <input
        type="time"
        aria-label="Reminder time"
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        className="rounded-[28px] border-[1.5px] border-line bg-surface px-6 py-4 font-display text-5xl font-bold tabular-nums text-ink outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  )
}
