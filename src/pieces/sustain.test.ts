import { describe, expect, it } from 'vitest'
import { parseMidiArrayBuffer } from './parseMidi'
import { demoEvents } from './pianoPlayer'
import { synthMidi } from './testing/synthMidi'

// 120 bpm: one beat = 0.5 s
const sec = (beats: number) => beats * 0.5

describe('sustain pedal', () => {
  it('holds a released key until the pedal lifts', async () => {
    const p = await parseMidiArrayBuffer(
      synthMidi({ notes: [[0, 1, 60], [1, 1, 64]], pedal: [[0.5, 3.5]] }),
    )
    const c = p.notes.find((n) => n.midi === 60)!
    const e = p.notes.find((n) => n.midi === 64)!
    expect(c.duration).toBeCloseTo(sec(1)) // notation keeps the finger length
    expect(c.soundEnd).toBeCloseTo(sec(3.5))
    expect(e.soundEnd).toBeCloseTo(sec(3.5))
  })

  it('stops a held key when the same key is struck again', async () => {
    const p = await parseMidiArrayBuffer(
      synthMidi({ notes: [[0, 1, 60], [2, 1, 60]], pedal: [[0, 4]] }),
    )
    const [first, second] = p.notes.filter((n) => n.midi === 60)
    expect(first!.soundEnd).toBeCloseTo(sec(2))
    expect(second!.soundEnd).toBeCloseTo(sec(4))
  })

  it('leaves notes alone when the pedal is up at release', async () => {
    const p = await parseMidiArrayBuffer(
      synthMidi({ notes: [[0, 1, 60], [2, 1, 62]], pedal: [[1.5, 2.5]] }),
    )
    expect(p.notes[0]!.soundEnd).toBeCloseTo(sec(1))
    expect(p.notes[1]!.soundEnd).toBeCloseTo(sec(3)) // released after the lift
  })

  it('merges pedal written on both hand tracks', async () => {
    const p = await parseMidiArrayBuffer(
      synthMidi({
        notes: [[0, 1, 72, 0], [0, 1, 48, 1]],
        pedal: [[0.5, 2, 0], [1.5, 3, 1]],
      }),
    )
    for (const n of p.notes) expect(n.soundEnd).toBeCloseTo(sec(3))
  })
})

describe('demoEvents', () => {
  it('plays the pedalled length, scaled by tempo, capped for safety', async () => {
    const p = await parseMidiArrayBuffer(
      synthMidi({ notes: [[0, 1, 60], [0, 1, 64]], pedal: [[0, 40]] }),
    )
    p.notes[1]!.soundEnd = p.notes[1]!.time + 0.9
    const { events, endSec } = demoEvents(p.notes, 50)
    const dur = (name: string) => events.find((e) => e.note === name)!.dur
    expect(dur('E4')).toBeCloseTo(1.8) // 0.9 s at half speed
    expect(dur('C4')).toBe(8) // 20 s pedal → capped
    // Tail past the last key release is capped at 3 s (piece time)
    expect(endSec).toBeCloseTo(sec(1) + 3 + 0.15)
  })
})
