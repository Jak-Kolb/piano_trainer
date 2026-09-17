import { playPianoNotes } from './pianoPlayer'
import type { PieceNote } from './types'

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
 * How many bars fit on one staff line, from the time signature.
 * Targets ~12 quarter-beats for readable density (cap 4, min 3).
 * 3/4 → 4 bars/line, 4/4 → 3, 6/8-style → 3.
 */
export function barsPerSystem(beatsPerBar: number): number {
  const bpb = Math.max(1, Math.round(beatsPerBar) || 4)
  const TARGET_BEATS = 12
  return Math.max(3, Math.min(4, Math.round(TARGET_BEATS / bpb)))
}
