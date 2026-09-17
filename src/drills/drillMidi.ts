/** Thin adapters: NoteName / pitch → MIDI + Salamander demos for Skills drills. */

import type { PieceNote } from '../pieces/types'
import { playPianoNotes } from '../pieces/pianoPlayer'
import type { ActiveKey, PianoHand } from '../pieces/PianoBar'
import { pitchClass, type NoteName } from '../theory'
import { withAscendingMidi } from '../theory'

/** Closed voicing in a middle octave (RH default C4 area). */
export function notesToMidi(notes: NoteName[], startOctave = 4): number[] {
  return withAscendingMidi(notes, startOctave).map((p) => p.midi)
}

/** Merge live held keys with optional revealed targets for PianoBar. */
export function drillActiveKeys(
  heldMidi: number[],
  targetMidi: number[] = [],
  hand: PianoHand = 'right',
): ActiveKey[] {
  const map = new Map<number, PianoHand>()
  for (const m of targetMidi) map.set(m, hand)
  for (const m of heldMidi) {
    // Live holds win the tint when overlapping a target
    map.set(m, hand)
  }
  return [...map.entries()].map(([midi, h]) => ({ midi, hand: h }))
}

/** Pitch-class match for held vs target midis (any octave). */
export function heldPcsMatchTargets(
  heldMidi: number[],
  targetMidi: number[],
): boolean {
  if (heldMidi.length === 0 || targetMidi.length === 0) return false
  const need = new Set(targetMidi.map((m) => ((m % 12) + 12) % 12))
  const held = new Set(heldMidi.map((m) => ((m % 12) + 12) % 12))
  if (held.size !== need.size) return false
  for (const pc of need) {
    if (!held.has(pc)) return false
  }
  return true
}

export function noteNamesPcs(notes: NoteName[]): number[] {
  return notes.map(pitchClass)
}

/**
 * Play a closed chord (slight arpeggio so tones are audible).
 * Returns stop() — caller may ignore.
 */
export async function playChordDemo(
  notes: NoteName[],
  startOctave = 4,
): Promise<{ stop: () => void }> {
  const midis = notesToMidi(notes, startOctave)
  return playMidiDemo(midis)
}

/** Play MIDI numbers together / lightly rolled. */
export async function playMidiDemo(
  midis: number[],
  gapSec = 0.06,
  durationSec = 1.35,
): Promise<{ stop: () => void }> {
  const pieceNotes: PieceNote[] = midis.map((midi, i) => ({
    midi,
    time: i * gapSec,
    duration: durationSec,
    track: 0,
    measure: 0,
    velocity: 0.75,
  }))
  const { stop } = await playPianoNotes(pieceNotes, 100)
  return { stop }
}

/** Ascending scale/arpeggio demo (one note after another). */
export async function playSequenceDemo(
  midis: number[],
  noteSec = 0.28,
): Promise<{ stop: () => void }> {
  const pieceNotes: PieceNote[] = midis.map((midi, i) => ({
    midi,
    time: i * noteSec,
    duration: noteSec * 1.1,
    track: 0,
    measure: 0,
    velocity: 0.75,
  }))
  const { stop } = await playPianoNotes(pieceNotes, 100)
  return { stop }
}
