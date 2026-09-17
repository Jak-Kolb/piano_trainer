import type { PieceNote } from './types'

/** Schedule oscillators for notes; returns stop(). */
export async function playNotesDemo(
  notes: PieceNote[],
  tempoPercent: number,
): Promise<{
  stop: () => void
  originSec: number
  endSec: number
  startedAt: number
}> {
  const ctx = new AudioContext()
  await ctx.resume()
  const tempoFactor = Math.max(0.25, tempoPercent / 100)
  const originSec = notes[0]?.time ?? 0
  const endSec =
    notes.reduce((m, n) => Math.max(m, n.time + n.duration), originSec) + 0.05
  const startedAt = performance.now()
  const oscillators: OscillatorNode[] = []

  for (const n of notes) {
    const when = ctx.currentTime + (n.time - originSec) / tempoFactor
    const dur = Math.max(0.05, n.duration / tempoFactor)
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = 440 * 2 ** ((n.midi - 69) / 12)
    g.gain.value = 0.05
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(when)
    osc.stop(when + dur)
    oscillators.push(osc)
  }

  const stop = () => {
    for (const o of oscillators) {
      try {
        o.stop()
      } catch {
        /* already stopped */
      }
    }
    void ctx.close()
  }

  return { stop, originSec, endSec, startedAt }
}

export function lineStartMeasure(measure: number, barsPerLine = 8): number {
  return (
    Math.floor((Math.max(1, measure) - 1) / barsPerLine) * barsPerLine + 1
  )
}
