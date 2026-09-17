import { describe, expect, it } from 'vitest'
import { sliceNotesForTies, uniformMeasures } from './tieSlices'
import type { PieceNote } from './types'

describe('sliceNotesForTies', () => {
  it('splits a note that crosses a barline into tied slices', () => {
    // secPerQuarter=0.5 → bar=2s. Note at 1.5 lasting 1.0 crosses into measure 2
    const n: PieceNote[] = [
      { midi: 60, time: 1.5, duration: 1.0, track: 0, measure: 1, velocity: 0.7 },
    ]
    const measures = uniformMeasures(4, 0.5, 4)
    const slices = sliceNotesForTies(n, measures)
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
    const measures = uniformMeasures(2, 0.5, 3)
    const slices = sliceNotesForTies(n, measures)
    expect(slices.length).toBe(1)
    expect(slices[0]!.tieToNext).toBe(false)
  })

  it('uses per-measure starts (non-uniform timeline)', () => {
    // Measure 1: 0–2s (4/4), measure 2: 2–3.5s (3/4) — mid-split only in m1.
    const measures = [
      { startSec: 0, durationSec: 2, beatsPerBar: 4 },
      { startSec: 2, durationSec: 1.5, beatsPerBar: 3 },
    ]
    const n: PieceNote[] = [
      { midi: 60, time: 0.1, duration: 3.2, track: 0, measure: 1, velocity: 0.7 },
    ]
    const slices = sliceNotesForTies(n, measures)
    expect(slices.length).toBeGreaterThanOrEqual(3)
    // Crosses mid of m1 (~1.0), then barline at 2.0 into m2 (no mid split).
    expect(slices.some((s) => s.measure === 2)).toBe(true)
    const m2 = slices.filter((s) => s.measure === 2)
    expect(m2.length).toBe(1)
  })
})
