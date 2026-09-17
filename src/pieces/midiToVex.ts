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

export function vexDurationBeats(dur: string): number {
  switch (dur) {
    case 'w':
      return 4
    case 'h':
      return 2
    case 'q':
      return 1
    case '8':
      return 0.5
    case '16':
      return 0.25
    default:
      return 1
  }
}

/** Rest duration letters to fill remaining beats in 4/4. */
export function restDurationsForBeats(beats: number): string[] {
  const out: string[] = []
  let left = Math.round(beats * 4) / 4 // quarter-grid
  if (left <= 0) return out
  const table: [number, string][] = [
    [4, 'w'],
    [2, 'h'],
    [1, 'q'],
    [0.5, '8'],
    [0.25, '16'],
  ]
  for (const [b, d] of table) {
    while (left >= b - 0.001) {
      out.push(d)
      left -= b
    }
  }
  return out
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
