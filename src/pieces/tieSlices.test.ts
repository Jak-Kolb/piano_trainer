import { describe, expect, it } from 'vitest'
import { sliceNotesForTies } from './tieSlices'
import type { PieceNote } from './types'

describe('sliceNotesForTies', () => {
  it('splits a note that crosses a barline into tied slices', () => {
    // secPerQuarter=0.5 → bar=2s. Note at 1.5 lasting 1.0 crosses into measure 2
    const n: PieceNote[] = [
      { midi: 60, time: 1.5, duration: 1.0, track: 0, measure: 1, velocity: 0.7 },
    ]
    const slices = sliceNotesForTies(n, 0.5)
    expect(slices.length).toBeGreaterThanOrEqual(2)
    expect(slices[0]!.tieToNext).toBe(true)
    expect(slices[1]!.tieFromPrev).toBe(true)
    expect(slices[0]!.measure).toBe(1)
    expect(slices[1]!.measure).toBe(2)
  })

  it('does not mid-bar split in 3/4 (only barlines)', () => {
    // secPerQuarter=0.5 → bar=1.5s. Note spanning most of the bar stays one slice.
    const n: PieceNote[] = [
      { midi: 60, time: 0, duration: 1.4, track: 0, measure: 1, velocity: 0.7 },
    ]
    const slices = sliceNotesForTies(n, 0.5, 3)
    expect(slices.length).toBe(1)
    expect(slices[0]!.tieToNext).toBe(false)
  })
})
