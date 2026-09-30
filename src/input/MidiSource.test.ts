// @vitest-environment jsdom
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

const setVisibility = (v: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', { value: v, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('MIDI input', () => {
  it('a hidden Keys tab ignores the keyboard (and lets go of held keys)', async () => {
    const { src, presses, send } = await connected()
    send([0x90, 60, 90], 1000)
    setVisibility('hidden')
    expect(src.getHeldMidiNotes()).toEqual([])
    send([0x90, 62, 90], 1100) // pressed while you're in another tab
    expect(src.getHeldMidiNotes()).toEqual([])
    setVisibility('visible')
    send([0x90, 64, 90], 1200)
    expect(src.getHeldMidiNotes()).toEqual([64])
    expect(presses).toEqual([60, 64])
    src.dispose()
  })

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

  it('reports the sustain pedal going down and up (a repeat, like the piano echoing it, is not news)', async () => {
    const { src, send } = await connected()
    const pedal: boolean[] = []
    src.onPedal((down) => pedal.push(down))
    send([0xb0, 64, 127], 1000)
    send([0xb0, 64, 127], 1001) // echo
    send([0xb0, 64, 0], 1500)
    send([0xb0, 1, 90], 1600) // modulation: not the pedal
    expect(pedal).toEqual([true, false])
    // A hidden tab lets go of the pedal too
    send([0xb0, 64, 100], 2000)
    setVisibility('hidden')
    expect(pedal).toEqual([true, false, true, false])
    setVisibility('visible')
    src.dispose()
  })
})
