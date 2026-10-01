// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveSoundOutput, setLocalControl, pianoOutput } from '../pieces/pianoOut'
import {
  bluetoothPiano,
  bluetoothState,
  connectBluetoothPiano,
  disconnectBluetoothPiano,
} from './bluetoothMidi'
import { parseBleMidi } from './bleMidiPacket'
import { createMidiSource } from './MidiSource'

/** A pretend Bluetooth piano: packets it receives, and a way to press its keys. */
function fakePiano(name = 'KDP110') {
  const written: number[][] = []
  let release: (() => void) | null = null
  let holdWrites = false
  const io = Object.assign(new EventTarget(), {
    value: undefined as DataView | undefined,
    readValue: async () => new DataView(new ArrayBuffer(0)),
    startNotifications: async () => io,
    writeValue: async () => {},
    writeValueWithoutResponse: (data: Uint8Array) => {
      written.push([...data])
      return holdWrites ? new Promise<void>((r) => (release = r)) : Promise.resolve()
    },
  })
  const gatt = {
    connected: false,
    connect: vi.fn(async () => {
      gatt.connected = true
      return gatt
    }),
    disconnect: () => {
      gatt.connected = false
    },
    getPrimaryService: async () => ({ getCharacteristic: async () => io }),
  }
  const device = Object.assign(new EventTarget(), { id: 'kdp', name, gatt })
  return {
    device,
    written,
    /** Bytes arriving from the piano (one BLE packet). */
    packet(...bytes: number[]) {
      io.value = new DataView(Uint8Array.from(bytes).buffer)
      io.dispatchEvent(new Event('characteristicvaluechanged'))
    },
    /** The piano turning off or going out of range. */
    drop() {
      gatt.connected = false
      device.dispatchEvent(new Event('gattserverdisconnected'))
    },
    holdWrites() {
      holdWrites = true
    },
    finishWrite() {
      holdWrites = false
      release?.()
    },
  }
}

let piano: ReturnType<typeof fakePiano>
let requestDevice: ReturnType<typeof vi.fn>

beforeEach(() => {
  piano = fakePiano()
  requestDevice = vi.fn(async () => piano.device)
  vi.stubGlobal('navigator', {
    bluetooth: { requestDevice, getDevices: async () => [piano.device] },
    requestMIDIAccess: async () => ({
      inputs: new Map(),
      outputs: new Map(),
      onstatechange: null,
      addEventListener() {},
      removeEventListener() {},
    }),
  })
})

afterEach(() => {
  disconnectBluetoothPiano()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
})

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('Bluetooth piano', () => {
  it('connects through the chooser and brings its keys in like a USB keyboard', async () => {
    const src = createMidiSource()
    await src.start()
    await connectBluetoothPiano()
    expect(requestDevice).toHaveBeenCalledWith({
      filters: [{ services: ['03b80e5a-ede8-4b33-a751-6ce34ec4c700'] }],
    })
    expect(bluetoothState()).toMatchObject({ status: 'connected', name: 'KDP110' })
    expect(src.hasDevice()).toBe(true)
    expect(src.getStatus()).toBe('KDP110 (Bluetooth)')

    const presses: number[] = []
    src.onNote((e) => e.on && presses.push(e.midi))
    piano.packet(0x80, 0x81, 0x90, 60, 100, 64, 90) // C and E, running status
    expect(src.getHeldMidiNotes().sort()).toEqual([60, 64])
    piano.packet(0x80, 0x82, 0x80, 60, 0)
    expect(src.getHeldMidiNotes()).toEqual([64])
    expect(presses).toEqual([60, 64])
    src.dispose()
  })

  it('while the piano is on the USB cable too, its keys come from the cable only (never twice)', async () => {
    const cable = { id: 'usb', name: 'KDP110', onmidimessage: null as null | ((e: { data: Uint8Array; timeStamp?: number }) => void) }
    vi.stubGlobal('navigator', {
      bluetooth: { requestDevice, getDevices: async () => [piano.device] },
      requestMIDIAccess: async () => ({ inputs: new Map([['usb', cable]]), outputs: new Map(), onstatechange: null }),
    })
    const src = createMidiSource()
    await src.start()
    await connectBluetoothPiano()
    expect(src.getStatus()).toBe('KDP110, Bluetooth on standby')
    const presses: number[] = []
    src.onNote((e) => e.on && presses.push(e.midi))
    piano.packet(0x80, 0x81, 0x90, 60, 100) // over Bluetooth: ignored
    cable.onmidimessage!({ data: Uint8Array.from([0x90, 60, 100]), timeStamp: 5 })
    expect(presses).toEqual([60])
    src.dispose()
  })

  it('sends the app’s notes to the piano, batching what queues up during a write', async () => {
    await connectBluetoothPiano()
    piano.holdWrites()
    setLocalControl(false)
    await flush()
    const out = bluetoothPiano()!
    out.send([0x90, 60, 80])
    out.send([0x90, 64, 80])
    expect(piano.written).toHaveLength(1) // still writing the first
    piano.finishWrite()
    await flush()
    expect(piano.written.map((p) => parseBleMidi(Uint8Array.from(p)))).toEqual([
      [[0xb0, 122, 0]],
      [
        [0x90, 60, 80],
        [0x90, 64, 80],
      ],
    ])
  })

  it('is where the app’s sound goes when "My piano" is chosen, sent only when due', async () => {
    saveSoundOutput('piano')
    await connectBluetoothPiano()
    const out = await pianoOutput()
    expect(out).toBe(bluetoothPiano())
    expect(out!.sendAheadMs).toBe(0)
  })

  it('reconnects by itself when the piano drops out', async () => {
    await connectBluetoothPiano()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    piano.drop()
    expect(bluetoothState().status).toBe('lost')
    expect(bluetoothPiano()).toBeNull()
    await vi.advanceTimersByTimeAsync(1000)
    expect(bluetoothState().status).toBe('connected')
    expect(piano.device.gatt.connect).toHaveBeenCalledTimes(2)
  })

  it('closing the chooser changes nothing; Disconnect forgets the piano', async () => {
    await connectBluetoothPiano()
    requestDevice.mockRejectedValueOnce(Object.assign(new Error('User cancelled'), { name: 'NotFoundError' }))
    await connectBluetoothPiano()
    expect(bluetoothState()).toMatchObject({ status: 'connected', error: null })
    expect(bluetoothPiano()).not.toBeNull()

    disconnectBluetoothPiano()
    expect(bluetoothState()).toMatchObject({ status: 'idle', name: null })
    expect(localStorage.getItem('keys.bluetoothPiano')).toBeNull()
  })
})
