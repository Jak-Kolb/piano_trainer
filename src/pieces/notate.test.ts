import { describe, expect, it } from 'vitest'
import { chooseStep, notatePiece, TPQ, type NotatedVoice } from './notate'
import { parseMidiArrayBuffer } from './parseMidi'
import { synthMidi, type SynthNote, type SynthOptions } from './testing/synthMidi'

async function score(opts: SynthOptions) {
  const parsed = await parseMidiArrayBuffer(synthMidi(opts))
  return notatePiece(parsed.notes, parsed.measures, parsed.measureCount)
}

/** "c/4:q", "r:8", tuplets get a trailing "t", hidden spacers "g:…". */
const rhythm = (v: NotatedVoice) =>
  v.events
    .map((e) => {
      const d = `${e.value}${'.'.repeat(e.dots)}${e.tuplet ? 't' : ''}`
      if (e.rest) return `${e.hidden ? 'g' : 'r'}:${d}`
      return `${e.notes.map((n) => n.key).join('+')}:${d}`
    })
    .join(' ')

async function treble(opts: SynthOptions, bar = 1) {
  return (await score(opts))[bar - 1]!.staves.treble
}

describe('chooseStep', () => {
  it('keeps straight sixteenths duple', () => {
    expect(chooseStep([0, 0.25, 0.5, 0.75])).toBe(3)
  })
  it('detects eighth triplets and sixteenth sextuplets', () => {
    expect(chooseStep([0, 1 / 3, 2 / 3])).toBe(4)
    expect(chooseStep([0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6])).toBe(2)
  })
  it('does not call one slightly late note a triplet', () => {
    expect(chooseStep([0, 0.3])).toBe(3)
  })
})

describe('notatePiece rhythm', () => {
  it('writes eighth triplets as a tuplet (probe C)', async () => {
    const t = 1 / 3
    const v = await treble({ notes: [[0, t, 60], [t, t, 62], [2 * t, t, 64], [1, 1, 65], [2, 2, 67]] })
    expect(v.map(rhythm)).toEqual(['c/4:8t d/4:8t e/4:8t f/4:q g/4:h'])
  })

  it('absorbs legato overlaps (probe D: quarters held 1.3 beats)', async () => {
    const v = await treble({ notes: [[0, 1.3, 60], [1, 1.3, 62], [2, 1.3, 64], [3, 1, 65]] })
    expect(v.map(rhythm)).toEqual(['c/4:q d/4:q e/4:q f/4:q'])
  })

  it('absorbs early releases (probe E: quarters held 0.85 beats)', async () => {
    const v = await treble({ notes: [[0, 0.85, 60], [1, 0.85, 62], [2, 0.85, 64], [3, 0.85, 65]] })
    expect(v.map(rhythm)).toEqual(['c/4:q d/4:q e/4:q f/4:q'])
  })

  it('keeps a real rest: eighth then eighth rest', async () => {
    const v = await treble({ notes: [[0, 0.5, 60], [1, 0.5, 62], [2, 2, 64]] })
    expect(v.map(rhythm)).toEqual(['c/4:8 r:8 d/4:8 r:8 e/4:h'])
  })

  it('puts a held note over moving notes in its own voice (probe H)', async () => {
    const v = await treble({ notes: [[0, 2, 72], [0, 1, 64], [1, 1, 65], [2, 1, 67], [3, 1, 69]] })
    expect(v.map(rhythm).sort()).toEqual(['c/5:h g:h', 'e/4:q f/4:q g/4:q a/4:q'])
    const held = v.find((x) => rhythm(x).startsWith('c/5'))!
    const moving = v.find((x) => rhythm(x).startsWith('e/4'))!
    expect([held.stem, moving.stem]).toEqual(['up', 'down'])
  })

  it('holds an octave released a little early to the barline (Interstellar bars 5–6)', async () => {
    // 3/4: octave held 2.85 beats under an eighth-note ostinato, then again next bar
    const bar = (at: number, lo: number, inner: [number, number]): SynthNote[] => [
      [at, 2.85, lo, 0],
      [at, 2.85, lo + 12, 0],
      ...[0, 1, 2, 3, 4, 5].map((i): SynthNote => [at + i / 2, 0.47, inner[i % 2]!, 0]),
    ]
    const bars = await score({
      timeSigs: [[0, 3, 4]],
      // A left-hand note so hands split by track (A3 stays in the right hand)
      notes: [...bar(0, 57, [64, 60]), ...bar(3, 59, [64, 62]), [0, 6, 45, 1]],
    })
    for (const [i, octave, eighths] of [
      [0, 'a/3+a/4:h.', 'e/4:8 c/4:8 e/4:8 c/4:8 e/4:8 c/4:8'],
      [1, 'b/3+b/4:h.', 'e/4:8 d/4:8 e/4:8 d/4:8 e/4:8 d/4:8'],
    ] as const) {
      const v = bars[i]!.staves.treble
      expect(v.map(rhythm).sort()).toEqual([octave, eighths])
      // Same stem layout both bars: octave up, eighths down
      expect(v.find((x) => rhythm(x) === octave)!.stem).toBe('up')
    }
  })

  it('writes sixteenth sextuplets', async () => {
    const s = 1 / 6
    const notes = Array.from({ length: 6 }, (_, i) => [i * s, s, 60 + i] as [number, number, number])
    const v = await treble({ timeSigs: [[0, 1, 4]], notes })
    expect(v.map(rhythm)[0]!.split(' ').map((x) => x.split(':')[1])).toEqual(
      Array(6).fill('16t'),
    )
    expect(v[0]!.events[0]!.tuplet).toMatchObject({ numNotes: 6, notesOccupied: 4 })
  })

  it('ties a note across the barline', async () => {
    const bars = await score({ notes: [[2, 4, 67], [6, 2, 69]] })
    expect(rhythm(bars[0]!.staves.treble[0]!)).toBe('r:h g/4:h')
    expect(rhythm(bars[1]!.staves.treble[0]!)).toBe('g/4:h a/4:h')
    expect(bars[0]!.staves.treble[0]!.events[1]!.notes[0]).toMatchObject({ tieToNext: true })
    expect(bars[1]!.staves.treble[0]!.events[0]!.notes[0]).toMatchObject({ tieFromPrev: true })
  })

  it('shows syncopation without drifting: 8 q 8 q q', async () => {
    const v = await treble({ notes: [[0, 0.5, 60], [0.5, 1, 62], [1.5, 0.5, 64], [2, 1, 65], [3, 1, 67]] })
    expect(v.map(rhythm)).toEqual(['c/4:8 d/4:q e/4:8 f/4:q g/4:q'])
  })

  it('writes 6/8 values from eighths', async () => {
    const v = await treble({
      timeSigs: [[0, 6, 8]],
      notes: [[0, 0.95, 62], [1, 0.47, 62], [1.5, 0.95, 62], [2.5, 0.47, 62]],
    })
    expect(v.map(rhythm)).toEqual(['d/4:q d/4:8 d/4:q d/4:8'])
  })
})

describe('notatePiece bar integrity', () => {
  it('fills every voice of every bar exactly', async () => {
    const bars = await score({
      notes: [
        [0, 2, 72], [0, 1, 64], [1, 1, 65], [2, 1, 67], [3, 1, 69],
        [4, 1 / 3, 60], [4 + 1 / 3, 1 / 3, 62], [4 + 2 / 3, 1 / 3, 64], [5, 3.2, 65],
        [9, 0.4, 48], [10, 1, 50],
      ],
    })
    for (const b of bars) {
      for (const voices of Object.values(b.staves)) {
        for (const v of voices) {
          expect(v.events.reduce((a, e) => a + e.ticks, 0)).toBe(4 * TPQ)
        }
      }
    }
  })
})

describe('notatePiece accidentals', () => {
  it('carries an accidental through the bar across both voices', async () => {
    // F#5 held (voice 1) while F#4 and F4 move below: F4 needs a natural.
    const v = await treble({ notes: [[0, 4, 78], [0, 1, 66], [1, 1, 65], [2, 1, 66], [3, 1, 64]] })
    const all = v.flatMap((x) => x.events).flatMap((e) => e.notes)
    const acc = (key: string, i = 0) => all.filter((n) => n.key === key)[i]?.accidental ?? null
    expect(acc('f#/5')).toBe('#')
    expect(acc('f#/4')).toBe('#')
    expect(acc('f/4')).toBe('n')
    expect(acc('f#/4', 1)).toBe('#')
  })
})
