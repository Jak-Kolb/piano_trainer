import { describe, expect, it } from 'vitest'
import {
  CHROMATIC_ROOTS,
  invertNotes,
  pitchClassesMatchChord,
  spellChord,
  type TriadQuality,
} from './chords'
import { formatNoteName, type NoteName, pitchClass } from './notes'

function names(notes: NoteName[]): string[] {
  return notes.map(formatNoteName)
}

function pcs(notes: NoteName[]): number[] {
  return notes.map(pitchClass)
}

/** Fixture: all 12 major + 12 minor triads with expected spellings (sharp/flat roots). */
const MAJOR_SPELLINGS: { root: NoteName; expect: string[] }[] = [
  { root: { letter: 'C', accidental: '' }, expect: ['C', 'E', 'G'] },
  { root: { letter: 'C', accidental: '#' }, expect: ['C♯', 'E♯', 'G♯'] },
  { root: { letter: 'D', accidental: 'b' }, expect: ['D♭', 'F', 'A♭'] },
  { root: { letter: 'D', accidental: '' }, expect: ['D', 'F♯', 'A'] },
  { root: { letter: 'E', accidental: 'b' }, expect: ['E♭', 'G', 'B♭'] },
  { root: { letter: 'E', accidental: '' }, expect: ['E', 'G♯', 'B'] },
  { root: { letter: 'F', accidental: '' }, expect: ['F', 'A', 'C'] },
  { root: { letter: 'F', accidental: '#' }, expect: ['F♯', 'A♯', 'C♯'] },
  { root: { letter: 'G', accidental: 'b' }, expect: ['G♭', 'B♭', 'D♭'] },
  { root: { letter: 'G', accidental: '' }, expect: ['G', 'B', 'D'] },
  { root: { letter: 'A', accidental: 'b' }, expect: ['A♭', 'C', 'E♭'] },
  { root: { letter: 'A', accidental: '' }, expect: ['A', 'C♯', 'E'] },
  { root: { letter: 'B', accidental: 'b' }, expect: ['B♭', 'D', 'F'] },
  { root: { letter: 'B', accidental: '' }, expect: ['B', 'D♯', 'F♯'] },
]

const MINOR_SPELLINGS: { root: NoteName; expect: string[] }[] = [
  { root: { letter: 'C', accidental: '' }, expect: ['C', 'E♭', 'G'] },
  { root: { letter: 'C', accidental: '#' }, expect: ['C♯', 'E', 'G♯'] },
  { root: { letter: 'D', accidental: 'b' }, expect: ['D♭', 'F♭', 'A♭'] },
  { root: { letter: 'D', accidental: '' }, expect: ['D', 'F', 'A'] },
  { root: { letter: 'E', accidental: 'b' }, expect: ['E♭', 'G♭', 'B♭'] },
  { root: { letter: 'E', accidental: '' }, expect: ['E', 'G', 'B'] },
  { root: { letter: 'F', accidental: '' }, expect: ['F', 'A♭', 'C'] },
  { root: { letter: 'F', accidental: '#' }, expect: ['F♯', 'A', 'C♯'] },
  { root: { letter: 'G', accidental: '' }, expect: ['G', 'B♭', 'D'] },
  { root: { letter: 'G', accidental: '#' }, expect: ['G♯', 'B', 'D♯'] },
  { root: { letter: 'A', accidental: 'b' }, expect: ['A♭', 'C♭', 'E♭'] },
  { root: { letter: 'A', accidental: '' }, expect: ['A', 'C', 'E'] },
  { root: { letter: 'B', accidental: 'b' }, expect: ['B♭', 'D♭', 'F'] },
  { root: { letter: 'B', accidental: '' }, expect: ['B', 'D', 'F♯'] },
]

describe('spellChord major triads', () => {
  for (const row of MAJOR_SPELLINGS) {
    it(`spells ${formatNoteName(row.root)} major as ${row.expect.join('-')}`, () => {
      const spelled = spellChord(row.root, 'major')
      expect(names(spelled.notes)).toEqual(row.expect)
      expect(spelled.pitchClasses).toEqual(pcs(spelled.notes))
    })
  }
})

describe('spellChord minor triads', () => {
  for (const row of MINOR_SPELLINGS) {
    it(`spells ${formatNoteName(row.root)} minor as ${row.expect.join('-')}`, () => {
      const spelled = spellChord(row.root, 'minor')
      expect(names(spelled.notes)).toEqual(row.expect)
    })
  }
})

describe('inversions preserve pitch-class set', () => {
  const qualities: TriadQuality[] = ['major', 'minor']
  for (const root of CHROMATIC_ROOTS) {
    for (const q of qualities) {
      it(`${formatNoteName(root)} ${q} inversions`, () => {
        const base = spellChord(root, q)
        for (const inv of [0, 1, 2] as const) {
          const notes = invertNotes(base.notes, inv)
          expect(new Set(pcs(notes))).toEqual(new Set(base.pitchClasses))
        }
      })
    }
  }
})

describe('pitchClassesMatchChord', () => {
  it('accepts any voicing/doubling of C major', () => {
    const c = spellChord({ letter: 'C', accidental: '' }, 'major')
    expect(pitchClassesMatchChord([0, 4, 7], c.pitchClasses)).toBe(true)
    expect(pitchClassesMatchChord([12, 16, 19], c.pitchClasses)).toBe(true) // octaves
    expect(pitchClassesMatchChord([0, 4, 7, 12], c.pitchClasses)).toBe(true) // doubled C
  })

  it('accepts doubled pitch classes as same set', () => {
    const c = spellChord({ letter: 'C', accidental: '' }, 'major')
    // MIDI midis map to pcs — doubling C still set {0,4,7}
    expect(pitchClassesMatchChord([0, 0, 4, 7], c.pitchClasses)).toBe(true)
  })

  it('rejects C–E–G♯ for C major', () => {
    const c = spellChord({ letter: 'C', accidental: '' }, 'major')
    expect(pitchClassesMatchChord([0, 4, 8], c.pitchClasses)).toBe(false)
  })
})

describe('F♯ major spelling (spec example)', () => {
  it('is F♯–A♯–C♯ never F♯–B♭–D♭', () => {
    const spelled = spellChord({ letter: 'F', accidental: '#' }, 'major')
    expect(names(spelled.notes)).toEqual(['F♯', 'A♯', 'C♯'])
  })
})
