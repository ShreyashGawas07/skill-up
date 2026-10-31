/** Habit icon ids (stored on Habit.icon) mapped to the glyph shown in the UI. */
export const HABIT_ICONS: Record<string, string> = {
  book: '📚',
  code: '💻',
  guitar: '🎸',
  piano: '🎹',
  gym: '🏋️',
  run: '🏃',
  art: '🎨',
  write: '✍️',
  language: '🗣️',
  chess: '♟️',
  mind: '🧘',
  camera: '📷',
}

export const ICON_IDS = Object.keys(HABIT_ICONS)

export const iconGlyph = (id: string): string => HABIT_ICONS[id] ?? '⭐'
