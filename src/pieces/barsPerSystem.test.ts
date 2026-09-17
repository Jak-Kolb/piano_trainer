import { describe, expect, it } from 'vitest'
import { barsPerSystem } from './demoAudio'

describe('barsPerSystem', () => {
  it('gives 3 bars for 4/4 (~12 beats)', () => {
    expect(barsPerSystem(4)).toBe(3)
  })
  it('gives 4 bars for 3/4', () => {
    expect(barsPerSystem(3)).toBe(4)
  })
  it('gives 3 bars for 6/8-style wide bars', () => {
    expect(barsPerSystem(6)).toBe(3)
  })
})
