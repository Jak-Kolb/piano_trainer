import * as Tone from 'tone'
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

/** Keep voices free on long pieces (line/bar rarely hit this). */
const MAX_VOICE_SEC = 1.6

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

type PartEv = { note: string; dur: number; vel: number }

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
  const s = await getSampler()
  await Tone.start()

  // Clear any prior song schedule so Play song can re-run cleanly
  Tone.Transport.stop()
  Tone.Transport.cancel(0)
  Tone.Transport.seconds = 0
  s.releaseAll()

  const tempoFactor = Math.max(0.25, tempoPercent / 100)
  const sorted = [...notes].sort((a, b) => a.time - b.time || a.midi - b.midi)
  const originSec = sorted[0]?.time ?? 0
  const endSec =
    sorted.reduce((m, n) => Math.max(m, n.time + n.duration), originSec) + 0.15

  // Whole-demo level from the opening dynamic (mp song plays quieter than mf)
  const openLabel = velocityToDynamic(meanVelocity(sorted.slice(0, 12)))
  const baseDb = s.volume.value
  s.volume.value = dynamicToDb(openLabel)

  const events: Array<{ time: number } & PartEv> = sorted.map((n) => {
    const t = (n.time - originSec) / tempoFactor
    const dur = Math.min(
      MAX_VOICE_SEC,
      Math.max(0.08, n.duration / tempoFactor),
    )
    const vel = velocityToGain(n.velocity ?? 0.7)
    return {
      time: t,
      note: midiToNoteName(n.midi),
      dur,
      vel,
    }
  })

  // Tone.Part is the same voice engine as one-shot triggers, but cancels cleanly
  // and doesn't dump thousands of raw AudioParam events in one sync loop.
  const part = new Tone.Part((time, ev: PartEv) => {
    s.triggerAttackRelease(ev.note, ev.dur, time, ev.vel)
  }, events)
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
    s.volume.value = baseDb
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

/** Warm the sampler (first Play is snappier). */
export function preloadPiano(): void {
  void getSampler().catch(() => {
    /* offline / blocked — Play will retry */
  })
}
