import { describe, expect, it } from 'vitest'
import { barsPerSystem, dominantBarQuarters } from './demoAudio'
import { barQuarters, timeSigToDraw } from './meter'
import { keyPrefersFlats, midiToVexKey } from './midiToVex'
import { parseMidiArrayBuffer } from './parseMidi'
import { synthMidi } from './testing/synthMidi'
import type { MeasureInfo } from './types'

const wholeNotes = (bars: number) =>
  Array.from({ length: bars }, (_, i) => [i * 4, 4, 72] as [number, number, number])

describe('key signatures from the file', () => {
  it.each([
    [0, true, 'Am'],
    [1, true, 'Em'],
    [-1, true, 'Dm'],
    [-3, true, 'Cm'],
    [4, true, 'C#m'],
    [3, false, 'A'],
    [-2, false, 'Bb'],
  ])('%i sharps (minor=%s) → %s', async (sharps, minor, expected) => {
    const parsed = await parseMidiArrayBuffer(
      synthMidi({ keySigs: [{ beat: 0, sharps, minor }], notes: wholeNotes(2) }),
    )
    expect(parsed.keySignature).toBe(expected)
    expect(parsed.measures[0]!.keySignature).toBe(expected)
  })

  it('tracks key changes per bar', async () => {
    const parsed = await parseMidiArrayBuffer(
      synthMidi({
        keySigs: [
          { beat: 0, sharps: 1 },
          { beat: 8, sharps: -1 },
        ],
        notes: wholeNotes(4),
      }),
    )
    expect(parsed.measures.map((m) => m.keySignature)).toEqual(['G', 'G', 'F', 'F'])
  })

  it('ignores an out-of-range key byte instead of crashing', async () => {
    const parsed = await parseMidiArrayBuffer(
      synthMidi({ keySigs: [{ beat: 0, sharps: 9 }], notes: wholeNotes(1) }),
    )
    expect(parsed.keySignature).toBe('C')
  })

  it('spells chromatics with flats in flat minor keys', () => {
    for (const k of ['Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm']) {
      expect(keyPrefersFlats(k)).toBe(true)
    }
    for (const k of ['Am', 'Em', 'Bm', 'F#m', 'C#m']) {
      expect(keyPrefersFlats(k)).toBe(false)
    }
    expect(midiToVexKey(70, 'Dm')).toBe('bb/4')
  })

  it("spells the relative minor's leading tone as a sharp in flat keys", () => {
    expect(midiToVexKey(61, 'Dm')).toBe('c#/4')
    expect(midiToVexKey(61, 'F')).toBe('c#/4')
    expect(midiToVexKey(66, 'Gm')).toBe('f#/4')
    expect(midiToVexKey(66, 'Bb')).toBe('f#/4')
    // Other chromatics in flat keys stay flats
    expect(midiToVexKey(63, 'F')).toBe('eb/4')
    expect(midiToVexKey(68, 'Dm')).toBe('ab/4')
  })
})

describe('time signatures from the file', () => {
  it('keeps the denominator: 6/8 bars are 3 quarters long', async () => {
    const parsed = await parseMidiArrayBuffer(
      synthMidi({ timeSigs: [[0, 6, 8]], notes: [[0, 3, 60], [3, 3, 62]] }),
    )
    const m = parsed.measures[0]!
    expect([m.beatsPerBar, m.beatUnit, barQuarters(m)]).toEqual([6, 8, 3])
    expect(parsed.measureCount).toBe(2)
  })

  it('2/2 bars are 4 quarters long', async () => {
    const parsed = await parseMidiArrayBuffer(
      synthMidi({ timeSigs: [[0, 2, 2]], notes: [[0, 4, 60]] }),
    )
    const m = parsed.measures[0]!
    expect([m.beatsPerBar, m.beatUnit, barQuarters(m)]).toEqual([2, 2, 4])
  })
})

const bar = (beatsPerBar: number, beatUnit = 4): MeasureInfo => ({
  startSec: 0,
  durationSec: 2,
  beatsPerBar,
  beatUnit,
  keySignature: 'C',
})

describe('which time signatures to draw', () => {
  it('draws the first bar and every change', () => {
    const ms = [bar(3), bar(3), bar(4), bar(4), bar(6, 8)]
    expect(ms.map((_, i) => timeSigToDraw(ms, i + 1))).toEqual([
      '3/4',
      null,
      '4/4',
      null,
      '6/8',
    ])
  })

  it('treats a short first bar as a pickup: shows the real meter at bar 1', () => {
    const ms = [bar(1), bar(4), bar(4)]
    expect(ms.map((_, i) => timeSigToDraw(ms, i + 1))).toEqual(['4/4', null, null])
  })
})

describe('bars per line', () => {
  it('ignores a pickup bar when choosing the meter', () => {
    const ms = [bar(1), ...Array.from({ length: 10 }, () => bar(4))]
    expect(dominantBarQuarters(ms)).toBe(4)
    expect(barsPerSystem(dominantBarQuarters(ms))).toBe(6)
  })

  it('measures 6/8 in quarter notes like 3/4', () => {
    expect(dominantBarQuarters([bar(6, 8), bar(6, 8)])).toBe(3)
  })
})
