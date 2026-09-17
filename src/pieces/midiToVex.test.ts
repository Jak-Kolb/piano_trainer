import { describe, expect, it } from 'vitest'
import { beatsToVex, durationToVex, restDurationsForBeats } from './midiToVex'

describe('beatsToVex / durationToVex', () => {
  it('maps 1.5 beats to a dotted quarter', () => {
    expect(beatsToVex(1.5)).toEqual({ key: 'q', dots: 1, beats: 1.5 })
    // 1.5 quarters at secPerQuarter=0.5 → 0.75s
    expect(durationToVex(0.75, 0.5)).toEqual({ key: 'q', dots: 1, beats: 1.5 })
  })

  it('maps 1 beat to a plain quarter (not dotted)', () => {
    expect(beatsToVex(1)).toEqual({ key: 'q', dots: 0, beats: 1 })
  })

  it('maps 0.75 to dotted eighth', () => {
    expect(beatsToVex(0.75)).toEqual({ key: '8', dots: 1, beats: 0.75 })
  })

  it('maps 3 to dotted half', () => {
    expect(beatsToVex(3)).toEqual({ key: 'h', dots: 1, beats: 3 })
  })
})

describe('restDurationsForBeats', () => {
  it('uses a dotted quarter rest for 1.5 beats', () => {
    expect(restDurationsForBeats(1.5)).toEqual([
      { key: 'q', dots: 1, beats: 1.5 },
    ])
  })
})
