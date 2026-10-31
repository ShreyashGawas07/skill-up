import { useEffect, useState } from 'react'
import { useApp } from '@/store/useApp'
import type { Route } from '@/ui/route'
import { Home } from '@/ui/screens/Home'
import { AddHabit } from '@/ui/screens/AddHabit'
import { CelebrationOverlay } from '@/ui/overlay/CelebrationOverlay'
import { StaleSessionDialog } from '@/ui/overlay/StaleSessionDialog'

/** Temporary screen until Tasks 10–11 fill detail / settings / hall. */
function Placeholder({ title, onBack }: { title: string; onBack(): void }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-4">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <button type="button" onClick={onBack} className="rounded-2xl bg-white/10 px-6 py-3 font-semibold">
        Back
      </button>
    </div>
  )
}

export default function App() {
  const [route, setRoute] = useState<Route>('home')
  const load = useApp((s) => s.load)
  const tick = useApp((s) => s.tick)
  const isRunning = useApp((s) => !!s.running)

  useEffect(() => {
    void load().catch((e) => console.error('Load failed', e))
  }, [load])

  // Live clock: every second while a timer runs, otherwise once a minute (day rollover, staleness).
  useEffect(() => {
    tick(Date.now())
    const id = setInterval(() => tick(Date.now()), isRunning ? 1000 : 60_000)
    return () => clearInterval(id)
  }, [isRunning, tick])

  const home = () => setRoute('home')
  const [kind, id] = route.split(':') as [string, string | undefined]

  return (
    <div className="min-h-screen bg-[#0b0b12] text-white">
      <CelebrationOverlay />
      <StaleSessionDialog />
      {kind === 'home' && <Home onNavigate={setRoute} />}
      {kind === 'add' && <AddHabit onDone={home} />}
      {kind === 'edit' && <AddHabit key={id} habitId={id} onDone={home} />}
      {kind === 'detail' && <Placeholder title="Habit" onBack={home} />}
      {kind === 'settings' && <Placeholder title="Settings" onBack={home} />}
      {kind === 'hall' && <Placeholder title="Hall of Fame" onBack={home} />}
    </div>
  )
}
