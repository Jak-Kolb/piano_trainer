import { barQuarters } from './meter'
import { playPianoNotes } from './pianoPlayer'
import type { MeasureInfo, PieceNote } from './types'

/** Schedule piano demo notes; returns stop/pause/resume. */
export async function playNotesDemo(
  notes: PieceNote[],
  tempoPercent: number,
): Promise<{
  stop: () => void
  pause: () => void
  resume: () => void
  originSec: number
  endSec: number
  startedAt: number
}> {
  return playPianoNotes(notes, tempoPercent)
}

export function lineStartMeasure(measure: number, barsPerLine = 8): number {
  return (
    Math.floor((Math.max(1, measure) - 1) / barsPerLine) * barsPerLine + 1
  )
}

/**
 * How many bars fit on one staff line, from the bar length in quarter notes.
 * Targets ~24 quarter-beats of music (was a fixed 8 bars = 32 in 4/4).
 */
export function barsPerSystem(quartersPerBar: number): number {
  const bpb = Math.max(1, Math.round(quartersPerBar) || 4)
  const TARGET_BEATS = 24
  return Math.max(3, Math.min(8, Math.round(TARGET_BEATS / bpb)))
}

/** Most common bar length in quarter notes (so a pickup bar doesn't decide). */
export function dominantBarQuarters(measures: MeasureInfo[]): number {
  const counts = new Map<number, number>()
  let best = 4
  let bestCount = 0
  for (const m of measures) {
    const q = Math.round(barQuarters(m) * 1000) / 1000
    const c = (counts.get(q) ?? 0) + 1
    counts.set(q, c)
    if (c > bestCount) {
      best = q
      bestCount = c
    }
  }
  return best
}
