import { describe, expect, it } from 'vitest'
import { writtenAccidental } from './keySig'

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
