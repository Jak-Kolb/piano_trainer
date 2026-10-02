import { bluetoothPiano, onBluetoothChange } from './bluetoothMidi'
import { isEcho } from './midiEcho'
import { isVirtualPort } from './midiPorts'
import type { InputSource, NoteEvent } from './types'

interface MidiInput {
  id: string
  name?: string
  onmidimessage: ((ev: { data: Uint8Array; timeStamp?: number }) => void) | null
}

interface MidiAccess {
  inputs: Map<string, MidiInput>
  onstatechange: (() => void) | null
}

/**
 * Every open Keys tab gets every key press over Web MIDI. Only the one you're
 * looking at should act on them: a hidden tab (another Keys tab, a minimised
 * window) left in Perform would otherwise play along to every key.
 */
const pageHidden = () =>
  typeof document !== 'undefined' && document.visibilityState === 'hidden'

export function createMidiSource(): InputSource {
  const listeners = new Set<() => void>()
  const noteListeners = new Set<(e: NoteEvent) => void>()
  const heldMidi = new Set<number>()
  const pedalListeners = new Set<(down: boolean) => void>()
  let pedalDown = false
  const setPedal = (down: boolean) => {
    // Only changes: the piano echoing the pedal back (Perform sends it on) is not news.
    if (down === pedalDown) return
    pedalDown = down
    for (const l of pedalListeners) l(down)
  }
  /** Keys whose note-on was the piano echoing the app: drop their note-off too. */
  const echoed = new Set<number>()
  let access: MidiAccess | null = null
  /** Why Web MIDI isn't available (a Bluetooth piano can still connect). */
  let accessError: string | null = null
  let status = 'MIDI off — will request access'
  let disposed = false
  let offBluetooth: (() => void) | null = null
  let offBluetoothKeys: (() => void) | null = null

  const notify = () => {
    for (const l of listeners) l()
  }

  /** A piano on the cable: then it's the one used, and Bluetooth stands by. */
  const cableIn = () => [...(access?.inputs.values() ?? [])].some((i) => !isVirtualPort(i.name))

  const refreshDeviceLabel = () => {
    const names: string[] = []
    access?.inputs.forEach((input) => {
      if (input.name) names.push(input.name)
    })
    const ble = bluetoothPiano()
    if (ble) names.push(cableIn() ? 'Bluetooth on standby' : `${ble.name} (Bluetooth)`)
    if (names.length) status = names.join(', ')
    else if (accessError) status = accessError
    else if (access) status = 'No MIDI device — plug in USB or connect over Bluetooth'
  }

  const onMessage = (ev: { data: Uint8Array; timeStamp?: number }) => {
    if (pageHidden()) return
    const data = ev.data
    if (!data || data.length < 2) return
    const statusByte = data[0]!
    const cmd = statusByte & 0xf0
    if (cmd === 0xb0) {
      // Sustain pedal (controller 64): down from half-way
      if (data[1] === 64) setPedal((data[2] ?? 0) >= 64)
      return
    }
    const note = data[1]!
    const vel = data.length > 2 ? data[2]! : 0
    // MIDIMessageEvent.timeStamp shares the performance.now() clock
    const time = ev.timeStamp ?? performance.now()
    if (cmd === 0x90 && vel > 0) {
      if (isEcho(note, time)) {
        echoed.add(note)
        return
      }
      heldMidi.add(note)
      for (const l of noteListeners) l({ midi: note, on: true, velocity: vel / 127, time })
      notify()
    } else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) {
      if (echoed.delete(note)) return
      heldMidi.delete(note)
      for (const l of noteListeners) l({ midi: note, on: false, velocity: 0, time })
      notify()
    }
  }

  // Keys held when the tab was hidden would never see their release.
  const onVisibility = () => {
    if (!pageHidden()) return
    setPedal(false) // its release would be missed too
    if (!heldMidi.size) return
    heldMidi.clear()
    echoed.clear()
    notify()
  }

  // A Bluetooth piano's keys come in the same way as a USB keyboard's.
  const bindBluetooth = () => {
    offBluetoothKeys?.()
    // With the cable in, its keys are the ones used (else every key would arrive twice).
    offBluetoothKeys =
      bluetoothPiano()?.onMessage((data, time) => {
        if (!cableIn()) onMessage({ data, timeStamp: time })
      }) ?? null
    heldMidi.clear()
    echoed.clear()
    refreshDeviceLabel()
    notify()
  }

  const bindInputs = () => {
    if (!access) return
    access.inputs.forEach((input) => {
      input.onmidimessage = onMessage
    })
    refreshDeviceLabel()
    notify()
  }

  return {
    id: 'midi',
    label: 'MIDI',
    getStatus: () => status,
    getHeldPitchClasses: () => {
      const pcs = new Set<number>()
      for (const n of heldMidi) pcs.add(((n % 12) + 12) % 12)
      return [...pcs]
    },
    getHeldMidiNotes: () => [...heldMidi],
    getMeter: () => null,
    supportsAutomaticGrade: () => true,
    hasDevice: () => (access?.inputs.size ?? 0) > 0 || bluetoothPiano() !== null,
    async start() {
      if (disposed) return
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
      if (!offBluetooth) {
        offBluetooth = onBluetoothChange(bindBluetooth)
        bindBluetooth()
      }
      if (access) {
        bindInputs()
        return
      }
      const request = (
        navigator as Navigator & {
          requestMIDIAccess?: (opts?: { sysex?: boolean }) => Promise<MidiAccess>
        }
      ).requestMIDIAccess
      if (!request) {
        accessError = 'Web MIDI not supported — use Chrome'
        refreshDeviceLabel()
        notify()
        throw new Error('Web MIDI unsupported')
      }
      try {
        access = await request.call(navigator, { sysex: false })
        access.onstatechange = () => {
          heldMidi.clear()
          bindInputs()
        }
        bindInputs()
      } catch {
        accessError = 'MIDI permission denied'
        refreshDeviceLabel()
        notify()
        throw new Error('MIDI permission denied')
      }
    },
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    onNote(listener) {
      noteListeners.add(listener)
      return () => noteListeners.delete(listener)
    },
    onPedal(listener) {
      pedalListeners.add(listener)
      return () => pedalListeners.delete(listener)
    },
    dispose() {
      disposed = true
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
      offBluetooth?.()
      offBluetoothKeys?.()
      offBluetooth = offBluetoothKeys = null
      listeners.clear()
      noteListeners.clear()
      pedalListeners.clear()
      if (access) {
        access.inputs.forEach((input) => {
          input.onmidimessage = null
        })
        access.onstatechange = null
      }
      access = null
      heldMidi.clear()
    },
  }
}

export function midiSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!(navigator as Navigator & { requestMIDIAccess?: unknown }).requestMIDIAccess
  )
}
