import type { PieceNote } from './types'

const PC_NAMES = [
  'c',
  'c#',
  'd',
  'eb',
  'e',
  'f',
  'f#',
  'g',
  'ab',
  'a',
  'bb',
  'b',
] as const

export function midiToVexKey(midi: number): string {
  const pc = ((midi % 12) + 12) % 12
  const oct = Math.floor(midi / 12) - 1
  return `${PC_NAMES[pc]}/${oct}`
}

/** Map note duration in seconds to a VexFlow duration letter. */
export function durationToVex(
  durationSec: number,
  secPerQuarter: number,
): string {
  const beats = durationSec / Math.max(0.01, secPerQuarter)
  if (beats >= 3.5) return 'w'
  if (beats >= 1.75) return 'h'
  if (beats >= 0.875) return 'q'
  if (beats >= 0.4) return '8'
  return '16'
}

export function notesInMeasure(
  notes: PieceNote[],
  measure: number,
): PieceNote[] {
  return notes.filter((n) => n.measure === measure)
}

export function clefForMidi(midi: number): 'treble' | 'bass' {
  return midi < 60 ? 'bass' : 'treble'
}
