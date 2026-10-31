import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { haptic } from '@/feedback/haptics'
import { LockedSheet } from './screens/parts/LockedSheet'
import { Glyph } from './screens/parts/Glyphs'

type GlyphName = Parameters<typeof Glyph>[0]['name']

/** Round outlined icon button; `accent` fills it with the brand yellow (back buttons). */
export function IconButton({
  icon, label, onClick, accent, disabled, size = 44,
}: { icon: GlyphName; label: string; onClick(): void; accent?: boolean; disabled?: boolean; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{ width: size, height: size }}
      className={`grid shrink-0 place-items-center rounded-full border-[1.5px] border-line text-ink transition-transform active:scale-90 disabled:opacity-30 ${
        accent ? 'bg-accent !text-on-tint' : 'bg-surface'
      }`}
    >
      <Glyph name={icon} size={18} />
    </button>
  )
}

/** Screen title row: yellow back button, centred uppercase title, optional right action. */
export function TopBar({ title, onBack, right }: { title: ReactNode; onBack?(): void; right?: ReactNode }) {
  return (
    <header className="flex h-14 items-center gap-3">
      <div className="flex w-11 justify-start">{onBack && <IconButton icon="back" label="Back" accent onClick={onBack} />}</div>
      <h1 className="min-w-0 flex-1 truncate text-center font-display text-base font-bold uppercase tracking-[0.14em]">
        {title}
      </h1>
      <div className="flex w-11 justify-end">{right}</div>
    </header>
  )
}

/** A big number with a two-line caption beside it, as in "6,248 STEPS WALKED". */
export function BigStat({ value, caption, icon }: { value: ReactNode; caption: [string, string]; icon?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {icon}
      <span className="font-display text-[34px] font-bold leading-none tracking-tight tabular-nums">{value}</span>
      <span className="font-display text-[11px] font-bold uppercase leading-tight tracking-wider">
        {caption[0]}
        <br />
        {caption[1]}
      </span>
    </div>
  )
}

/** Outlined pill track with a rounded fill; an optional gold overtime segment past 100%. */
export function ProgressPill({
  value, over = 0, color, height = 22, marker, testId, label,
}: { value: number; over?: number; color: string; height?: number; marker?: number; testId?: string; label?: string }) {
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
  const o = Math.min(1, Math.max(0, over))
  return (
    <div
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(v * 100) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      className="relative w-full rounded-full border-[1.5px] border-line bg-surface p-[3px]"
      style={{ height }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-full">
        <motion.div
          data-testid={testId}
          className="h-full rounded-full border-[1.5px] border-line"
          style={{ background: color, minWidth: v > 0 ? height - 8 : 0, borderWidth: v > 0 ? 1.5 : 0 }}
          initial={false}
          animate={{ width: `${v * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
        {o > 0 && (
          <motion.div
            data-testid="overdrive"
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: 'repeating-linear-gradient(135deg, #f5b324 0 6px, #f8cf5e 6px 12px)',
              mixBlendMode: 'multiply',
            }}
            initial={false}
            animate={{ width: `${o * 100}%` }}
          />
        )}
      </div>
      {marker !== undefined && (
        <div
          data-testid="next-tier"
          aria-hidden
          className="absolute -top-1 -bottom-1 w-[2px] rounded-full bg-ink"
          style={{ left: `${Math.min(99.5, marker * 100)}%` }}
        />
      )}
    </div>
  )
}

/** Small outlined stat tile: value + label, with an icon in the corner. */
export function StatTile({ label, icon, children, tint }: { label: string; icon?: ReactNode; children: ReactNode; tint?: string }) {
  return (
    <div role="group" aria-label={label} className="relative flex min-h-[88px] flex-col justify-end rounded-[18px] border-[1.5px] border-line bg-surface px-3 pb-2.5 pt-7">
      {icon && (
        <span className="absolute right-2.5 top-2.5 text-muted" style={tint ? { color: tint } : undefined}>
          {icon}
        </span>
      )}
      <div className="font-display text-xl font-bold leading-tight tabular-nums">{children}</div>
      <div className="mt-0.5 text-[11px] font-medium leading-tight text-muted">{label}</div>
    </div>
  )
}

/** Daily / Weekly / Monthly style switch: the chosen option gets an outlined pill. */
export function Segmented<T extends string>({
  options, value, onChange, label, accent,
}: { options: { value: T; label: string }[]; value: T; onChange(v: T): void; label: string; accent?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center justify-between gap-1">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-[40px] flex-1 rounded-full font-display text-xs font-bold uppercase tracking-wider transition-colors ${
              on ? 'border-[1.5px] border-line bg-surface text-ink' : 'border-[1.5px] border-transparent text-muted'
            }`}
            style={on && accent ? { background: accent, color: '#28221e' } : undefined}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export interface StripDay {
  key: string
  weekday: string
  date: number
  /** Colours of habits whose commitment was met that day. */
  dots: string[]
  missed?: boolean
  future?: boolean
}

/** Mon–Sun row; the selected day sits in an outlined capsule with an ink date bubble. */
export function WeekStrip({ days, selected }: { days: StripDay[]; selected: string }) {
  return (
    <ol aria-label="This week" className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const on = d.key === selected
        return (
          <li
            key={d.key}
            aria-label={`${d.weekday} ${d.date}${d.dots.length ? ', done' : d.missed ? ', missed' : ''}`}
            className={`flex flex-col items-center gap-1.5 rounded-full py-2 ${on ? 'border-[1.5px] border-on-tint/90' : ''} ${
              d.future ? 'opacity-50' : ''
            }`}
          >
            <span className="font-display text-[10px] font-semibold uppercase tracking-wider text-on-tint/75">{d.weekday}</span>
            <span
              className={`grid h-8 w-8 place-items-center rounded-full font-display text-sm font-bold ${
                on ? 'bg-on-tint text-white' : 'text-on-tint'
              }`}
            >
              {d.date}
            </span>
            <span className="flex h-2 gap-0.5" aria-hidden>
              {d.dots.map((c, i) => (
                <span key={i} className="grid h-2 w-2 place-items-center rounded-full bg-on-tint">
                  <span className="h-[3px] w-[3px] rounded-full" style={{ background: c }} />
                </span>
              ))}
              {!d.dots.length && d.missed && <span className="h-2 w-2 rounded-full border-[1.5px] border-on-tint/40" />}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export type Tab = 'home' | 'hall' | 'settings'

/** Floating yellow pill navigation. With both slots full, "+" shows the locked sheet instead. */
export function BottomNav({
  current, onTab, onAdd, addLocked, reducedMotion,
}: { current: Tab; onTab(t: Tab): void; onAdd(): void; addLocked: boolean; reducedMotion?: boolean }) {
  const [locked, setLocked] = useState(false)
  const add = () => {
    if (!addLocked) return onAdd()
    haptic.warn()
    setLocked(true)
  }
  const item = (t: Tab, icon: GlyphName, label: string) => {
    const on = current === t
    return (
      <button
        type="button"
        aria-label={label}
        aria-current={on ? 'page' : undefined}
        onClick={() => onTab(t)}
        className={`grid h-11 w-11 place-items-center rounded-full transition-transform active:scale-90 ${
          on ? 'bg-on-tint text-accent' : 'text-on-tint'
        }`}
      >
        <Glyph name={icon} size={21} />
      </button>
    )
  }
  return (
    <>
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-4"
      style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-around rounded-full border-[1.5px] border-line bg-accent px-3 py-1.5 shadow-[0_8px_24px_rgba(40,34,30,0.18)]">
        {item('home', 'home', 'Home')}
        <button
          type="button"
          aria-label={addLocked ? 'Add habit (locked)' : 'Add habit'}
          onClick={add}
          className={`grid h-11 w-11 place-items-center rounded-full border-[1.5px] border-on-tint text-on-tint transition-transform active:scale-90 ${
            addLocked ? 'opacity-50' : 'bg-white/60'
          }`}
        >
          <Glyph name={addLocked ? 'lock' : 'plus'} size={21} />
        </button>
        {item('hall', 'trophy', 'Hall of Fame')}
        {item('settings', 'gear', 'Settings')}
      </div>
    </nav>
    <AnimatePresence>{locked && <LockedSheet onClose={() => setLocked(false)} reducedMotion={reducedMotion} />}</AnimatePresence>
    </>
  )
}

/** Backdrop + bottom sheet panel shared by every dialog. */
export function Sheet({
  label, onClose, children, reducedMotion, initialFocus,
}: {
  label: string
  onClose(): void
  children: ReactNode
  reducedMotion?: boolean
  initialFocus?: React.RefObject<HTMLElement>
}) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ;(initialFocus?.current ?? panel.current)?.focus()
  }, [initialFocus])
  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[#28221e]/45 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="mb-4 w-[calc(100%-32px)] max-w-sm rounded-[28px] border-[1.5px] border-line bg-surface p-6 text-center outline-none"
        style={{ marginBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        initial={reducedMotion ? { opacity: 0 } : { y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
