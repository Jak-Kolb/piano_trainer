/**
 * Perform mode (like Concert Magic on a digital piano): any key plays the
 * next notes of the piece. You set the rhythm and the touch; the app plays
 * the right notes. Press for every new note, or just a steady beat (the
 * notes inside each beat then play by themselves, at your pace).
 */
import { isCompound } from '../meter'
import { measureInfoAt } from '../tieSlices'
import type { MeasureInfo, PieceNote } from '../types'

/** Keys struck this close together are always one press (a chord, or a bang). */
export const TAP_GAP_MS = 60
/** …and never more than this apart. */
const MAX_GAP_MS = 150

/**
 * How long after a press further keys still belong to it: a third of the
 * time until the next notes are due at your pace, between 60 and 150 ms. A
 * slightly rolled chord is then one press, not two (which skipped a note).
 */
export function chordWindowMs(gapPieceSec: number, pace: number): number {
  const gapMs = (gapPieceSec / Math.max(0.25, pace / 100)) * 1000
  return Math.min(MAX_GAP_MS, Math.max(TAP_GAP_MS, gapMs / 3))
}

/** Always a pause, not a slower tempo, past this… */
const PAUSE_MS = 1500
/** …or past this many times the expected wait (slow pieces can still slow down). */
const PAUSE_FACTOR = 2.5

/**
 * Your pace as a tempo percent, from the time between two presses and the
 * music between them. Smoothed so one uneven press doesn't lurch.
 */
export function nextPace(pace: number, pieceSec: number, realMs: number): number {
  if (pieceSec <= 0 || realMs <= 0) return pace
  const expectedMs = (pieceSec / Math.max(0.25, pace / 100)) * 1000
  if (realMs > Math.max(PAUSE_MS, expectedMs * PAUSE_FACTOR)) return pace
  const tapped = (pieceSec / (realMs / 1000)) * 100
  return Math.min(200, Math.max(25, pace * 0.5 + tapped * 0.5))
}

// ---------------------------------------------------------------------------
// Tap the beat

export interface Beat {
  /** Piece seconds. */
  start: number
  end: number
}

/** Beats in a bar: dotted quarters in 6/8, 9/8 and 12/8, otherwise the time signature's own. */
export function beatsInBar(m: MeasureInfo): number {
  return isCompound(m) ? m.beatsPerBar / 3 : Math.max(1, m.beatsPerBar)
}

/** Every beat of bars lo…hi, following tempo and meter changes. */
export function beatGrid(measures: MeasureInfo[], lo: number, hi: number): Beat[] {
  const out: Beat[] = []
  for (let bar = lo; bar <= hi; bar++) {
    const m = measureInfoAt(measures, bar)
    const n = beatsInBar(m)
    const d = m.durationSec / n
    for (let k = 0; k < n; k++) out.push({ start: m.startSec + k * d, end: m.startSec + (k + 1) * d })
  }
  return out
}

/** A note this close to a beat (as a share of the beat) is on it: played a hair early or late. */
const ON_BEAT = 0.08

/** The beat a time belongs to (a hair early counts as the beat it anticipates). */
export function beatIndexAt(beats: Beat[], t: number): number {
  let lo = 0
  let hi = beats.length - 1
  let best = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const b = beats[mid]!
    if (b.start - ON_BEAT * (b.end - b.start) <= t) {
      best = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return best
}

export interface BeatPlan {
  /** Chords to sound, each this long after the press (piece seconds; 0 = on the press). */
  groups: { offset: number; notes: PieceNote[] }[]
  /** The first step after this beat. */
  nextStep: number
}

/**
 * What one press plays in "Tap the beat": the steps from `from` that fall in
 * `beat`, spaced as in the piece. Notes on the beat sound on the press. A
 * beat with nothing new (a held chord, a rest) plays nothing.
 */
export function beatPlan(steps: PieceNote[][], from: number, beat: Beat): BeatPlan {
  const tol = ON_BEAT * (beat.end - beat.start)
  const groups: BeatPlan['groups'] = []
  let j = from
  while (j < steps.length && steps[j]![0]!.time < beat.end - tol) {
    const offset = steps[j]![0]!.time - beat.start
    groups.push({ offset: offset < tol ? 0 : offset, notes: steps[j]! })
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
