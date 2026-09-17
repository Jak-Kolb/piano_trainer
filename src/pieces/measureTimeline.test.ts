import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Midi } from '@tonejs/midi'
import { buildMeasureTimeline, parseMidiArrayBuffer } from './parseMidi'

/** Encode a minimal Type-1 MIDI with tempo + time-sig changes. */
function synthMidi(opts: {
  ppq?: number
  /** [tick, bpm] */
  tempos: [number, number][]
  /** [tick, numerator, denominator] */
  timeSigs: [number, number, number][]
  /** [tick, durationTicks, midi] */
  notes: [number, number, number][]
}): ArrayBuffer {
  const ppq = opts.ppq ?? 480

  const writeVar = (n: number, out: number[]) => {
    const bytes: number[] = []
    let v = n
    bytes.unshift(v & 0x7f)
    v >>= 7
    while (v > 0) {
      bytes.unshift((v & 0x7f) | 0x80)
      v >>= 7
    }
    out.push(...bytes)
  }

  const tracks: number[][] = []

  // Track 0: tempo + time signature meta
  {
    const ev: number[] = []
    let last = 0
    const metas: { tick: number; bytes: number[] }[] = []
    for (const [tick, bpm] of opts.tempos) {
      const us = Math.round(60_000_000 / bpm)
      metas.push({
        tick,
        bytes: [
          0xff,
          0x51,
          0x03,
          (us >> 16) & 0xff,
          (us >> 8) & 0xff,
          us & 0xff,
        ],
      })
    }
    for (const [tick, num, den] of opts.timeSigs) {
      const denPow = Math.round(Math.log2(den))
      metas.push({
        tick,
        bytes: [0xff, 0x58, 0x04, num, denPow, 24, 8],
      })
    }
    metas.sort((a, b) => a.tick - b.tick)
    for (const m of metas) {
      writeVar(m.tick - last, ev)
      last = m.tick
      ev.push(...m.bytes)
    }
    writeVar(0, ev)
    ev.push(0xff, 0x2f, 0x00)
    tracks.push(ev)
  }

  // Track 1: notes
  {
    const ev: number[] = []
    type E = { tick: number; on: boolean; midi: number }
    const events: E[] = []
    for (const [tick, dur, midi] of opts.notes) {
      events.push({ tick, on: true, midi })
      events.push({ tick: tick + dur, on: false, midi })
    }
    events.sort((a, b) => a.tick - b.tick || Number(a.on) - Number(b.on))
    let last = 0
    for (const e of events) {
      writeVar(e.tick - last, ev)
      last = e.tick
      if (e.on) ev.push(0x90, e.midi, 0x64)
      else ev.push(0x80, e.midi, 0x40)
    }
    writeVar(0, ev)
    ev.push(0xff, 0x2f, 0x00)
    tracks.push(ev)
  }

  const chunks: number[] = []
  chunks.push(
    ...[
      0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, tracks.length,
      (ppq >> 8) & 0xff,
      ppq & 0xff,
    ],
  )
  for (const tr of tracks) {
    chunks.push(0x4d, 0x54, 0x72, 0x6b)
    const len = tr.length
    chunks.push(
      (len >> 24) & 0xff,
      (len >> 16) & 0xff,
      (len >> 8) & 0xff,
      len & 0xff,
    )
    chunks.push(...tr)
  }
  return new Uint8Array(chunks).buffer
}

describe('buildMeasureTimeline', () => {
  it('uses real seconds across a tempo change (not first-tempo * bar index)', () => {
    // 4/4, 120bpm for 2 bars (each bar = 2s), then 60bpm — bar 3 is 4s long.
    const ppq = 480
    const buf = synthMidi({
      ppq,
      tempos: [
        [0, 120],
        [ppq * 8, 60], // after 2 bars of 4/4
      ],
      timeSigs: [[0, 4, 4]],
      notes: [
        [0, ppq, 60],
        [ppq * 8, ppq, 62], // onset of measure 3
      ],
    })
    const midi = new Midi(buf)
    const measures = buildMeasureTimeline(midi.header, 4, midi.duration)
    expect(measures[0]!.startSec).toBeCloseTo(0, 3)
    expect(measures[0]!.beatsPerBar).toBe(4)
    expect(measures[1]!.startSec).toBeCloseTo(2, 3)
    expect(measures[2]!.startSec).toBeCloseTo(4, 3)
    // At 60bpm, one 4/4 bar = 4 seconds
    expect(measures[2]!.durationSec).toBeCloseTo(4, 2)
    expect(measures[2]!.durationSec).toBeGreaterThan(3)
  })

  it('picks up a 3/4 → 4/4 time-signature change', () => {
    const ppq = 480
    // 4 bars of 3/4 at 120bpm (1.5s each), then 4/4
    const changeTick = ppq * 3 * 4
    const buf = synthMidi({
      ppq,
      tempos: [[0, 120]],
      timeSigs: [
        [0, 3, 4],
        [changeTick, 4, 4],
      ],
      notes: [
        [0, ppq, 60],
        [changeTick, ppq, 64],
      ],
    })
    const midi = new Midi(buf)
    const measures = buildMeasureTimeline(midi.header, 6, midi.duration)
    expect(measures[0]!.beatsPerBar).toBe(3)
    expect(measures[0]!.durationSec).toBeCloseTo(1.5, 3)
    expect(measures[3]!.beatsPerBar).toBe(3)
    expect(measures[4]!.beatsPerBar).toBe(4)
    expect(measures[4]!.startSec).toBeCloseTo(6, 3) // 4 * 1.5
    expect(measures[4]!.durationSec).toBeCloseTo(2, 3)
  })
})

describe('Interstellar MIDI (optional)', () => {
  const candidates = [
    '/Users/jakkolb/Downloads/Hans Zimmer - Interstellar.mid',
    '/workspace/uploads/Hans Zimmer - Interstellar.mid',
    '/workspace/Hans Zimmer - Interstellar.mid',
  ]
  const path = candidates.find((p) => existsSync(p))

  ;(path ? it : it.skip)(
    'matches verified measure starts for Interstellar',
    async () => {
      const copy = Uint8Array.from(readFileSync(path!)).buffer
      const parsed = await parseMidiArrayBuffer(copy)
      expect(parsed.measures[0]!.startSec).toBeCloseTo(0, 2)
      expect(parsed.measures[0]!.beatsPerBar).toBe(3)
      expect(parsed.measures[99]!.startSec).toBeCloseTo(207.86, 1)
      expect(parsed.measures[193]!.startSec).toBeCloseTo(432.86, 1)
      expect(parsed.measures[193]!.beatsPerBar).toBe(4)
    },
  )
})
