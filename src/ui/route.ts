export type Route = 'home' | 'add' | 'settings' | 'hall' | `edit:${string}` | `detail:${string}`

export type Navigate = (to: Route) => void
