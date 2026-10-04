import type { PieceNote } from './types'

export function pitchClassesOf(notes: PieceNote[]): number[] {
  return [...new Set(notes.map((n) => ((n.midi % 12) + 12) % 12))].sort(
    (a, b) => a - b,
  )
}

export function midiSetMatch(
  heldMidi: number[],
  expected: PieceNote[],
  allowOctave = true,
): boolean {
  if (!expected.length) return false
  if (allowOctave) {
    const held = new Set(heldMidi.map((m) => ((m % 12) + 12) % 12))
    const need = pitchClassesOf(expected)
    if (held.size < need.length) return false
    return need.every((pc) => held.has(pc))
  }
  const held = new Set(heldMidi)
  return expected.every((n) => held.has(n.midi))
}

export function midiNames(midis: number[]): string {
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
  return midis
    .map((m) => `${names[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`)
    .join(' ')
}


/** All expected MIDI notes must be held at once (both hands / chords). */
export function midiChordHeld(heldMidi: number[], expected: PieceNote[]): boolean {
  if (!expected.length) return false
  const held = new Set(heldMidi)
  return expected.every((n) => held.has(n.midi))
}

/** Drop latched midis that are no longer held. */
export function pruneMidiLatch(
  latch: ReadonlySet<number>,
  heldMidi: number[],
): Set<number> {
  const held = new Set(heldMidi)
  const next = new Set<number>()
  for (const m of latch) {
    if (held.has(m)) next.add(m)
  }
  return next
}

/**
 * True when the chord is held AND at least one expected note is a fresh
 * attack (not still latched from the previous accepted step).
 */
export function canAcceptMidiStep(
  heldMidi: number[],
  expected: PieceNote[],
  latch: ReadonlySet<number>,
): boolean {
  if (!midiChordHeld(heldMidi, expected)) return false
  return expected.some((n) => !latch.has(n.midi))
}

/** After accepting a step, latch everything currently held. */
export function latchAfterMidiAccept(heldMidi: number[]): Set<number> {
  return new Set(heldMidi)
}
