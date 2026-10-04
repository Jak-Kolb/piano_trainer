import { bluetoothPiano, onBluetoothChange } from '../input/bluetoothMidi'
import { noteSent } from '../input/midiEcho'
import { isVirtualPort } from '../input/midiPorts'

/**
 * Optional: play the app's piano sound on your own piano over MIDI (USB or Bluetooth)
 * instead of the built-in sampler. Chosen in Settings; when no MIDI output
 * is connected, sound stays on the computer.
 */

export type SoundOutput = 'computer' | 'piano'

const STORAGE_KEY = 'keys.soundOutput'

export function loadSoundOutput(): SoundOutput {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'piano' ? 'piano' : 'computer'
  } catch {
    return 'computer'
  }
}

export function saveSoundOutput(output: SoundOutput): void {
  try {
    localStorage.setItem(STORAGE_KEY, output)
  } catch {
    /* ignore */
  }
}

/** The bits of a MIDI output we use (Web MIDI, or a Bluetooth piano). */
export interface MidiOut {
  name?: string | null
  send(data: number[], timestamp?: number): void
  /** How early to send timestamped notes (default 50 ms; 0 = only when due). */
  sendAheadMs?: number
}

interface OutAccess {
  outputs: Map<string, MidiOut>
  inputs?: Map<string, { name?: string | null }>
  addEventListener(type: 'statechange', listener: () => void): void
  removeEventListener(type: 'statechange', listener: () => void): void
}

let accessPromise: Promise<OutAccess | null> | null = null
/** Set once access resolves, so leaving the page can still send synchronously. */
let accessNow: OutAccess | null = null

function midiAccess(): Promise<OutAccess | null> {
  accessPromise ??= (async () => {
    const request = (
      navigator as Navigator & { requestMIDIAccess?: (o?: { sysex?: boolean }) => Promise<OutAccess> }
    ).requestMIDIAccess
    if (!request) return null
    try {
      accessNow = await request.call(navigator, { sysex: false })
      return accessNow
    } catch {
      return null
    }
  })()
  return accessPromise
}

/**
 * Every connected output, best first: your piano on the cable (the output
 * named like an input: the keys you play), any other real MIDI output, a
 * Bluetooth piano (when there's no cable), then software ports.
 */
const outputsOf = (a: OutAccess | null): MidiOut[] => {
  const web = [...(a?.outputs.values() ?? [])]
  const real = web.filter((o) => !isVirtualPort(o.name))
  const inputNames = new Set([...(a?.inputs?.values() ?? [])].map((i) => i.name ?? ''))
  const paired = real.filter((o) => inputNames.has(o.name ?? ''))
  const ble = bluetoothPiano()
  return [...new Set([...paired, ...real, ...(ble ? [ble] : []), ...web])]
}
const firstOutput = (a: OutAccess | null) => outputsOf(a)[0] ?? null

/** The connected MIDI output's name (for Settings), updating on plug / unplug. */
export function watchPianoOutput(onChange: (name: string | null) => void): () => void {
  let access: OutAccess | null = null
  let stopped = false
  const report = () => {
    const out = firstOutput(access)
    onChange(out ? out.name || 'MIDI output' : null)
  }
  const offBluetooth = onBluetoothChange(report)
  report()
  void midiAccess().then((a) => {
    if (stopped) return
    access = a
    a?.addEventListener('statechange', report)
    report()
  })
  return () => {
    stopped = true
    offBluetooth()
    access?.removeEventListener('statechange', report)
  }
}

/** Your piano, when it's the chosen output and one is connected. */
export async function pianoOutput(): Promise<MidiOut | null> {
  if (loadSoundOutput() !== 'piano') return null
  return firstOutput(await midiAccess())
}

/**
 * Local Control: whether the piano sounds its own keys. Perform turns it off
 * so only the music plays (the keys still reach the app). Sent to every
 * connected output; pianos that ignore it keep sounding their keys.
 */
export function setLocalControl(on: boolean): void {
  const send = (a: OutAccess | null) => {
    for (const out of outputsOf(a)) {
      if (!isVirtualPort(out.name)) out.send([0xb0, 122, on ? 127 : 0])
    }
  }
  // Synchronous when possible, so it still goes out as the page closes.
  if (accessNow) send(accessNow)
  else void midiAccess().then(send)
}

/** Messages go out this far ahead of when they should sound (the device times them). */
const SEND_AHEAD_MS = 50

export interface MidiVoice {
  /** Note on at `atMs` (performance.now() clock) for `durMs`; velocity 0–1. */
  play(midi: number, velocity: number, atMs: number, durMs: number): void
  /** Cancel what's queued and stop everything sounding. */
  releaseAll(): void
  /** The sustain pedal down or up, on the piano. */
  sustain(down: boolean): void
}

/**
 * Plays notes on a MIDI output. Messages are held back until just before
 * they're due, so stopping can cancel them. A pitch struck again before its
 * note-off is re-struck, and the older note-off is dropped so it can't cut
 * the new note short.
 */
export function midiVoice(out: MidiOut, now: () => number = () => performance.now()): MidiVoice {
  const pending = new Set<ReturnType<typeof setTimeout>>()
  /** Your sustain pedal is down (passed on to the piano). */
  let sustaining = false
  /** Pitch → the strike that owns it now. */
  const sounding = new Map<number, number>()
  let strikes = 0

  const ahead = out.sendAheadMs ?? SEND_AHEAD_MS
  const at = (ms: number, fn: () => void) => {
    const wait = ms - now() - ahead
    if (wait <= 0) return fn()
    const id = setTimeout(() => {
      pending.delete(id)
      fn()
    }, wait)
    pending.add(id)
  }
  const stamp = (ms: number) => Math.max(ms, now())

  return {
    play(midi, velocity, atMs, durMs) {
      const strike = ++strikes
      const vel = Math.min(127, Math.max(1, Math.round(velocity * 127)))
      at(atMs, () => {
        if (sounding.has(midi)) out.send([0x80, midi, 0], stamp(atMs))
        sounding.set(midi, strike)
        noteSent(midi, stamp(atMs))
        out.send([0x90, midi, vel], stamp(atMs))
      })
      at(atMs + durMs, () => {
        if (sounding.get(midi) !== strike) return
        sounding.delete(midi)
        out.send([0x80, midi, 0], stamp(atMs + durMs))
      })
    },
    releaseAll() {
      for (const id of pending) clearTimeout(id)
      pending.clear()
      for (const midi of sounding.keys()) out.send([0x80, midi, 0])
      sounding.clear()
      if (sustaining) {
        // Notes held by the pedal would ring on: lift it, silence, and put
        // it back down (your foot is still on it).
        out.send([0xb0, 64, 0])
        out.send([0xb0, 123, 0])
        out.send([0xb0, 64, 127])
      } else {
        out.send([0xb0, 123, 0]) // all notes off
      }
    },
    sustain(down) {
      sustaining = down
      out.send([0xb0, 64, down ? 127 : 0])
    },
  }
}
