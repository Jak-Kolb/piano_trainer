import { describe, expect, it } from 'vitest'
import {
  canAcceptMidiStep,
  latchAfterMidiAccept,
  pruneMidiLatch,
} from './noteMatch'
import type { PieceNote } from './types'

function n(midi: number): PieceNote {
  return { midi, time: 0, duration: 0.5, track: 0, measure: 1, velocity: 0.7 }
}

describe('MIDI re-articulation latch', () => {
  it('blocks a second identical step while the note is still held', () => {
    const held = [60]
    const step = [n(60)]
    let latch = new Set<number>()
    expect(canAcceptMidiStep(held, step, latch)).toBe(true)
    latch = latchAfterMidiAccept(held)
    expect(latch.has(60)).toBe(true)
    expect(canAcceptMidiStep(held, step, latch)).toBe(false)
  })

  it('allows the same pitch after release', () => {
    let latch = latchAfterMidiAccept([60])
    latch = pruneMidiLatch(latch, []) // released
    expect(latch.size).toBe(0)
    expect(canAcceptMidiStep([60], [n(60)], latch)).toBe(true)
  })

  it('blocks a subset pitch still latched from a prior chord', () => {
    const latch = latchAfterMidiAccept([60, 64])
    expect(canAcceptMidiStep([60, 64], [n(64)], latch)).toBe(false)
    const afterReleaseE = pruneMidiLatch(latch, [60])
    expect(canAcceptMidiStep([60, 64], [n(64)], afterReleaseE)).toBe(true)
  })

  it('allows a new pitch while prior notes stay held', () => {
    const latch = latchAfterMidiAccept([60, 64])
    expect(canAcceptMidiStep([60, 64, 67], [n(67)], latch)).toBe(true)
  })
})
