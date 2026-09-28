import { describe, expect, it } from 'vitest'
import { noteId } from '../notate'
import { uniformBars } from '../testing/bars'
import type { PieceNote } from '../types'
import { createGrader } from './grading'
import { accompanimentFor, classifyHeld, isWrongNote } from './learn'
import { clickTimes, countInClicks } from './metronome'
import { DEFAULT_OPTIONS, tempoAfterPass, withDefaults } from './options'
import { formatAgo, formatDuration, summarize, type PracticeSession } from './stats'

const note = (midi: number, time: number, measure = 1, duration = 0.5): PieceNote => ({
  midi,
  time,
  duration,
  track: 0,
  measure,
  velocity: 0.6,
})

describe('options', () => {
  it('fills in switches missing from older saves and ignores bad values', () => {
    const o = withDefaults({ otherHand: true, speedStep: 'x' as unknown as number })
    expect(o.otherHand).toBe(true)
    expect(o.speedStep).toBe(DEFAULT_OPTIONS.speedStep)
    expect(o.trackStats).toBe(true)
  })

  it('speeds up only after clean passes, up to the target', () => {
    const o = { speedUp: true, speedStep: 5, speedTarget: 100 }
    expect(tempoAfterPass(80, true, o)).toBe(85)
    expect(tempoAfterPass(80, false, o)).toBe(80)
    expect(tempoAfterPass(98, true, o)).toBe(100)
    expect(tempoAfterPass(100, true, o)).toBe(100)
    expect(tempoAfterPass(80, true, { ...o, speedUp: false })).toBe(80)
  })
})

describe('learn mode', () => {
  it('flags presses outside the step, but not the other hand playing along', () => {
    const step = [note(60, 1), note(64, 1)]
    const lh = [note(48, 1)]
    expect(isWrongNote(60, step, lh)).toBe(false)
    expect(isWrongNote(48, step, lh)).toBe(false)
    expect(isWrongNote(61, step, lh)).toBe(true)
  })

  it('colours held keys', () => {
    const held = classifyHeld([60, 61, 55], [note(60, 0)], new Set([61]))
    expect(Object.fromEntries(held)).toEqual({ 60: 'good', 61: 'wrong', 55: 'held' })
  })

  it('plays the other hand from this step up to the next', () => {
    const lh = [note(48, 0), note(52, 0.5), note(55, 1), note(48, 2)]
    expect(accompanimentFor(lh, 0, 1).map((n) => n.midi)).toEqual([48, 52])
    expect(accompanimentFor(lh, 1, 3).map((n) => n.midi)).toEqual([55, 48])
  })
})

describe('play-along grading', () => {
  const expected = [note(60, 1, 1), note(62, 2, 1), note(64, 3, 2), note(65, 4, 2)]

  it('grades presses on time, early, late, wrong, and missed', () => {
    const g = createGrader(expected, 1)
    expect(g.press(60, 1.03)).toMatchObject({ kind: 'hit', grade: 'good' })
    expect(g.press(62, 1.85)).toMatchObject({ kind: 'hit', grade: 'early' })
    expect(g.press(70, 2.5)).toMatchObject({ kind: 'wrong', bar: 1 })
    expect(g.advance(3.3)).toEqual([noteId(expected[2]!)])
    expect(g.press(65, 4.15)).toMatchObject({ kind: 'hit', grade: 'late' })
    const s = g.summary()
    expect(s).toMatchObject({ total: 4, good: 1, early: 1, late: 1, missed: 1, wrong: 1 })
    expect(s.accuracy).toBeCloseTo(0.75)
    expect(s.mistakesByBar).toEqual({ 1: 2, 2: 2 })
  })

  it('keeps windows in real time at slower tempos', () => {
    // At half speed, 0.1 s of piece time is 200 ms of real time
    const g = createGrader(expected, 0.5)
    expect(g.press(60, 1.03)).toMatchObject({ grade: 'good' })
    expect(g.press(62, 2.06)).toMatchObject({ grade: 'late' })
  })

  it('does not match one press to two notes', () => {
    const g = createGrader([note(60, 1), note(60, 1.1)], 1)
    g.press(60, 1.05)
    expect(g.press(60, 1.06)).toMatchObject({ kind: 'hit' })
    expect(g.press(60, 1.07)).toMatchObject({ kind: 'wrong' })
  })
})

describe('metronome', () => {
  it('clicks every quarter in 4/4 and every dotted quarter in 6/8', () => {
    const fourFour = clickTimes(uniformBars(2, 0.5, 4, 4), 1, 2)
    expect(fourFour.map((c) => c.time)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5])
    expect(fourFour.filter((c) => c.accent).map((c) => c.time)).toEqual([0, 2])
    const sixEight = clickTimes(uniformBars(1, 0.5, 6, 8), 1, 1)
    expect(sixEight.map((c) => c.time)).toEqual([0, 0.75])
  })

  it('counts in one bar before the start', () => {
    const clicks = countInClicks(uniformBars(4, 0.5, 3, 4), 3)
    expect(clicks.map((c) => c.time)).toEqual([1.5, 2, 2.5])
    expect(clicks[0]!.accent).toBe(true)
  })
})

describe('stats', () => {
  const session = (over: Partial<PracticeSession>): PracticeSession => ({
    pieceId: 'p',
    startedAt: '2026-09-20T10:00:00Z',
    seconds: 600,
    mode: 'learn',
    passes: 1,
    cleanPasses: 0,
    bestTempo: 0,
    mistakesByBar: {},
    ...over,
  })

  it('adds up sessions and weights recent mistakes more', () => {
    const s = summarize([
      session({ startedAt: '2026-09-01T10:00:00Z', mistakesByBar: { 3: 10 } }),
      ...Array.from({ length: 5 }, (_, i) =>
        session({ startedAt: `2026-09-1${i}T10:00:00Z`, cleanPasses: 1, bestTempo: 80 + i }),
      ),
      session({ startedAt: '2026-09-21T10:00:00Z', mistakesByBar: { 7: 5 }, bestAccuracy: 0.9, wholePieceClean: true }),
    ])
    expect(s.firstPracticed).toBe('2026-09-01T10:00:00Z')
    expect(s.firstCleanAt).toBe('2026-09-21T10:00:00Z')
    expect(s.sessions).toBe(7)
    expect(s.totalSeconds).toBe(4200)
    expect(s.cleanPasses).toBe(5)
    expect(s.bestTempo).toBe(84)
    expect(s.bestAccuracy).toBe(0.9)
    expect(s.lastPracticed).toBe('2026-09-21T10:00:00Z')
    // 10 old mistakes (6 sessions back ≈ ×0.44 → 4.35) vs 5 fresh ones
    expect(s.troubleBars.get(7)).toBe(1)
    expect(s.troubleBars.get(3)).toBeCloseTo((10 * Math.pow(0.5, 6 / 5)) / 5)
  })

  it('formats time and dates', () => {
    expect(formatDuration(20)).toBe('under a minute')
    expect(formatDuration(25 * 60)).toBe('25 min')
    expect(formatDuration(80 * 60)).toBe('1 h 20 min')
    const now = new Date('2026-09-22T12:00:00')
    expect(formatAgo('2026-09-22T08:00:00', now)).toBe('today')
    expect(formatAgo('2026-09-21T08:00:00', now)).toBe('yesterday')
    expect(formatAgo('2026-09-18T08:00:00', now)).toBe('4 days ago')
  })
})
