import { describe, expect, it } from 'vitest'
import {
  dynamicMarksForPiece,
  meanVelocity,
  velocityToDynamic,
  velocityToGain,
} from './dynamics'

describe('velocityToDynamic', () => {
  it('maps common bands', () => {
    expect(velocityToDynamic(0.1)).toBe('pp')
    expect(velocityToDynamic(0.3)).toBe('p')
    expect(velocityToDynamic(0.45)).toBe('mp')
    expect(velocityToDynamic(0.6)).toBe('mf')
    expect(velocityToDynamic(0.75)).toBe('f')
    expect(velocityToDynamic(0.95)).toBe('ff')
  })
})

describe('meanVelocity', () => {
  it('averages note velocities', () => {
    expect(meanVelocity([{ velocity: 0.4 }, { velocity: 0.6 }])).toBeCloseTo(0.5)
  })
})

describe('dynamicMarksForPiece', () => {
  it('emits a single mark when the whole piece stays in one band', () => {
    const notes = [
      { midi: 60, time: 0, measure: 1, velocity: 0.45 },
      { midi: 64, time: 0.5, measure: 1, velocity: 0.48 },
      { midi: 67, time: 4, measure: 3, velocity: 0.44 },
    ]
    expect(dynamicMarksForPiece(notes)).toEqual([
      { time: 0, measure: 1, label: 'mp' },
    ])
  })

  it('emits a new mark when the band changes', () => {
    const notes = [
      { midi: 60, time: 0, measure: 1, velocity: 0.45 },
      { midi: 60, time: 2, measure: 2, velocity: 0.8 },
    ]
    expect(dynamicMarksForPiece(notes).map((m) => m.label)).toEqual([
      'mp',
      'f',
    ])
  })
})

describe('velocityToGain', () => {
  it('makes mp clearly quieter than mf', () => {
    const mp = velocityToGain(0.45)
    const mf = velocityToGain(0.6)
    expect(mf / mp).toBeGreaterThan(1.4)
  })
})
