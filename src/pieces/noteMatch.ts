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
