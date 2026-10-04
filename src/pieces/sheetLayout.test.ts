import { describe, expect, it } from 'vitest'
import type { NotatedBar, NotatedVoice } from './notate'
import {
  barWidths,
  clefsForSystem,
  ledgerLines,
  lineScrollPos,
  packSystems,
  systemIndexOf,
  type PackOptions,
} from './sheetLayout'

const opts = (over: Partial<PackOptions> = {}): PackOptions => ({
  usable: 1000,
  maxBars: 6,
  clefPad: 50,
  inset: 30,
  padFor: () => 0,
  ...over,
})

describe('packSystems', () => {
  it('fills lines up to maxBars when bars are light', () => {
    const plan = packSystems(Array(14).fill(60), 14, opts())
    expect(plan.map((s) => s.count)).toEqual([6, 6, 2])
    expect(plan.map((s) => s.start)).toEqual([1, 7, 13])
  })

  it('gives dense bars fewer per line instead of letting them spill', () => {
    // bars 1-4 light, 5-8 need 400px of music each
    const widths = [60, 60, 60, 60, 400, 400, 400, 400]
    const plan = packSystems(widths, 8, opts())
    expect(plan.map((s) => [s.start, s.count])).toEqual([
      [1, 5],
      [6, 2],
      [8, 1],
    ])
  })

  it('keeps an over-wide bar on a line of its own', () => {
    const plan = packSystems([2000, 60], 2, opts())
    expect(plan.map((s) => s.count)).toEqual([1, 1])
  })

  it('reserves room for signatures printed mid-line', () => {
    const plain = packSystems(Array(6).fill(120), 6, opts())
    const withSigs = packSystems(Array(6).fill(120), 6, opts({ padFor: (b) => (b === 4 ? 60 : 0) }))
    expect(plain.map((s) => s.count)).toEqual([6])
    expect(withSigs.map((s) => s.count)).toEqual([5, 1])
  })
})

describe('barWidths', () => {
  it('shares leftover space equally so even bars come out equal', () => {
    const { widths } = barWidths({ start: 1, count: 4 }, [100, 100, 100, 100], opts())
    expect(widths[1]).toBeCloseTo(widths[2]!)
    expect(widths[0]! - widths[1]!).toBeCloseTo(50) // clef pad
    expect(widths.reduce((a, w) => a + w, 0)).toBeCloseTo(1000)
  })

  it('makes dense bars wider', () => {
    const { widths } = barWidths({ start: 1, count: 3 }, [60, 300, 60], opts())
    expect(widths[1]! - widths[2]!).toBeCloseTo(240)
  })
})

describe('lineScrollPos', () => {
  const systems = [
    { start: 1, count: 4 },
    { start: 5, count: 2 },
    { start: 7, count: 6 },
  ]
  it('finds the line for a bar', () => {
    expect([1, 4, 5, 6, 7, 12].map((m) => systemIndexOf(systems, m))).toEqual([0, 0, 1, 1, 2, 2])
  })
  it('stays put on line 1 and glides across later lines', () => {
    expect(lineScrollPos(systems, 3, 0.5)).toBe(0)
    expect(lineScrollPos(systems, 5, 0)).toBe(0)
    expect(lineScrollPos(systems, 6, 0)).toBeCloseTo(0.5)
    expect(lineScrollPos(systems, 7, 0)).toBe(1)
  })
})

describe('ledgerLines', () => {
  it('counts ledger lines outside each staff', () => {
    expect([60, 62, 57, 50].map((m) => ledgerLines(m, 'treble'))).toEqual([1, 0, 2, 4])
    expect([50, 60, 62, 72].map((m) => ledgerLines(m, 'bass'))).toEqual([0, 1, 1, 4])
  })
})

describe('clefsForSystem', () => {
  const voiceOf = (midis: number[]): NotatedVoice => ({
    stem: 'auto',
    events: midis.map((m, i) => ({
      start: i * 12,
      ticks: 12,
      value: 'q',
      dots: 0,
      rest: false,
      hidden: false,
      tuplet: null,
      notes: [{ midi: m, key: '', accidental: null, tieFromPrev: false, tieToNext: false, id: `${i}`, sourceTime: 0, velocity: 0.6 }],
    })),
  })
  const bar = (upper: number[], lower: number[]): NotatedBar => ({
    bar: 1,
    staves: { treble: [voiceOf(upper)], bass: [voiceOf(lower)] },
  })
  it('keeps normal hands in treble / bass', () => {
    expect(clefsForSystem([bar([67, 72, 76], [43, 48, 52])], { start: 1, count: 1 })).toEqual({ treble: 'treble', bass: 'bass' })
  })
  it('moves low right-hand octaves (Pirates intro) to bass clef', () => {
    expect(clefsForSystem([bar([50, 62, 50, 62, 50], [])], { start: 1, count: 1 }).treble).toBe('bass')
  })
  it('moves a high left hand to treble clef', () => {
    expect(clefsForSystem([bar([], [64, 67, 69, 71])], { start: 1, count: 1 }).bass).toBe('treble')
  })
})
