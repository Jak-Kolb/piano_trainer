import { describe, expect, it } from 'vitest'
import { meanVelocity, velocityToDynamic } from './dynamics'

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
