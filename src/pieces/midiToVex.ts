import type { PieceNote } from './types'

const PC_SHARP = [
  'c',
  'c#',
  'd',
  'd#',
  'e',
  'f',
  'f#',
  'g',
  'g#',
  'a',
  'a#',
  'b',
] as const

const PC_FLAT = [
  'c',
  'db',
  'd',
  'eb',
  'e',
  'f',
  'gb',
  'g',
  'ab',
  'a',
  'bb',
  'b',
] as const

/**
 * Flat-key signatures, major and minor (VexFlow key names) → pitch class of
 * the relative minor's leading tone, which is written as a sharp even in a
 * flat key (C# in F major / D minor, not Db).
 */
const FLAT_KEY_LEADING_TONE = new Map<string, number>([
  ['F', 1],
  ['Dm', 1],
  ['Bb', 6],
  ['Gm', 6],
  ['Eb', 11],
  ['Cm', 11],
  ['Ab', 4],
  ['Fm', 4],
  ['Db', 9],
  ['Bbm', 9],
  ['Gb', 2],
  ['Ebm', 2],
  ['Cb', 7],
  ['Abm', 7],
])

export function keyPrefersFlats(keySignature: string): boolean {
  return FLAT_KEY_LEADING_TONE.has((keySignature || 'C').trim())
}

/**
 * MIDI → VexFlow key. Spelling follows the piece key so chromatics in
 * sharp keys use sharps (A# not Bb) and flat keys use flats, except the
 * relative minor's leading tone.
 */
export function midiToVexKey(midi: number, keySignature = 'C'): string {
  const pc = ((midi % 12) + 12) % 12
  const oct = Math.floor(midi / 12) - 1
  const leading = FLAT_KEY_LEADING_TONE.get((keySignature || 'C').trim())
  const names = leading === undefined || pc === leading ? PC_SHARP : PC_FLAT
  return `${names[pc]}/${oct}`
}

/** VexFlow base duration + optional augmentation dots. */
export interface VexDuration {
  /** Base value: w | h | q | 8 | 16 */
  key: string
  dots: number
  /** Exact beat length in 4/4 (quarter = 1). */
  beats: number
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

export function notesInMeasure(
  notes: PieceNote[],
  measure: number,
): PieceNote[] {
  return notes.filter((n) => n.measure === measure)
}

export function clefForMidi(midi: number): 'treble' | 'bass' {
  return midi < 60 ? 'bass' : 'treble'
}
