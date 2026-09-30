import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { midiVoice, type MidiOut } from './pianoOut'

let clock = 0
let sent: { data: number[]; at?: number; sentAt: number }[] = []
const out: MidiOut = { send: (data, at) => void sent.push({ data, at, sentAt: clock }) }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  clock = 1000
  sent = []
})
afterEach(() => vi.useRealTimers())

/** Advance the fake performance clock and timers together. */
const advance = (ms: number) => {
  for (let i = 0; i < ms; i++) {
    clock += 1
    vi.advanceTimersByTime(1)
  }
}

describe('midiVoice', () => {
  it('sends note on and off, timestamped, shortly before they are due', () => {
    const v = midiVoice(out, () => clock)
    v.play(60, 0.5, 2000, 500)
    expect(sent).toEqual([])
    advance(960) // 40 ms before the note: inside the send-ahead window
    expect(sent).toEqual([{ data: [0x90, 60, 64], at: 2000, sentAt: 1950 }])
    advance(500)
    expect(sent[1]).toEqual({ data: [0x80, 60, 0], at: 2500, sentAt: 2450 })
  })

  it('re-strikes a pitch held over, without the old note-off cutting the new note', () => {
    const v = midiVoice(out, () => clock)
    v.play(64, 1, 1000, 1000) // held (pedal) until 2000
    v.play(64, 1, 1500, 200) // struck again at 1500
    advance(2000)
    expect(sent.map((m) => [m.data[0], m.at])).toEqual([
      [0x90, 1000],
      [0x80, 1500], // lift the old one
      [0x90, 1500], // strike again
      [0x80, 1700], // its own release; the 2000 release is dropped
    ])
  })

  it('stop cancels what is queued and silences what is sounding', () => {
    const v = midiVoice(out, () => clock)
    v.play(60, 0.7, 1000, 3000)
    v.play(67, 0.7, 5000, 500)
    advance(100)
    v.releaseAll()
    expect(sent.slice(1).map((m) => m.data)).toEqual([
      [0x80, 60, 0],
      [0xb0, 123, 0],
    ])
    advance(10_000)
    expect(sent).toHaveLength(3) // nothing else goes out afterwards
  })

  it('keeps velocity in MIDI range', () => {
    const v = midiVoice(out, () => clock)
    v.play(60, 0, 1000, 10)
    v.play(62, 2, 1000, 10)
    expect(sent.filter((m) => m.data[0] === 0x90).map((m) => m.data[2])).toEqual([1, 127])
  })
})
