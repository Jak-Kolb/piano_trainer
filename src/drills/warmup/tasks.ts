/** What each warmup section asks you to play, all in one key. */
import {
  CHROMATIC_ROOTS,
  chordSymbol,
  diatonicTriads,
  fingeringFor,
  formatNoteName,
  invertNotes,
  majorArpeggio,
  majorScale,
  progressionChords,
  PROGRESSIONS,
  SCALE_KEY_OPTIONS,
  spellChord,
  upAndDown,
  type Inversion,
  type NoteName,
  type Progression,
  type SpelledPitch,
  type TriadQuality,
} from '../../theory'
import type { Rng } from './theoryQuiz'

export interface ChordTask {
  id: string
  /** Big text: the chord symbol, "Em". */
  title: string
  /** Under the symbol: "1st inversion". */
  detail?: string
  /** Small text: "vi in G major", "lowest note B". */
  hint?: string
  /** Voicing low → high, for "Play it" and revealing the answer. */
  notes: NoteName[]
  pcs: number[]
  /** When set, this note must be lowest (inversions). */
  bass?: NoteName
  roman?: string
}

export interface NotePass {
  label: string
  hand: 'right' | 'left'
  notes: SpelledPitch[]
  /** Finger per note; null where there's no verified fingering. */
  fingers: (number | null)[] | null
}

const pick = <T>(xs: T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)]!

function chordTask(root: NoteName, quality: TriadQuality, extra: Partial<ChordTask> = {}): ChordTask {
  const c = spellChord(root, quality)
  const symbol = chordSymbol(root, quality)
  return { id: symbol, title: symbol, notes: c.notes, pcs: c.pitchClasses, ...extra }
}

/** Keys with verified scale and arpeggio fingerings (the warmup rotates through these). */
export const WARMUP_KEYS = SCALE_KEY_OPTIONS

/** Same key all day, a different one tomorrow. */
export function keyOfTheDay(date = new Date()): string {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
  return WARMUP_KEYS[day % WARMUP_KEYS.length]!
}

export function progressionOfTheDay(date = new Date()): Progression {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
  return PROGRESSIONS[Math.floor(day / WARMUP_KEYS.length) % PROGRESSIONS.length]!
}

/** One-octave fingers from the data, up then back down (descending reverses it). */
function upAndDownFingers(key: string, hand: 'right' | 'left', kind: 'scale' | 'arpeggio') {
  const up = fingeringFor(key, hand, kind)?.ascending
  return up ? [...up, ...up.slice(0, -1).reverse()] : null
}

/** One octave up and down, right hand then left, with fingering. */
export function scalePasses(key: string): NotePass[] {
  return (['right', 'left'] as const).map((hand) => ({
    label: `${key} scale · ${hand === 'right' ? 'right hand' : 'left hand'}`,
    hand,
    notes: upAndDown(majorScale(key), hand),
    fingers: upAndDownFingers(key, hand, 'scale'),
  }))
}

/** The key's arpeggio, one octave up and down, each hand, with fingering. */
export function arpeggioPasses(key: string): NotePass[] {
  const name = key.replace(' major', '')
  return (['right', 'left'] as const).map((hand) => ({
    label: `${name} arpeggio · ${hand === 'right' ? 'right hand' : 'left hand'}`,
    hand,
    notes: upAndDown(majorArpeggio(key), hand),
    fingers: upAndDownFingers(key, hand, 'arpeggio'),
  }))
}

/** Mostly the key's own triads (I…vii°), with an occasional chord from outside it. */
export function triadTasks(key: string, count: number, rng: Rng = Math.random): ChordTask[] {
  const diatonic = diatonicTriads(key)
  const out: ChordTask[] = []
  // Retries skip back-to-back repeats; the guard stops a degenerate RNG looping.
  for (let guard = 0; out.length < count && guard < count * 50; guard++) {
    let t: ChordTask
    if (rng() < 0.2) {
      const root = pick(CHROMATIC_ROOTS, rng)
      t = chordTask(root, rng() < 0.5 ? 'major' : 'minor', { hint: 'outside the key' })
    } else {
      const c = pick(diatonic, rng)
      t = chordTask(c.root, c.quality, { hint: `${c.roman} in ${key}`, roman: c.roman })
    }
    if (out.at(-1)?.id === t.id) continue
    out.push(t)
  }
  return out
}

const INVERSION_NAMES = ['root position', '1st inversion', '2nd inversion']

/** The key's major and minor triads in root, 1st or 2nd inversion (exact lowest note). */
export function inversionTasks(key: string, count: number, rng: Rng = Math.random): ChordTask[] {
  const chords = diatonicTriads(key).filter((c) => c.quality !== 'diminished')
  const out: ChordTask[] = []
  for (let guard = 0; out.length < count && guard < count * 50; guard++) {
    const c = pick(chords, rng)
    const inv = Math.floor(rng() * 3) as Inversion
    const notes = invertNotes(spellChord(c.root, c.quality).notes, inv)
    const id = `${c.symbol}/${inv}`
    if (out.at(-1)?.id === id) continue
    out.push({
      id,
      title: c.symbol,
      detail: INVERSION_NAMES[inv],
      hint: `lowest note ${formatNoteName(notes[0]!)}`,
      notes,
      pcs: spellChord(c.root, c.quality).pitchClasses,
      bass: notes[0]!,
      roman: c.roman,
    })
  }
  return out
}

/** A progression's chords in order (any voicing counts). */
export function progressionTasks(key: string, p: Progression): ChordTask[] {
  return progressionChords(key, p).map((c, i) =>
    chordTask(c.root, c.quality, { id: `${i}:${c.symbol}`, hint: c.roman, roman: c.roman }),
  )
}
