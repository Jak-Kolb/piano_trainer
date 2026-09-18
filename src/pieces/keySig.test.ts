import { describe, expect, it } from 'vitest'
import { accidentalForMeasure, writtenAccidental } from './keySig'

describe('writtenAccidental', () => {
  it('omits F# in G major (covered by key signature)', () => {
    expect(writtenAccidental('f#', 'G')).toBeNull()
  })

  it('omits F# in E minor', () => {
    expect(writtenAccidental('f#', 'Em')).toBeNull()
  })

  it('writes a natural when F natural appears in G major', () => {
    expect(writtenAccidental('f', 'G')).toBe('n')
  })

  it('writes sharp for F# in C major', () => {
    expect(writtenAccidental('f#', 'C')).toBe('#')
  })
})

  it('treats bb as B-flat, not B double-flat', () => {
    expect(writtenAccidental('bb', 'D')).toBe('b')
    expect(writtenAccidental('bb', 'C')).toBe('b')
  })

  it('still supports real double-flats like bbb', () => {
    expect(writtenAccidental('bbb', 'C')).toBe('bb')
  })

describe('accidentalForMeasure', () => {
  it('writes sharp once per letter/octave in the bar', () => {
    const seen = new Map<string, string>()
    expect(accidentalForMeasure('a#', 4, 'D', seen)).toBe('#')
    expect(accidentalForMeasure('a#', 4, 'D', seen)).toBeNull()
    expect(accidentalForMeasure('a#', 4, 'D', seen)).toBeNull()
  })

  it('requires a new accidental in a different octave', () => {
    const seen = new Map<string, string>()
    expect(accidentalForMeasure('a#', 3, 'D', seen)).toBe('#')
    expect(accidentalForMeasure('a#', 4, 'D', seen)).toBe('#')
  })

  it('writes a natural when cancelling a prior sharp in the bar', () => {
    const seen = new Map<string, string>()
    expect(accidentalForMeasure('a#', 4, 'D', seen)).toBe('#')
    expect(accidentalForMeasure('a', 4, 'D', seen)).toBe('n')
  })
})
