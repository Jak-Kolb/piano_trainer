import { INTERVAL_SEMITONES, addSemitones } from './intervals'
import {
  type Accidental,
  type Letter,
  type NoteName,
  formatNoteName,
  letterAt,
  letterIndex,
  mod12,
  pitchClass,
} from './notes'

export type TriadQuality =
  | 'major'
  | 'minor'
  | 'diminished'
  | 'augmented'
  | 'sus2'
  | 'sus4'

export type SeventhQuality = 'dom7' | 'maj7' | 'm7'

export type ChordQuality = TriadQuality | SeventhQuality

export type Inversion = 0 | 1 | 2

/** Interval stack from root in semitones (chord tones only). */
const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  major: [0, INTERVAL_SEMITONES.M3, INTERVAL_SEMITONES.P5],
  minor: [0, INTERVAL_SEMITONES.m3, INTERVAL_SEMITONES.P5],
  diminished: [0, INTERVAL_SEMITONES.m3, INTERVAL_SEMITONES.d5],
  augmented: [0, INTERVAL_SEMITONES.M3, INTERVAL_SEMITONES.A5],
  sus2: [0, INTERVAL_SEMITONES.M2, INTERVAL_SEMITONES.P5],
  sus4: [0, INTERVAL_SEMITONES.P4, INTERVAL_SEMITONES.P5],
  dom7: [0, INTERVAL_SEMITONES.M3, INTERVAL_SEMITONES.P5, INTERVAL_SEMITONES.m7],
  maj7: [0, INTERVAL_SEMITONES.M3, INTERVAL_SEMITONES.P5, INTERVAL_SEMITONES.M7],
  m7: [0, INTERVAL_SEMITONES.m3, INTERVAL_SEMITONES.P5, INTERVAL_SEMITONES.m7],
}

/** Scale-degree letter offsets from root for triad members (root, third/sus, fifth). */
const TRIAD_LETTER_STEPS: Record<TriadQuality, [number, number, number]> = {
  major: [0, 2, 4],
  minor: [0, 2, 4],
  diminished: [0, 2, 4],
  augmented: [0, 2, 4],
  sus2: [0, 1, 4],
  sus4: [0, 3, 4],
}

const NATURAL_PC: Record<Letter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

function accidentalForPc(letter: Letter, targetPc: number): Accidental {
  const natural = NATURAL_PC[letter]
  const delta = mod12(targetPc - natural)
  // Prefer simplest accidental toward target within ±2
  const signed = delta > 6 ? delta - 12 : delta
  if (signed === 0) return ''
  if (signed === 1) return '#'
  if (signed === 2) return '##'
  if (signed === -1) return 'b'
  if (signed === -2) return 'bb'
  // Fallback: force sharp/flat path
  if (signed > 0) return signed === 1 ? '#' : '##'
  return signed === -1 ? 'b' : 'bb'
}

export interface SpelledChord {
  root: NoteName
  quality: ChordQuality
  notes: NoteName[]
  pitchClasses: number[]
}

/**
 * Spell a chord from a root note name and quality.
 * Letters follow diatonic thirds (or sus steps); accidentals hit the interval PCs.
 */
export function spellChord(root: NoteName, quality: ChordQuality): SpelledChord {
  const intervals = QUALITY_INTERVALS[quality]
  const rootPc = pitchClass(root)
  const pitchClasses = intervals.map((i) => addSemitones(rootPc, i))

  const triadQuality: TriadQuality =
    quality === 'dom7' || quality === 'maj7'
      ? 'major'
      : quality === 'm7'
        ? 'minor'
        : (quality as TriadQuality)

  const steps = TRIAD_LETTER_STEPS[triadQuality]
  const rootLi = letterIndex(root.letter)
  const notes: NoteName[] = steps.map((step, idx) => {
    const letter = letterAt(rootLi + step)
    const targetPc = pitchClasses[idx]!
    return { letter, accidental: accidentalForPc(letter, targetPc) }
  })

  if (quality === 'dom7' || quality === 'maj7' || quality === 'm7') {
    const seventhPc = pitchClasses[3]!
    const letter = letterAt(rootLi + 6)
    notes.push({ letter, accidental: accidentalForPc(letter, seventhPc) })
  }

  return { root, quality, notes, pitchClasses }
}

/** Chromatic roots spelled with preferred accidental for isolated (no key) context. */
export const CHROMATIC_ROOTS: NoteName[] = [
  { letter: 'C', accidental: '' },
  { letter: 'C', accidental: '#' },
  { letter: 'D', accidental: '' },
  { letter: 'E', accidental: 'b' },
  { letter: 'E', accidental: '' },
  { letter: 'F', accidental: '' },
  { letter: 'F', accidental: '#' },
  { letter: 'G', accidental: '' },
  { letter: 'A', accidental: 'b' },
  { letter: 'A', accidental: '' },
  { letter: 'B', accidental: 'b' },
  { letter: 'B', accidental: '' },
]

export function chordSymbol(root: NoteName, quality: TriadQuality | SeventhQuality): string {
  const r = formatNoteName(root)
  switch (quality) {
    case 'major':
      return r
    case 'minor':
      return `${r}m`
    case 'diminished':
      return `${r}dim`
    case 'augmented':
      return `${r}aug`
    case 'sus2':
      return `${r}sus2`
    case 'sus4':
      return `${r}sus4`
    case 'dom7':
      return `${r}7`
    case 'maj7':
      return `${r}maj7`
    case 'm7':
      return `${r}m7`
  }
}

/** True if held pitch classes match the chord (any octave/voicing/doubling). */
export function pitchClassesMatchChord(
  held: Iterable<number>,
  chordPcs: number[],
): boolean {
  const heldSet = new Set([...held].map(mod12))
  const need = new Set(chordPcs.map(mod12))
  if (heldSet.size !== need.size) return false
  for (const pc of need) {
    if (!heldSet.has(pc)) return false
  }
  return true
}

export function invertNotes(notes: NoteName[], inversion: Inversion): NoteName[] {
  if (inversion === 0) return [...notes]
  const copy = [...notes]
  for (let i = 0; i < inversion; i++) {
    const n = copy.shift()
    if (n) copy.push(n)
  }
  return copy
}
