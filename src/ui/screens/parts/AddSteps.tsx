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
      <div
        className="grid h-24 w-24 place-items-center rounded-[28px] text-5xl"
        style={{ background: `radial-gradient(circle at 35% 30%, ${p.color}aa, ${p.color}33)`, boxShadow: `0 0 40px ${p.color}55` }}
        aria-hidden
      >
        {HABIT_ICONS[p.icon]}
      </div>
      <input
        aria-label="Name"
        value={p.name}
        maxLength={30}
        autoFocus
        placeholder="Guitar, Coding, Spanish…"
        onChange={(e) => p.onName(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center font-display text-2xl font-semibold outline-none placeholder:text-white/25 focus:border-white/30"
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
            className="grid h-12 w-12 place-items-center rounded-2xl text-2xl transition active:scale-90"
            style={{
              background: p.icon === id ? `${p.color}44` : 'rgba(255,255,255,.05)',
              boxShadow: p.icon === id ? `inset 0 0 0 2px ${p.color}` : undefined,
            }}
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
              className="h-8 w-8 rounded-full transition"
              style={{
                background: c,
                boxShadow: p.color === c ? `0 0 0 3px #0b0b12, 0 0 0 5px ${c}, 0 0 16px ${c}` : undefined,
              }}
            />
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
      <div className="text-6xl" aria-hidden>🏆</div>
      <div className="flex items-center gap-5">
        <button type="button" aria-label="Less" onClick={() => set(p.value - step)} className="grid h-14 w-14 place-items-center rounded-full bg-white/10 active:scale-90">
          <Glyph name="minus" size={26} />
        </button>
        <div className="flex min-w-[150px] flex-col items-center">
          <span className="font-display text-5xl font-bold tabular-nums" style={{ textShadow: `0 0 24px ${p.color}` }}>
            {fmtInt(p.value)}
          </span>
          <span className="text-sm text-white/50">hours</span>
        </div>
        <button type="button" aria-label="More" onClick={() => set(p.value + step)} className="grid h-14 w-14 place-items-center rounded-full bg-white/10 active:scale-90">
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
            className="h-11 min-w-[56px] rounded-full px-4 font-display font-semibold active:scale-90"
            style={{ background: p.value === h ? p.color : 'rgba(255,255,255,.07)', color: p.value === h ? '#0b0b12' : undefined }}
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
      <div className="text-6xl" aria-hidden>🔔</div>
      <input
        type="time"
        aria-label="Reminder time"
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        className="rounded-3xl border-2 bg-white/5 px-6 py-4 font-display text-5xl font-bold tabular-nums outline-none [color-scheme:dark]"
        style={{ borderColor: p.color }}
      />
    </div>
  )
}
