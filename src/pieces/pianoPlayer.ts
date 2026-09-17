import * as Tone from 'tone'
import type { PieceNote } from './types'

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

export function midiToNoteName(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12]!
  const oct = Math.floor(midi / 12) - 1
  return `${name}${oct}`
}

let sampler: Tone.Sampler | null = null
let loadPromise: Promise<Tone.Sampler> | null = null

async function getSampler(): Promise<Tone.Sampler> {
  if (sampler) return sampler
  if (!loadPromise) {
    loadPromise = (async () => {
      await Tone.start()
      const s = new Tone.Sampler({
        urls: SALAMANDER_URLS,
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
        release: 1,
        volume: -6,
      }).toDestination()
      await Tone.loaded()
      sampler = s
      return s
    })()
  }
  return loadPromise
}

/** Schedule piano notes; returns stop(). Times are piece seconds. */
export async function playPianoNotes(
  notes: PieceNote[],
  tempoPercent: number,
): Promise<{
  stop: () => void
  originSec: number
  endSec: number
  startedAt: number
}> {
  const s = await getSampler()
  await Tone.start()

  const tempoFactor = Math.max(0.25, tempoPercent / 100)
  const originSec = notes[0]?.time ?? 0
  const endSec =
    notes.reduce((m, n) => Math.max(m, n.time + n.duration), originSec) + 0.15
  const startedAt = performance.now()
  const now = Tone.now() + 0.05

  for (const n of notes) {
    const when = now + (n.time - originSec) / tempoFactor
    const dur = Math.max(0.08, n.duration / tempoFactor)
    s.triggerAttackRelease(midiToNoteName(n.midi), dur, when, 0.7)
  }

  const stop = () => {
    s.releaseAll()
  }

  return { stop, originSec, endSec, startedAt }
}

/** Warm the sampler (first Play is snappier). */
export function preloadPiano(): void {
  void getSampler().catch(() => {
    /* offline / blocked — Play will retry */
  })
}
