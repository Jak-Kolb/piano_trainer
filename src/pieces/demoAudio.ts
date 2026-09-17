import { playPianoNotes } from './pianoPlayer'
import type { PieceNote } from './types'

/** Schedule piano demo notes; returns stop(). */
export async function playNotesDemo(
  notes: PieceNote[],
  tempoPercent: number,
): Promise<{
  stop: () => void
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
