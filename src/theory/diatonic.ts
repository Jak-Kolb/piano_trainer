/** Chords and facts that come from a major key (for warmups and theory questions). */
import { chordSymbol, type TriadQuality } from './chords'
import { letterAt, letterIndex, mod12, pitchClass, type Accidental, type NoteName } from './notes'
import { majorScale } from './scales'

export interface DiatonicChord {
  /** Scale degree 1–7. */
  degree: number
  /** I, ii, iii, IV, V, vi, vii° */
  roman: string
  root: NoteName
  quality: TriadQuality
  symbol: string
}

const DEGREE_QUALITY: TriadQuality[] = [
  'major',
  'minor',
  'minor',
  'major',
  'major',
  'minor',
  'diminished',
]
const ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']

/** The seven triads built on a major scale. */
export function diatonicTriads(scaleKey: string): DiatonicChord[] {
  const scale = majorScale(scaleKey)
  return DEGREE_QUALITY.map((quality, i) => ({
    degree: i + 1,
    roman: ROMAN[i]!,
    root: scale[i]!,
    quality,
    symbol: chordSymbol(scale[i]!, quality),
  }))
}

export interface Progression {
  name: string
  degrees: number[]
}

export const PROGRESSIONS: Progression[] = [
  { name: 'I–V–vi–IV', degrees: [1, 5, 6, 4] },
  { name: 'I–IV–V–I', degrees: [1, 4, 5, 1] },
  { name: 'ii–V–I', degrees: [2, 5, 1] },
  { name: 'I–vi–IV–V', degrees: [1, 6, 4, 5] },
]

export function progressionChords(scaleKey: string, p: Progression): DiatonicChord[] {
  const triads = diatonicTriads(scaleKey)
  return p.degrees.map((d) => triads[d - 1]!)
}

/** The minor key sharing this key signature (built on the 6th degree). */
export function relativeMinor(scaleKey: string): NoteName {
  return majorScale(scaleKey)[5]!
}

/** Sharps (positive) or flats (negative) in the key signature. */
export function keySignatureCount(scaleKey: string): number {
  let n = 0
  for (const note of majorScale(scaleKey).slice(0, 7)) {
    if (note.accidental === '#') n++
    if (note.accidental === 'b') n--
  }
  return n
}

export function describeKeySignature(count: number): string {
  if (count === 0) return 'No sharps or flats'
  const n = Math.abs(count)
  return `${n} ${count > 0 ? 'sharp' : 'flat'}${n === 1 ? '' : 's'}`
}

/** Accidentals in a key signature, in order (F♯ C♯ … or B♭ E♭ …). */
export function keySignatureNotes(scaleKey: string): NoteName[] {
  return majorScale(scaleKey)
    .slice(0, 7)
    .filter((n) => n.accidental !== '')
}

export interface IntervalDef {
  name: string
  /** Letter steps up (a third is 2 letters above). */
  steps: number
  semitones: number
}

export const QUIZ_INTERVALS: IntervalDef[] = [
  { name: 'major 2nd', steps: 1, semitones: 2 },
  { name: 'minor 3rd', steps: 2, semitones: 3 },
  { name: 'major 3rd', steps: 2, semitones: 4 },
  { name: 'perfect 4th', steps: 3, semitones: 5 },
  { name: 'perfect 5th', steps: 4, semitones: 7 },
  { name: 'major 6th', steps: 5, semitones: 9 },
  { name: 'octave', steps: 7, semitones: 12 },
]

const ACCIDENTALS: Record<number, Accidental> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' }

/** Spell the note an interval above `from` (C up a minor 3rd is E♭, not D♯). */
export function noteAbove(from: NoteName, interval: IntervalDef): NoteName {
  const letter = letterAt(letterIndex(from.letter) + interval.steps)
  const target = mod12(pitchClass(from) + interval.semitones)
  const natural = pitchClass({ letter, accidental: '' })
  let delta = mod12(target - natural)
  if (delta > 6) delta -= 12
  return { letter, accidental: ACCIDENTALS[delta] ?? '' }
}
