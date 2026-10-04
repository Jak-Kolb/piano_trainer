/** Learn mode (wait for the right notes): feedback and accompaniment. */
import type { PieceNote } from '../types'

export type HeldState = 'good' | 'wrong' | 'held'

/**
 * A fresh key press is a mistake when it isn't in the step you're on and
 * isn't a note the other hand plays nearby (you playing along with it).
 */
export function isWrongNote(
  midi: number,
  step: PieceNote[],
  otherHandNearby: PieceNote[],
): boolean {
  if (step.some((n) => n.midi === midi)) return false
  return !otherHandNearby.some((n) => n.midi === midi)
}

/** Colour each held key: part of this step, a wrong press, or just held. */
export function classifyHeld(
  held: number[],
  step: PieceNote[],
  wrong: ReadonlySet<number>,
): Map<number, HeldState> {
  const need = new Set(step.map((n) => n.midi))
  const out = new Map<number, HeldState>()
  for (const m of held) {
    out.set(m, need.has(m) ? 'good' : wrong.has(m) ? 'wrong' : 'held')
  }
  return out
}

/**
 * Other-hand notes to play once you finish a step: everything from that
 * step up to the next one, so the accompaniment waits when you do.
 */
export function accompanimentFor(
  other: PieceNote[],
  fromSec: number,
  toSec: number,
): PieceNote[] {
  const eps = 0.02
  return other.filter((n) => n.time >= fromSec - eps && n.time < toSec - eps)
}
