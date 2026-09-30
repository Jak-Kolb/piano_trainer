/**
 * Perform mode (like Concert Magic on a digital piano): any key plays the
 * next notes of the piece. You set the rhythm and the touch; the app plays
 * the right notes.
 */
import type { PieceNote } from '../types'

/** Keys struck this close together are one press (a chord, or a bang). */
export const TAP_GAP_MS = 60

/** Longer than this between presses is a pause, not a slower tempo. */
const PAUSE_MS = 2000

/**
 * Your pace as a tempo percent, from the time between two presses and the
 * music between them. Smoothed so one uneven press doesn't lurch.
 */
export function nextPace(pace: number, pieceSec: number, realMs: number): number {
  if (pieceSec <= 0 || realMs <= 0 || realMs > PAUSE_MS) return pace
  const tapped = (pieceSec / (realMs / 1000)) * 100
  return Math.min(200, Math.max(25, pace * 0.5 + tapped * 0.5))
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
