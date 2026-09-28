/** Metronome clicks from the bar timeline (follows tempo and meter changes). */
import { barQuarters, isCompound } from '../meter'
import { measureInfoAt } from '../tieSlices'
import type { MeasureInfo } from '../types'

export interface Click {
  /** Piece time (sec); count-in clicks are before the start (negative offsets). */
  time: number
  /** Downbeat of the bar. */
  accent: boolean
}

/** Beat length in quarter notes: dotted quarter in 6/8, else the denominator. */
function beatQuarters(m: MeasureInfo): number {
  return isCompound(m) ? 1.5 : 4 / (m.beatUnit || 4)
}

function barClicks(m: MeasureInfo, startSec: number): Click[] {
  const q = barQuarters(m)
  const spq = m.durationSec / Math.max(0.25, q)
  const beat = beatQuarters(m)
  const out: Click[] = []
  for (let k = 0; k * beat < q - 1e-6; k++) {
    out.push({ time: startSec + k * beat * spq, accent: k === 0 })
  }
  return out
}

/** Every beat from the start of `fromBar` to the end of `toBar`. */
export function clickTimes(
  measures: MeasureInfo[],
  fromBar: number,
  toBar: number,
): Click[] {
  const out: Click[] = []
  for (let b = fromBar; b <= toBar; b++) {
    const m = measureInfoAt(measures, b)
    out.push(...barClicks(m, m.startSec))
  }
  return out
}

/** One bar of clicks ending where `bar` begins, in that bar's meter and tempo. */
export function countInClicks(measures: MeasureInfo[], bar: number): Click[] {
  const m = measureInfoAt(measures, bar)
  return barClicks(m, m.startSec - m.durationSec)
}
