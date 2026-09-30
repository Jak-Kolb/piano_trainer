import { describe, expect, it } from 'vitest'
import { barsPerSystem } from './demoAudio'

describe('barsPerSystem', () => {
  it('gives 6 bars for 4/4 (~24 beats)', () => {
    expect(barsPerSystem(4)).toBe(6)
  })
  it('gives more bars for shorter measures', () => {
    expect(barsPerSystem(3)).toBe(8)
  })
  it('gives fewer bars for wide 6/4 bars', () => {
    expect(barsPerSystem(6)).toBe(4)
  })
})
