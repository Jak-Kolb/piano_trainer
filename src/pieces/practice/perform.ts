/**
 * Perform mode (like Concert Magic on a digital piano): any key plays the
 * next notes of the piece. You set the rhythm and the touch; the app plays
 * the right notes. Press for every new note, or ("Assisted") for every note
 * down to eighth notes while faster ones (16ths, 32nds) play by themselves.
 */
import { barQuarters } from '../meter'
import { chooseStep, TPQ } from '../notate'
import { measureInfoAt } from '../tieSlices'
import type { MeasureInfo, PieceNote } from '../types'

/**
 * Perform plays notes this close together as one chord, on the press. Wider
 * than a chord's natural spread, narrower than a fast run: 32nds stay a run.
 * (Learn groups more loosely, so a spread chord is one chord to play.)
 */
export const PERFORM_CHORD_SEC = 0.05

/** Keys struck this close together are always one press (a chord, or a bang). */
export const TAP_GAP_MS = 60
/** …and a press is never ignored for longer than this. */
const MAX_IGNORE_MS = 600
/** A press counts once this share of the time to the next notes has passed. */
const TOO_SOON = 0.45

/**
 * A press sooner than this after the last one is ignored: under half the
 * time until the next notes are due at your pace (60 ms to 0.6 s). A rolled
 * chord, a double hit or two keys back to back then don't race ahead, while
 * you can still speed up (each counted press up to about twice as fast).
 */
export function tooSoonMs(gapPieceSec: number, pace: number): number {
  const gapMs = (gapPieceSec / Math.max(0.25, pace / 100)) * 1000
  return Math.min(MAX_IGNORE_MS, Math.max(TAP_GAP_MS, gapMs * TOO_SOON))
}

// ---------------------------------------------------------------------------
// Following your pace

export interface Pace {
  /** Tempo percent the notes are played at. */
  pace: number
  /** Your real milliseconds per second of the piece, from your presses (null: none yet). */
  msPerSec: number | null
}

/** The first gap between presses: longer than this is a pause, not a tempo. */
const FIRST_PAUSE_MS = 4000
/** Later gaps: this many times slower than you've been going is a pause. */
const PAUSE_FACTOR = 3

/**
 * Your pace after a press: `pieceSec` of music took `realMs`. It follows
 * you straight away (the second press already sets it), mostly trusting the
 * latest gap; a much longer gap than your own recent ones is a pause.
 */
export function followPace(p: Pace, pieceSec: number, realMs: number): Pace {
  if (pieceSec <= 0 || realMs <= 0) return p
  const msPerSec = realMs / pieceSec
  const pause = p.msPerSec === null ? realMs > FIRST_PAUSE_MS : msPerSec > p.msPerSec * PAUSE_FACTOR
  if (pause) return p
  const tapped = 100_000 / msPerSec
  const pace = Math.min(200, Math.max(25, p.msPerSec === null ? tapped : p.pace * 0.4 + tapped * 0.6))
  return { pace, msPerSec: 100_000 / pace }
}

// ---------------------------------------------------------------------------
// Assisted: which notes take a press

/** How far off the grid (in ticks, TPQ per quarter) a note can be and still be on it. */
const SLACK_TICKS = 0.8

/**
 * For each step, whether it takes a press with "Assisted": notes on an eighth
 * (or, in a beat of triplets or sextuplets, on a triplet eighth) do; the
 * faster notes between them (16ths, 32nds, the in-between sextuplets) don't.
 * The subdivision is read per beat, as the sheet does.
 */
export function pressPoints(steps: PieceNote[][], measures: MeasureInfo[]): boolean[] {
  const where = steps.map((s) => {
    const n = s[0]!
    const m = measureInfoAt(measures, n.measure)
    const q = (n.time - m.startSec) / (m.durationSec / Math.max(0.25, barQuarters(m)))
    const k = Math.floor(q + 1 / 12) // a hair early counts as on the beat
    return { key: `${n.measure}:${k}`, x: q - k }
  })
  const xsByBeat = new Map<string, number[]>()
  for (const w of where) xsByBeat.set(w.key, [...(xsByBeat.get(w.key) ?? []), w.x])
  const grid = new Map([...xsByBeat].map(([key, xs]) => [key, chooseStep(xs) === 3 ? TPQ / 2 : TPQ / 3]))
  return where.map((w, i) => {
    if (i === 0) return true
    const t = w.x * TPQ
    const g = grid.get(w.key)!
    return Math.abs(t - Math.round(t / g) * g) < SLACK_TICKS
  })
}

export interface PressPlan {
  /** Chords to sound, each this long after the press (piece seconds; the first is 0). */
  groups: { offset: number; notes: PieceNote[] }[]
  /** The step the next press plays. */
  nextStep: number
}

/**
 * What one press plays with "Assisted": the step at `from`, then the faster
 * notes after it up to the next note that takes a press, never as much as
 * `eighthSec` (an eighth note) later.
 */
export function pressPlan(
  steps: PieceNote[][],
  from: number,
  press: boolean[],
  eighthSec: number,
): PressPlan {
  const t0 = steps[from]![0]!.time
  const groups: PressPlan['groups'] = [{ offset: 0, notes: steps[from]! }]
  let j = from + 1
  while (j < steps.length && !press[j] && steps[j]![0]!.time - t0 < eighthSec * 0.9) {
    groups.push({ offset: steps[j]![0]!.time - t0, notes: steps[j]! })
    j++
  }
  return { groups, nextStep: j }
}

/**
 * The notes with your touch: scaled so the step's average loudness matches
 * how hard you pressed, keeping the balance inside the chord. No velocity
 * (a click or Space) keeps the file's.
 */
export function withTouch(
  notes: PieceNote[],
  step: PieceNote[],
  velocity: number | null,
): PieceNote[] {
  if (velocity === null || !step.length) return notes
  const mean = step.reduce((a, n) => a + (n.velocity ?? 0.7), 0) / step.length
  const scale = velocity / Math.max(0.05, mean)
  return notes.map((n) => ({
    ...n,
    velocity: Math.min(1, Math.max(0.05, (n.velocity ?? 0.7) * scale)),
  }))
}
