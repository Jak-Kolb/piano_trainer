import * as Tone from 'tone'
import { midiVoice, pianoOutput, type MidiOut, type MidiVoice } from './pianoOut'
import type { PieceNote } from './types'
import {
  dynamicToDb,
  meanVelocity,
  velocityToDynamic,
  velocityToGain,
} from './dynamics'

/** Salamander Grand samples hosted by Tone.js (subset; Sampler interpolates). */
const SALAMANDER_URLS: Record<string, string> = {
  A0: 'A0.mp3',
  C1: 'C1.mp3',
  'D#1': 'Ds1.mp3',
  'F#1': 'Fs1.mp3',
  A1: 'A1.mp3',
  C2: 'C2.mp3',
  'D#2': 'Ds2.mp3',
  'F#2': 'Fs2.mp3',
  A2: 'A2.mp3',
  C3: 'C3.mp3',
  'D#3': 'Ds3.mp3',
  'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  'D#4': 'Ds4.mp3',
  'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
  'D#5': 'Ds5.mp3',
  'F#5': 'Fs5.mp3',
  A5: 'A5.mp3',
  C6: 'C6.mp3',
  'D#6': 'Ds6.mp3',
  'F#6': 'Fs6.mp3',
  A6: 'A6.mp3',
  C7: 'C7.mp3',
  'D#7': 'Ds7.mp3',
  'F#7': 'Fs7.mp3',
  A7: 'A7.mp3',
  C8: 'C8.mp3',
}

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

/** Safety cap so a stuck pedal can't hold voices forever. */
const MAX_VOICE_SEC = 8
/** Pedal tails keep the demo running this long past the last key release. */
const MAX_TAIL_SEC = 3

export function midiToNoteName(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12]!
  const oct = Math.floor(midi / 12) - 1
  return `${name}${oct}`
}

let sampler: Tone.Sampler | null = null
let loadPromise: Promise<Tone.Sampler> | null = null
let limiter: Tone.Limiter | null = null

async function getSampler(): Promise<Tone.Sampler> {
  if (sampler) return sampler
  if (!loadPromise) {
    loadPromise = (async () => {
      await Tone.start()
      // Soft ceiling so dense song passages don't crackle
      limiter = new Tone.Limiter(-3).toDestination()
      const s = new Tone.Sampler({
        urls: SALAMANDER_URLS,
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
        release: 0.85,
        volume: -8,
      }).connect(limiter)
      await Tone.loaded()
      sampler = s
      return s
    })()
  }
  return loadPromise
}

type PartEv = { note: string; dur: number; vel: number; midi: number; velocity: number }

/** What sounds the notes: the sampler, or your piano over MIDI (Settings). */
interface Voice {
  /** The sampler when it's the one playing (for the song's overall level). */
  sampler: Tone.Sampler | null
  /** One note at Tone time `time`. */
  play(ev: PartEv, time: number): void
  /** One note played live (Learn, Perform): it follows your sustain pedal. */
  playLive(ev: PartEv, time: number): void
  releaseAll(): void
}

const midiVoices = new WeakMap<MidiOut, MidiVoice>()
let lastMidiVoice: MidiVoice | null = null

function midiVoiceFor(out: MidiOut): MidiVoice {
  const v = midiVoices.get(out) ?? midiVoice(out)
  midiVoices.set(out, v)
  return v
}

/**
 * The sustain pedal for the built-in piano: a live note whose key time is up
 * while the pedal is down rings on until the pedal lifts (as on a piano:
 * notes already sounding are caught too).
 */
export function createSustain(release: (note: string) => void) {
  let down = false
  const held = new Set<string>()
  return {
    keyUp(note: string) {
      if (down) held.add(note)
      else release(note)
    },
    set(next: boolean) {
      down = next
      if (down) return
      for (const n of held) release(n)
      held.clear()
    },
  }
}

const samplerSustain = createSustain((note) => sampler?.triggerRelease(note, Tone.immediate()))

async function getVoice(): Promise<Voice> {
  const out = await pianoOutput()
  if (out) {
    const v = midiVoiceFor(out)
    lastMidiVoice = v
    await Tone.start()
    // Tone time → the performance.now() clock MIDI timestamps use
    const play = (ev: PartEv, time: number) =>
      v.play(ev.midi, ev.velocity, performance.now() + (time - Tone.immediate()) * 1000, ev.dur * 1000)
    // Your piano does the pedal itself (setSustainPedal passes it on).
    return { sampler: null, play, playLive: play, releaseAll: () => v.releaseAll() }
  }
  const s = await getSampler()
  return {
    sampler: s,
    play: (ev, time) => s.triggerAttackRelease(ev.note, ev.dur, time, ev.vel),
    playLive: (ev, time) => {
      s.triggerAttack(ev.note, time, ev.vel)
      window.setTimeout(() => samplerSustain.keyUp(ev.note), (time - Tone.immediate() + ev.dur) * 1000)
    },
    releaseAll: () => s.releaseAll(),
  }
}

/**
 * Your sustain pedal, for notes the app plays live (Perform): passed on to
 * your piano when that's where the sound goes, else applied to the
 * built-in piano.
 */
export function setSustainPedal(down: boolean): void {
  samplerSustain.set(down)
  void pianoOutput().then((out) => {
    if (out) midiVoiceFor(out).sustain(down)
  })
}

/**
 * Schedule for a demo: event times from the first note, lengths from the
 * sustain-pedal `soundEnd`, all scaled by tempo. `endSec` is in piece time.
 */
export function demoEvents(
  notes: PieceNote[],
  tempoPercent: number,
): { events: Array<{ time: number } & PartEv>; originSec: number; endSec: number } {
  const tempoFactor = Math.max(0.25, tempoPercent / 100)
  const sorted = [...notes].sort((a, b) => a.time - b.time || a.midi - b.midi)
  const originSec = sorted[0]?.time ?? 0
  const lastRelease = sorted.reduce(
    (m, n) => Math.max(m, n.time + n.duration),
    originSec,
  )
  const lastSound = sorted.reduce(
    (m, n) => Math.max(m, n.soundEnd ?? n.time + n.duration),
    lastRelease,
  )
  const endSec = Math.min(lastSound, lastRelease + MAX_TAIL_SEC) + 0.15
  const events = sorted.map((n) => {
    const sounding = (n.soundEnd ?? n.time + n.duration) - n.time
    return {
      time: (n.time - originSec) / tempoFactor,
      note: midiToNoteName(n.midi),
      dur: Math.min(MAX_VOICE_SEC, Math.max(0.08, sounding / tempoFactor)),
      vel: velocityToGain(n.velocity ?? 0.7),
      midi: n.midi,
      velocity: n.velocity ?? 0.7,
    }
  })
  return { events, originSec, endSec }
}

/** Schedule piano notes; returns stop(). Times are piece seconds. */
export async function playPianoNotes(
  notes: PieceNote[],
  tempoPercent: number,
): Promise<{
  stop: () => void
  pause: () => void
  resume: () => void
  originSec: number
  endSec: number
  startedAt: number
}> {
  const s = await getVoice()
  await Tone.start()

  // Clear any prior song schedule so Play song can re-run cleanly
  Tone.Transport.stop()
  Tone.Transport.cancel(0)
  Tone.Transport.seconds = 0
  s.releaseAll()

  const { events, originSec, endSec } = demoEvents(notes, tempoPercent)

  // Whole-demo level from the opening dynamic (mp song plays quieter than mf).
  // Your own piano gets the note velocities instead.
  const sorted = [...notes].sort((a, b) => a.time - b.time || a.midi - b.midi)
  const openLabel = velocityToDynamic(meanVelocity(sorted.slice(0, 12)))
  const baseDb = s.sampler?.volume.value ?? 0
  if (s.sampler) s.sampler.volume.value = dynamicToDb(openLabel)

  // Tone.Part is the same voice engine as one-shot triggers, but cancels cleanly
  // and doesn't dump thousands of raw AudioParam events in one sync loop.
  const part = new Tone.Part((time, ev: PartEv) => s.play(ev, time), events)
  part.start(0)

  // Keep UI playhead aligned with audible attacks
  const leadSec = 0.06
  Tone.Transport.start(Tone.now() + leadSec)
  const startedAt = performance.now() + leadSec * 1000

  let stopped = false
  let paused = false
  const stop = () => {
    if (stopped) return
    stopped = true
    paused = false
    try {
      part.stop()
      part.dispose()
    } catch {
      /* already disposed */
    }
    s.releaseAll()
    if (s.sampler) s.sampler.volume.value = baseDb
    Tone.Transport.stop()
    Tone.Transport.cancel(0)
    Tone.Transport.seconds = 0
  }

  const pause = () => {
    if (stopped || paused) return
    paused = true
    Tone.Transport.pause()
    s.releaseAll()
  }

  const resume = () => {
    if (stopped || !paused) return
    paused = false
    Tone.Transport.start()
  }

  return { stop, pause, resume, originSec, endSec, startedAt }
}

/**
 * Learn mode's other hand: sound these notes now, spaced as in the piece
 * from `fromSec` at this tempo. Independent of the demo transport.
 */
export async function playAccompaniment(
  notes: PieceNote[],
  tempoPercent: number,
  fromSec: number,
): Promise<void> {
  if (!notes.length) return
  const s = await getVoice()
  const tempoFactor = Math.max(0.25, tempoPercent / 100)
  // Played live (Learn, Perform): start right away, not a scheduling
  // look-ahead (~0.1 s) later.
  const now = Tone.immediate()
  for (const n of notes) {
    const sounding = (n.soundEnd ?? n.time + n.duration) - n.time
    s.playLive(
      {
        note: midiToNoteName(n.midi),
        dur: Math.min(MAX_VOICE_SEC, Math.max(0.08, sounding / tempoFactor)),
        vel: velocityToGain(n.velocity ?? 0.7),
        midi: n.midi,
        velocity: n.velocity ?? 0.7,
      },
      now + Math.max(0, n.time - fromSec) / tempoFactor,
    )
  }
}

/** Stop anything the sampler is sounding (accompaniment, previews). */
export function silencePiano(): void {
  samplerSustain.set(false)
  sampler?.releaseAll()
  lastMidiVoice?.releaseAll()
}

let clickSynth: Tone.Synth | null = null

function getClickSynth(): Tone.Synth {
  if (!clickSynth) {
    clickSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
      volume: -10,
    }).toDestination()
  }
  return clickSynth
}

export interface PlayAlongPlan {
  /** Piece time where the run starts (after any count-in). */
  originSec: number
  /** Other-hand notes the app plays (empty when you play both hands). */
  notes: PieceNote[]
  /** Metronome and count-in clicks, in piece time (count-in is before originSec). */
  clicks: { time: number; accent: boolean }[]
  /** Count-in length in piece seconds (0 = start straight away). */
  countInSec: number
  tempoPercent: number
}

/**
 * Real-time play-along: schedule accompaniment and clicks on the Tone
 * transport. `startedAt` is the performance.now() time at which the piece
 * reaches `originSec`, for mapping key presses to piece time.
 */
export async function startPlayAlong(
  plan: PlayAlongPlan,
): Promise<{ startedAt: number; stop: () => void }> {
  const s = await getVoice()
  await Tone.start()
  Tone.Transport.stop()
  Tone.Transport.cancel(0)
  Tone.Transport.seconds = 0
  s.releaseAll()

  const tempoFactor = Math.max(0.25, plan.tempoPercent / 100)
  const leadIn = plan.countInSec / tempoFactor
  const at = (pieceSec: number) => leadIn + (pieceSec - plan.originSec) / tempoFactor
  const { events } = demoEvents(plan.notes, plan.tempoPercent)
  const firstNote = plan.notes.reduce((m, n) => Math.min(m, n.time), Infinity)
  const noteShift = Number.isFinite(firstNote) ? at(firstNote) : 0
  const notePart = new Tone.Part(
    (time, ev: PartEv) => s.play(ev, time),
    events.map((e) => ({ ...e, time: e.time + noteShift })),
  )
  notePart.start(0)

  const click = getClickSynth()
  const clickPart = new Tone.Part(
    (time, ev: { accent: boolean }) => {
      click.triggerAttackRelease(ev.accent ? 'C7' : 'G6', 0.03, time)
    },
    plan.clicks
      .map((c) => ({ time: at(c.time), accent: c.accent }))
      .filter((c) => c.time >= 0),
  )
  clickPart.start(0)

  const leadSec = 0.06
  Tone.Transport.start(Tone.now() + leadSec)
  const startedAt = performance.now() + (leadSec + leadIn) * 1000

  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    for (const part of [notePart, clickPart]) {
      try {
        part.stop()
        part.dispose()
      } catch {
        /* already disposed */
      }
    }
    s.releaseAll()
    Tone.Transport.stop()
    Tone.Transport.cancel(0)
    Tone.Transport.seconds = 0
  }
  return { startedAt, stop }
}

/** Warm the sampler (first Play is snappier). */
export function preloadPiano(): void {
  void getSampler().catch(() => {
    /* offline / blocked — Play will retry */
  })
}
