import { describe, expect, it } from 'vitest'
import { inversionVoicingCorrect, spellChord } from './chords'

describe('inversionVoicingCorrect', () => {
  const cMaj = spellChord({ letter: 'C', accidental: '' }, 'major').notes
  // root: C E G, bass C
  it('accepts root position CEG with C lowest', () => {
    expect(inversionVoicingCorrect([60, 64, 67], cMaj, cMaj[0]!)).toBe(true)
  })
  it('rejects first inversion shape when bass should be C', () => {
    // E3 C4 G4 — lowest is E
    expect(inversionVoicingCorrect([52, 60, 67], cMaj, cMaj[0]!)).toBe(false)
  })
  it('accepts 1st inversion with E in the bass', () => {
    const bass = cMaj[1]! // E
    expect(inversionVoicingCorrect([52, 60, 67], cMaj, bass)).toBe(true)
  })
})
