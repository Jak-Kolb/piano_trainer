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

/** VexFlow base duration + optional augmentation dots. */
export interface VexDuration {
  /** Base value: w | h | q | 8 | 16 */
  key: string
  dots: number
  /** Exact beat length in 4/4 (quarter = 1). */
  beats: number
}

/**
 * Pick the closest common note value, including dotted notes.
 * 1.5 → dotted quarter, not quarter + invented eighth rest.
 */
export function durationToVex(
  durationSec: number,
  secPerQuarter: number,
): VexDuration {
  const beats = durationSec / Math.max(0.01, secPerQuarter)
  return beatsToVex(beats)
}

const BEAT_TABLE: VexDuration[] = [
  { key: 'w', dots: 0, beats: 4 },
  { key: 'h', dots: 1, beats: 3 },
  { key: 'h', dots: 0, beats: 2 },
  { key: 'q', dots: 1, beats: 1.5 },
  { key: 'q', dots: 0, beats: 1 },
  { key: '8', dots: 1, beats: 0.75 },
  { key: '8', dots: 0, beats: 0.5 },
  { key: '16', dots: 1, beats: 0.375 },
  { key: '16', dots: 0, beats: 0.25 },
]

export function beatsToVex(beats: number): VexDuration {
  if (beats <= 0) return { key: '16', dots: 0, beats: 0.25 }
  let best = BEAT_TABLE[BEAT_TABLE.length - 1]!
  let bestErr = Infinity
  for (const row of BEAT_TABLE) {
    const err = Math.abs(row.beats - beats)
    // Prefer not rounding a dotted value down to undotted when close
    if (err < bestErr - 0.001) {
      best = row
      bestErr = err
    }
  }
  // If still closer to a larger undotted than a dotted (e.g. 1.4 → 1.5),
  // the min-err pick above already handles it.
  return best
}

export function vexDurationBeats(dur: VexDuration | string): number {
  if (typeof dur !== 'string') return dur.beats
  // legacy string path
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

export type RestSpec = { key: string; dots: number; beats: number }

/** Fill a gap with as few rest glyphs as possible (includes dotted rests). */
export function restDurationsForBeats(beats: number): RestSpec[] {
  const out: RestSpec[] = []
  // Floor to 16th grid so rests never overshoot the gap (keeps voice ticks honest)
  let left = Math.floor(beats * 4 + 1e-9) / 4
  if (left <= 0) return out
  const table: RestSpec[] = [
    { key: 'w', dots: 0, beats: 4 },
    { key: 'h', dots: 1, beats: 3 },
    { key: 'h', dots: 0, beats: 2 },
    { key: 'q', dots: 1, beats: 1.5 },
    { key: 'q', dots: 0, beats: 1 },
    { key: '8', dots: 1, beats: 0.75 },
    { key: '8', dots: 0, beats: 0.5 },
    { key: '16', dots: 1, beats: 0.375 },
    { key: '16', dots: 0, beats: 0.25 },
  ]
  for (const row of table) {
    while (left >= row.beats - 0.001) {
      out.push(row)
      left -= row.beats
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
