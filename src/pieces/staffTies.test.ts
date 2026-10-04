import { describe, expect, it } from 'vitest'
import {
  isPureTieContinuation,
  shouldDrawPartialInbound,
  shouldDrawPartialOutbound,
} from './staffTies'

describe('shouldDrawPartialInbound', () => {
  it('draws when continuing a tie with no in-system partner', () => {
    expect(shouldDrawPartialInbound(true, false)).toBe(true)
  })
  it('skips when partner exists (full tie) or not a continuation', () => {
    expect(shouldDrawPartialInbound(true, true)).toBe(false)
    expect(shouldDrawPartialInbound(false, false)).toBe(false)
  })
})

describe('shouldDrawPartialOutbound', () => {
  it('draws when still tying forward and not already a full-tie first', () => {
    expect(shouldDrawPartialOutbound(true, false)).toBe(true)
  })
  it('skips when already completed or not tying forward', () => {
    expect(shouldDrawPartialOutbound(true, true)).toBe(false)
    expect(shouldDrawPartialOutbound(false, false)).toBe(false)
  })
})

describe('isPureTieContinuation', () => {
  it('is true only when every slice has tieFromPrev', () => {
    expect(
      isPureTieContinuation([
        { tieFromPrev: true },
        { tieFromPrev: true },
      ]),
    ).toBe(true)
    expect(
      isPureTieContinuation([
        { tieFromPrev: true },
        { tieFromPrev: false },
      ]),
    ).toBe(false)
    expect(isPureTieContinuation([])).toBe(false)
  })
})
