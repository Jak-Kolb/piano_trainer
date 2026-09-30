import { afterEach, describe, expect, it, vi } from 'vitest'
import { noteSent } from './midiEcho'
import { createMidiSource } from './MidiSource'

type Msg = (ev: { data: Uint8Array; timeStamp?: number }) => void

async function connected() {
  const input = { id: 'kawai', name: 'KDP110', onmidimessage: null as Msg | null }
  vi.stubGlobal('navigator', {
    requestMIDIAccess: async () => ({ inputs: new Map([['kawai', input]]), onstatechange: null }),
  })
  const src = createMidiSource()
  await src.start()
  const presses: number[] = []
  src.onNote((e) => e.on && presses.push(e.midi))
  const send = (bytes: number[], timeStamp: number) =>
    input.onmidimessage!({ data: Uint8Array.from(bytes), timeStamp })
  return { src, presses, send }
}

afterEach(() => vi.unstubAllGlobals())

describe('MIDI input', () => {
  it("ignores the piano echoing a note the app just sent it, but not your own keys", async () => {
    const { src, presses, send } = await connected()
    noteSent(64, 5000)
    send([0x90, 64, 80], 5004) // echo of the app's E4
    expect(src.getHeldMidiNotes()).toEqual([])
    send([0x80, 64, 0], 5300) // and its release
    send([0x90, 60, 90], 5010) // you, at the same moment
    expect(src.getHeldMidiNotes()).toEqual([60])
    send([0x90, 64, 80], 6000) // you play E4 yourself later
    expect(src.getHeldMidiNotes().sort()).toEqual([60, 64])
    expect(presses).toEqual([60, 64])
  })
})
