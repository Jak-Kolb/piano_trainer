import { mod12 } from './notes'

/** Semitone sizes for common interval qualities used by chords. */
export const INTERVAL_SEMITONES = {
  unison: 0,
  m2: 1,
  M2: 2,
  m3: 3,
  M3: 4,
  P4: 5,
  A4: 6,
  d5: 6,
  P5: 7,
  A5: 8,
  m6: 8,
  M6: 9,
  m7: 10,
  M7: 11,
  P8: 12,
} as const

export type IntervalName = keyof typeof INTERVAL_SEMITONES

export function addSemitones(pc: number, semitones: number): number {
  return mod12(pc + semitones)
}
