import { describe, expect, it } from 'vitest'
import { drawPrompt } from '../drills/triadSession'
import {
  MISS_FLOOR_MS,
  attemptWeightMs,
  emptyTriadStatsState,
  formatChordId,
  mediansForDrawFromState,
  recordAttemptInState,
  slowestChords,
} from './triadStats'

describe('attemptWeightMs', () => {
  it('keeps correct times as-is', () => {
    expect(attemptWeightMs(1200, true)).toBe(1200)
  })

  it('floors misses at MISS_FLOOR_MS', () => {
    expect(attemptWeightMs(500, false)).toBe(MISS_FLOOR_MS)
    expect(attemptWeightMs(9000, false)).toBe(9000)
  })
})

describe('recordAttemptInState', () => {
  it('tracks hits, misses, and capped times', () => {
    let state = emptyTriadStatsState()
    const day = new Date('2026-09-17T12:00:00Z')
    state = recordAttemptInState(state, 'C|major', 1000, true, day)
    state = recordAttemptInState(state, 'C|major', 200, false, day)
    const chord = state.chords['C|major']!
    expect(chord.hits).toBe(1)
    expect(chord.misses).toBe(1)
    expect(chord.timesMs).toEqual([1000, MISS_FLOOR_MS])
    expect(state.history).toHaveLength(1)
    expect(state.history[0]!.day).toBe('2026-09-17')
    expect(state.history[0]!.samples).toBe(2)
    expect(state.history[0]!.hitRate).toBe(0.5)
  })

  it('keeps only the last 30 times', () => {
    let state = emptyTriadStatsState()
    const day = new Date('2026-09-17T12:00:00Z')
    for (let i = 0; i < 35; i++) {
      state = recordAttemptInState(state, 'D|minor', 1000 + i, true, day)
    }
    expect(state.chords['D|minor']!.timesMs).toHaveLength(30)
    expect(state.chords['D|minor']!.timesMs[0]).toBe(1005)
  })
})

describe('mediansForDrawFromState', () => {
  it('returns medians that favor slow/missed chords for drawPrompt', () => {
    let state = emptyTriadStatsState()
    const day = new Date('2026-09-17T12:00:00Z')
    state = recordAttemptInState(state, 'C|major', 500, true, day)
    state = recordAttemptInState(state, 'F#|minor', 300, false, day)
    const medians = mediansForDrawFromState(state)
    expect(medians['C|major']).toBe(500)
    expect(medians['F#|minor']).toBe(MISS_FLOOR_MS)

    const picks = new Map<string, number>()
    for (let i = 0; i < 200; i++) {
      const p = drawPrompt(['minor', 'major'], medians)
      picks.set(p.id, (picks.get(p.id) ?? 0) + 1)
    }
    expect((picks.get('F#|minor') ?? 0) + (picks.get('C|major') ?? 0)).toBeGreaterThan(0)
  })
})

describe('slowestChords / formatChordId', () => {
  it('lists slowest first and formats ids', () => {
    let state = emptyTriadStatsState()
    const day = new Date('2026-09-17T12:00:00Z')
    state = recordAttemptInState(state, 'C|major', 800, true, day)
    state = recordAttemptInState(state, 'G|minor', 2000, true, day)
    const weak = slowestChords(state, 2)
    expect(weak[0]!.id).toBe('G|minor')
    expect(formatChordId('F#|minor')).toBe('F# minor')
  })
})
