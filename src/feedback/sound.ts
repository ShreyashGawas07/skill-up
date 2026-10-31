/**
 * Tiny synthesised chimes (Web Audio API) so no audio files are bundled.
 * - win: quick rising arpeggio
 * - big: longer arpeggio with a sparkling top (rank up, formed, eternal)
 * - loss: soft low thud with a falling pitch
 * Every call is fire-and-forget and silently does nothing without AudioContext (jsdom, old WebViews).
 */
export type Cue = 'win' | 'big' | 'loss'

type Ctor = typeof AudioContext
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (ctx) return ctx
  const w = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
  const AC = w.AudioContext ?? w.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  return ctx
}

function tone(ac: AudioContext, out: AudioNode, freq: number, at: number, dur: number, type: OscillatorType, peak: number, toFreq?: number) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, at)
  if (toFreq) osc.frequency.exponentialRampToValueAtTime(toFreq, at + dur)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(gain).connect(out)
  osc.start(at)
  osc.stop(at + dur + 0.05)
}

const NOTE = { C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.5, G6: 1568 }

export function playCue(cue: Cue): void {
  try {
    const ac = audio()
    if (!ac) return
    if (ac.state === 'suspended') void ac.resume().catch(() => {})
    const master = ac.createGain()
    master.gain.value = 0.5
    master.connect(ac.destination)
    const t = ac.currentTime + 0.02
    if (cue === 'loss') {
      tone(ac, master, 150, t, 0.45, 'sine', 0.7, 55)
      tone(ac, master, 300, t, 0.12, 'triangle', 0.15, 120)
      return
    }
    const notes = cue === 'big' ? [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6] : [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6]
    const step = cue === 'big' ? 0.075 : 0.085
    notes.forEach((f, i) => tone(ac, master, f, t + i * step, 0.35, 'triangle', 0.32))
    const end = t + notes.length * step
    tone(ac, master, notes[notes.length - 1] * 2, end, cue === 'big' ? 0.9 : 0.5, 'sine', 0.12)
  } catch {
    // audio unavailable — celebrations are still visual
  }
}
