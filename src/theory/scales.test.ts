import { describe, expect, it } from 'vitest'
import {
  formatPitch,
  twoOctaveArpeggioNotes,
  twoOctaveScaleNotes,
} from './index'

describe('scale spellings with octaves', () => {
  it('C major RH two octaves starts at C4 and reaches C6', () => {
    const notes = twoOctaveScaleNotes('C major', 'right')
    expect(formatPitch(notes[0]!)).toBe('C4')
    expect(notes[0]!.midi).toBe(60)
    expect(formatPitch(notes[7]!)).toBe('C5')
    expect(formatPitch(notes[14]!)).toBe('C6')
    expect(notes.length).toBe(15)
  })

  it('C major LH starts an octave lower', () => {
    const notes = twoOctaveScaleNotes('C major', 'left')
    expect(formatPitch(notes[0]!)).toBe('C3')
    expect(notes[0]!.midi).toBe(48)
  })

  it('F major has B♭ with rising octaves', () => {
    const notes = twoOctaveScaleNotes('F major', 'right')
    expect(notes.map(formatPitch)).toContain('B♭4')
  })

  it('C arpeggio distinguishes octave tonics', () => {
    const notes = twoOctaveArpeggioNotes('C major', 'right')
    expect(notes.slice(0, 4).map(formatPitch)).toEqual([
      'C4',
      'E4',
      'G4',
      'C5',
    ])
    expect(notes[0]!.midi).not.toBe(notes[3]!.midi)
  })
})
