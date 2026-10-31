import { useEffect, useState } from 'react'
import { useApp } from '@/store/useApp'
import type { Route } from '@/ui/route'
import { Home } from '@/ui/screens/Home'
import { AddHabit } from '@/ui/screens/AddHabit'
import { HabitDetail } from '@/ui/screens/HabitDetail'
import { HallOfFame } from '@/ui/screens/HallOfFame'
import { Settings } from '@/ui/screens/Settings'
import { CelebrationOverlay } from '@/ui/overlay/CelebrationOverlay'
import { StaleSessionDialog } from '@/ui/overlay/StaleSessionDialog'

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
      {kind === 'detail' && id && <HabitDetail key={id} habitId={id} onNavigate={setRoute} />}
      {kind === 'settings' && <Settings onBack={home} />}
      {kind === 'hall' && <HallOfFame onNavigate={setRoute} />}
    </div>
  )
}
