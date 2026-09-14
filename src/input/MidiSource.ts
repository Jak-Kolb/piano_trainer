import type { InputSource } from './types'

interface MidiInput {
  id: string
  name?: string
  onmidimessage: ((ev: { data: Uint8Array }) => void) | null
}

interface MidiAccess {
  inputs: Map<string, MidiInput>
  onstatechange: (() => void) | null
}

export function createMidiSource(): InputSource {
  const listeners = new Set<() => void>()
  const heldMidi = new Set<number>()
  let access: MidiAccess | null = null
  let status = 'MIDI off — will request access'
  let disposed = false

  const notify = () => {
    for (const l of listeners) l()
  }

  const refreshDeviceLabel = () => {
    if (!access) return
    const names: string[] = []
    access.inputs.forEach((input) => {
      if (input.name) names.push(input.name)
    })
    status =
      names.length === 0
        ? 'No MIDI device — plug in USB and reconnect'
        : names.join(', ')
  }

  const onMessage = (ev: { data: Uint8Array }) => {
    const data = ev.data
    if (!data || data.length < 2) return
    const statusByte = data[0]!
    const cmd = statusByte & 0xf0
    const note = data[1]!
    const vel = data.length > 2 ? data[2]! : 0
    if (cmd === 0x90 && vel > 0) {
      heldMidi.add(note)
      notify()
    } else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) {
      heldMidi.delete(note)
      notify()
    }
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
    async start() {
      if (disposed) return
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
        status = 'Web MIDI not supported — use Chrome'
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
        status = 'MIDI permission denied'
        notify()
        throw new Error('MIDI permission denied')
      }
    },
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      disposed = true
      listeners.clear()
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
