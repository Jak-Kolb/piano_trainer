import { describe, expect, it } from 'vitest'
import {
  drillActiveKeys,
  heldPcsMatchTargets,
  notesToMidi,
} from './drillMidi'

describe('notesToMidi', () => {
  it('places C major triad in octave 4 as C4 E4 G4', () => {
    const midis = notesToMidi(
      [
        { letter: 'C', accidental: '' },
        { letter: 'E', accidental: '' },
        { letter: 'G', accidental: '' },
      ],
      4,
    )
    expect(midis).toEqual([60, 64, 67])
  })

  it('places 1st inversion E G C as E4 G4 C5', () => {
    const midis = notesToMidi(
      [
        { letter: 'E', accidental: '' },
        { letter: 'G', accidental: '' },
        { letter: 'C', accidental: '' },
      ],
      4,
    )
    expect(midis).toEqual([64, 67, 72])
  })
})

describe('drillActiveKeys', () => {
  it('merges held and targets', () => {
    const keys = drillActiveKeys([60], [64, 67], 'right')
    expect(keys.map((k) => k.midi).sort()).toEqual([60, 64, 67])
    expect(keys.every((k) => k.hand === 'right')).toBe(true)
  })
})

describe('heldPcsMatchTargets', () => {
  it('matches across octaves', () => {
    expect(heldPcsMatchTargets([72, 76, 79], [60, 64, 67])).toBe(true)
    expect(heldPcsMatchTargets([60, 64], [60, 64, 67])).toBe(false)
  })
})
