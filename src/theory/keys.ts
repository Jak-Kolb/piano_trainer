import type { NoteName } from './notes'

export type KeyMode = 'major' | 'naturalMinor' | 'harmonicMinor'

export interface KeySignature {
  name: string
  tonic: NoteName
  mode: KeyMode
  /** Pitch classes in the key scale (ascending). */
  scalePcs: number[]
}

/** Six-month major set from the spec. */
export const MAJOR_KEYS_SIX_MONTH: NoteName[] = [
  { letter: 'C', accidental: '' },
  { letter: 'G', accidental: '' },
  { letter: 'D', accidental: '' },
  { letter: 'A', accidental: '' },
  { letter: 'E', accidental: '' },
  { letter: 'F', accidental: '' },
]

/** Six-month minor set. */
export const MINOR_KEYS_SIX_MONTH: NoteName[] = [
  { letter: 'A', accidental: '' },
  { letter: 'E', accidental: '' },
  { letter: 'D', accidental: '' },
]
