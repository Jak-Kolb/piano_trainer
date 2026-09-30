/**
 * A piano connected over Bluetooth (BLE-MIDI) straight from the app, via
 * Chrome's Web Bluetooth: no pairing in the system settings. Once connected
 * it works like a USB keyboard: its keys come in through the MIDI input, and
 * the app's notes (sound through your piano, Perform, Local Control) go out
 * to it.
 */
import { bleMidiPackets, newParseState, parseBleMidi } from './bleMidiPacket'

const MIDI_SERVICE = '03b80e5a-ede8-4b33-a751-6ce34ec4c700'
const MIDI_IO = '7772e5db-3868-4112-a1a9-f2669d106bf3'

// The bits of Web Bluetooth used here (not in TypeScript's DOM types).
interface GattCharacteristic extends EventTarget {
  value?: DataView
  startNotifications(): Promise<unknown>
  readValue(): Promise<DataView>
  writeValueWithoutResponse?(data: BufferSource): Promise<void>
  writeValue(data: BufferSource): Promise<void>
}
interface GattServer {
  connected: boolean
  connect(): Promise<GattServer>
  disconnect(): void
  getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<GattCharacteristic> }>
}
interface BleDevice extends EventTarget {
  id: string
  name?: string
  gatt?: GattServer
}
interface WebBluetooth {
  requestDevice(options: { filters: { services: string[] }[] }): Promise<BleDevice>
  getDevices?(): Promise<BleDevice[]>
}

const webBluetooth = (): WebBluetooth | undefined =>
  typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { bluetooth?: WebBluetooth }).bluetooth

export function bluetoothSupported(): boolean {
  return !!webBluetooth()
}

/** A connected Bluetooth piano: a MIDI input and output in one. */
export interface BluetoothPiano {
  name: string
  /** Sent straight away: Bluetooth can't hold a message for later. */
  send(data: number[], timestamp?: number): void
  /** The app's note scheduler shouldn't send ahead of time to this output. */
  readonly sendAheadMs: 0
  onMessage(listener: (data: Uint8Array, time: number) => void): () => void
}

export type BluetoothStatus = 'idle' | 'connecting' | 'connected' | 'lost'

export interface BluetoothState {
  status: BluetoothStatus
  /** The connected piano, or the last one (to reconnect). */
  name: string | null
  error: string | null
}

const NAME_KEY = 'keys.bluetoothPiano'

function rememberedName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY)
  } catch {
    return null
  }
}

function remember(name: string | null): void {
  try {
    if (name) localStorage.setItem(NAME_KEY, name)
    else localStorage.removeItem(NAME_KEY)
  } catch {
    /* ignore */
  }
}

let state: BluetoothState = { status: 'idle', name: rememberedName(), error: null }
let piano: BluetoothPiano | null = null
let device: BleDevice | null = null
let hangUp: (() => void) | null = null
const listeners = new Set<() => void>()

function setState(next: Partial<BluetoothState>): void {
  state = { ...state, ...next }
  for (const l of listeners) l()
}

export const bluetoothState = (): BluetoothState => state
export const bluetoothPiano = (): BluetoothPiano | null => piano

/** Called whenever the connection or its state changes. */
export function onBluetoothChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The MIDI characteristic of a connected device, wrapped as a piano. */
async function open(d: BleDevice): Promise<{ piano: BluetoothPiano; close: () => void }> {
  const server = await d.gatt!.connect()
  const service = await server.getPrimaryService(MIDI_SERVICE)
  const io = await service.getCharacteristic(MIDI_IO)
  // The spec asks for a read first; some devices only notify after it.
  await io.readValue().catch(() => {})
  await io.startNotifications()

  const messageListeners = new Set<(data: Uint8Array, time: number) => void>()
  const parse = newParseState()
  const onValue = (e: Event) => {
    const v = (e.target as GattCharacteristic).value
    if (!v) return
    const time = e.timeStamp || performance.now()
    for (const m of parseBleMidi(new Uint8Array(v.buffer, v.byteOffset, v.byteLength), parse)) {
      const data = Uint8Array.from(m)
      for (const l of messageListeners) l(data, time)
    }
  }
  io.addEventListener('characteristicvaluechanged', onValue)

  // One write at a time (Bluetooth rejects overlapping ones); messages sent
  // meanwhile go out together in the next packet.
  let queue: number[][] = []
  let writing = false
  const flush = async () => {
    if (writing) return
    writing = true
    try {
      while (queue.length) {
        const batch = queue
        queue = []
        for (const packet of bleMidiPackets(batch, performance.now())) {
          const write = io.writeValueWithoutResponse ?? io.writeValue
          await write.call(io, packet)
        }
      }
    } catch (err) {
      console.warn('Bluetooth MIDI write failed', err)
      queue = []
    } finally {
      writing = false
    }
  }

  return {
    piano: {
      name: d.name || 'Bluetooth piano',
      sendAheadMs: 0,
      send(data) {
        queue.push(data)
        void flush()
      },
      onMessage(listener) {
        messageListeners.add(listener)
        return () => messageListeners.delete(listener)
      },
    },
    close: () => io.removeEventListener('characteristicvaluechanged', onValue),
  }
}

/** A connection attempt that hasn't answered by now has failed. */
const CONNECT_TIMEOUT_MS = 10_000

async function attach(d: BleDevice): Promise<void> {
  const old = device
  if (old && old !== d) {
    old.removeEventListener('gattserverdisconnected', onLost)
    old.gatt?.disconnect()
  }
  hangUp?.()
  hangUp = null
  piano = null
  device = d
  d.addEventListener('gattserverdisconnected', onLost)
  setState({ status: 'connecting', name: d.name || state.name, error: null })
  // Disconnecting aborts a connection attempt that hangs (it then rejects).
  const timer = setTimeout(() => d.gatt?.disconnect(), CONNECT_TIMEOUT_MS)
  try {
    const opened = await open(d)
    if (device !== d) {
      opened.close() // replaced or disconnected meanwhile
      return
    }
    piano = opened.piano
    hangUp = opened.close
  } finally {
    clearTimeout(timer)
  }
  remember(piano.name)
  setState({ status: 'connected', name: piano.name })
}

const RETRY_MS = [1000, 3000, 8000]

/** The piano went away (turned off, out of range): try to get it back. */
function onLost(): void {
  hangUp?.()
  hangUp = null
  piano = null
  setState({ status: 'lost', error: null })
  const d = device
  let attempt = 0
  const retry = () => {
    if (device !== d || state.status === 'connected' || !d) return
    void attach(d).catch(() => {
      if (device !== d) return
      setState({ status: 'lost' })
      if (++attempt < RETRY_MS.length) setTimeout(retry, RETRY_MS[attempt])
    })
  }
  setTimeout(retry, RETRY_MS[0])
}

function explain(err: unknown): string | null {
  const e = err as { name?: string; message?: string }
  if (e?.name === 'NotFoundError') {
    // The chooser was closed without picking, or there's no Bluetooth.
    return /adapter|bluetooth.*(off|unavailable|not available)/i.test(e.message ?? '')
      ? 'Bluetooth is off or unavailable on this computer.'
      : null
  }
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
    return 'Chrome isn’t allowed to use Bluetooth. On a Mac: System Settings → Privacy & Security → Bluetooth → turn on Google Chrome.'
  }
  return 'Couldn’t connect. Make sure Bluetooth MIDI is on at the piano, then try again.'
}

/**
 * Pick a piano in Chrome's Bluetooth chooser and connect. Must run from a
 * click (Chrome only opens the chooser for one).
 */
export async function connectBluetoothPiano(): Promise<void> {
  const bt = webBluetooth()
  if (!bt) return
  let d: BleDevice
  try {
    d = await bt.requestDevice({ filters: [{ services: [MIDI_SERVICE] }] })
  } catch (err) {
    // Closing the chooser leaves any connected piano as it was.
    setState({ error: explain(err) })
    return
  }
  try {
    await attach(d)
  } catch (err) {
    if (device !== d) return
    piano = null
    setState({ status: 'idle', error: explain(err) })
  }
}

/**
 * Connect again to the piano from last time without the chooser, when
 * Chrome remembers it and it's switched on. Quietly does nothing otherwise.
 */
export async function reconnectBluetoothPiano(): Promise<void> {
  const bt = webBluetooth()
  if (!bt?.getDevices || piano || state.status === 'connecting' || !rememberedName()) return
  try {
    const known = await bt.getDevices()
    const d = known.find((x) => x.name === rememberedName()) ?? (known.length === 1 ? known[0] : undefined)
    if (d?.gatt) await attach(d)
  } catch {
    // Off or out of range: the Connect button is still there.
    piano = null
    setState({ status: 'idle', error: null })
  }
}

/** Disconnect and forget the piano (it won't reconnect by itself). */
export function disconnectBluetoothPiano(): void {
  const d = device
  device = null
  hangUp?.()
  hangUp = null
  piano = null
  remember(null)
  d?.removeEventListener('gattserverdisconnected', onLost)
  d?.gatt?.disconnect()
  setState({ status: 'idle', name: null, error: null })
}
