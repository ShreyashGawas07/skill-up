/** Small stroke icons for buttons. Decorative unless a label is given. */
type Name =
  | 'plus' | 'lock' | 'gear' | 'pencil' | 'trophy' | 'back' | 'next' | 'check' | 'minus'
  | 'trash' | 'bell' | 'bellOff' | 'upload' | 'download' | 'close' | 'sound' | 'mute' | 'motion' | 'alarm'
  | 'home' | 'clock' | 'chart' | 'sun' | 'moon' | 'auto' | 'target' | 'bolt' | 'play' | 'stop' | 'pause'

const PATHS: Record<Name, string> = {
  home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  chart: 'M4 20h16M7 16v-4M12 16V8M17 16v-7',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  auto: 'M12 21a9 9 0 1 0 0-18v18zM12 3a9 9 0 0 1 0 18',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6l1-7z',
  play: 'M8 5.5v13l10-6.5z',
  stop: 'M7 7h10v10H7z',
  pause: 'M7 5h3v14H7zM14 5h3v14h-3z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
  gear:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6v4H9z',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  check: 'M5 12l5 5L19 7',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2zM10 21h4',
  bellOff: 'M6 16V11a6 6 0 0 1 9.5-4.9M18 11v5l2 2H8M10 21h4M3 3l18 18',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  close: 'M6 6l12 12M18 6L6 18',
  sound: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12',
  mute: 'M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6',
  motion: 'M3 12h4M5 7h6M5 17h6M13 12a5 5 0 1 0 10 0 5 5 0 0 0-10 0',
  alarm: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2 2M5 3L2 6M19 3l3 3',
}

export function Glyph({ name, size = 22, label }: { name: Name; size?: number; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
