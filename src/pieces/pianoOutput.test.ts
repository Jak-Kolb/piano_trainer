// @vitest-environment jsdom
/** Which output the app's notes go to, and the pedal reaching it from anywhere. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeKeyboard } from './testing/fakeKeyboard'

type Out = { name: string; sent: number[][]; send(d: number[]): void }
const port = (name: string): Out => {
  const o: Out = { name, sent: [], send: (d) => void o.sent.push(d) }
  return o
}

/** Fresh modules (their MIDI access is cached), with these ports connected. */
async function withPorts(outputs: Out[], inputs: string[]) {
  vi.resetModules()
  vi.stubGlobal('navigator', {
    requestMIDIAccess: async () => ({
      outputs: new Map(outputs.map((o) => [o.name, o])),
      inputs: new Map(inputs.map((n) => [n, { name: n }])),
      addEventListener() {},
      removeEventListener() {},
    }),
  })
  const out = await import('./pianoOut')
  out.saveSoundOutput('piano')
  return out
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('where the app’s notes go', () => {
  it('the piano on the cable (named like the keys you play), not a software port before it', async () => {
    const iac = port('IAC Driver Bus 1')
    const kawai = port('KDP110')
    const out = await withPorts([iac, kawai], ['IAC Driver Bus 1', 'KDP110'])
    expect(await out.pianoOutput()).toBe(kawai)
  })

  it('a software port only when nothing else is there', async () => {
    const iac = port('IAC Driver Bus 1')
    const out = await withPorts([iac], [])
    expect(await out.pianoOutput()).toBe(iac)
  })
})

describe('your sustain pedal', () => {
  it('reaches your piano from anywhere in the app, and is lifted when the app lets go', async () => {
    const kawai = port('KDP110')
    await withPorts([kawai], ['KDP110'])
    vi.doMock('tone', () => ({ immediate: () => 0 }))
    const { followPedal } = await import('./pianoPlayer')
    const kb = fakeKeyboard()
    const stop = followPedal(kb.src)
    await kb.pedal(true)
    await vi.waitFor(() => expect(kawai.sent).toContainEqual([0xb0, 64, 127]))
    await kb.pedal(false)
    stop()
    await vi.waitFor(() => expect(kawai.sent.filter((d) => d[1] === 64)).toEqual([[0xb0, 64, 127], [0xb0, 64, 0], [0xb0, 64, 0]]))
  })
})
