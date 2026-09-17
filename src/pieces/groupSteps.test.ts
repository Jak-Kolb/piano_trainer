import { describe, expect, it } from 'vitest'
import { groupSteps } from './parseMidi'
import type { PieceNote } from './types'

function n(midi: number, time: number, track = 0): PieceNote {
  return { midi, time, duration: 0.25, track, measure: 1 }
}

describe('groupSteps', () => {
  it('keeps simultaneous RH+LH in one step', () => {
    const steps = groupSteps(
      [n(60, 0, 0), n(48, 0.02, 1), n(64, 0.03, 0)],
      0.12,
    )
    expect(steps).toHaveLength(1)
    expect(steps[0]!.map((x) => x.midi).sort((a, b) => a - b)).toEqual([
      48, 60, 64,
    ])
  })

  it('splits notes farther apart than the window', () => {
    const steps = groupSteps([n(60, 0), n(62, 0.5)], 0.12)
    expect(steps).toHaveLength(2)
  })
})
