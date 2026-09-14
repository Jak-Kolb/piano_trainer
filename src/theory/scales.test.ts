import { describe, expect, it } from 'vitest'
import { formatNoteName, twoOctaveArpeggioNotes, twoOctaveScaleNotes } from './index'

describe('scale spellings', () => {
  it('C major two octaves', () => {
    const notes = twoOctaveScaleNotes('C major').map(formatNoteName)
    expect(notes[0]).toBe('C')
    expect(notes[7]).toBe('C')
    expect(notes.length).toBe(15)
  })
  it('F major has B♭', () => {
    const notes = twoOctaveScaleNotes('F major').map(formatNoteName)
    expect(notes).toContain('B♭')
  })
  it('C arpeggio is C E G C…', () => {
    const notes = twoOctaveArpeggioNotes('C major').map(formatNoteName)
    expect(notes.slice(0, 4)).toEqual(['C', 'E', 'G', 'C'])
  })
})
