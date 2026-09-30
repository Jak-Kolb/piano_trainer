/**
 * Optional: play the app's piano sound on your own piano over USB MIDI
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

/** The bits of a Web MIDI output we use. */
export interface MidiOut {
  name?: string | null
  send(data: number[], timestamp?: number): void
}

interface OutAccess {
  outputs: Map<string, MidiOut>
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

const firstOutput = (a: OutAccess | null) => (a ? [...a.outputs.values()][0] : undefined) ?? null

/** The connected MIDI output's name (for Settings), updating on plug / unplug. */
export function watchPianoOutput(onChange: (name: string | null) => void): () => void {
  let access: OutAccess | null = null
  let stopped = false
  const report = () => {
    const out = firstOutput(access)
    onChange(out ? out.name || 'MIDI output' : null)
  }
  void midiAccess().then((a) => {
    if (stopped) return
    access = a
    a?.addEventListener('statechange', report)
    report()
  })
  return () => {
    stopped = true
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
    for (const out of a?.outputs.values() ?? []) out.send([0xb0, 122, on ? 127 : 0])
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
}

/**
 * Plays notes on a MIDI output. Messages are held back until just before
 * they're due, so stopping can cancel them. A pitch struck again before its
 * note-off is re-struck, and the older note-off is dropped so it can't cut
 * the new note short.
 */
export function midiVoice(out: MidiOut, now: () => number = () => performance.now()): MidiVoice {
  const pending = new Set<ReturnType<typeof setTimeout>>()
  /** Pitch → the strike that owns it now. */
  const sounding = new Map<number, number>()
  let strikes = 0

  const at = (ms: number, fn: () => void) => {
    const wait = ms - now() - SEND_AHEAD_MS
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
      out.send([0xb0, 123, 0]) // all notes off
    },
  }
}
