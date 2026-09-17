import type { NoteName } from './notes'
import { formatNoteName, pitchClass } from './notes'

/** Pitch with octave + MIDI — used by scales/arpeggios so C4 ≠ C5. */
export interface SpelledPitch extends NoteName {
  octave: number
  midi: number
}

/** One-octave ascending major scale spellings for the six-month set. */
const MAJOR_ONE_OCTAVE: Record<string, NoteName[]> = {
  'C major': [
    { letter: 'C', accidental: '' },
    { letter: 'D', accidental: '' },
    { letter: 'E', accidental: '' },
    { letter: 'F', accidental: '' },
    { letter: 'G', accidental: '' },
    { letter: 'A', accidental: '' },
    { letter: 'B', accidental: '' },
    { letter: 'C', accidental: '' },
  ],
  'G major': [
    { letter: 'G', accidental: '' },
    { letter: 'A', accidental: '' },
    { letter: 'B', accidental: '' },
    { letter: 'C', accidental: '' },
    { letter: 'D', accidental: '' },
    { letter: 'E', accidental: '' },
    { letter: 'F', accidental: '#' },
    { letter: 'G', accidental: '' },
  ],
  'D major': [
    { letter: 'D', accidental: '' },
    { letter: 'E', accidental: '' },
    { letter: 'F', accidental: '#' },
    { letter: 'G', accidental: '' },
    { letter: 'A', accidental: '' },
    { letter: 'B', accidental: '' },
    { letter: 'C', accidental: '#' },
    { letter: 'D', accidental: '' },
  ],
  'A major': [
    { letter: 'A', accidental: '' },
    { letter: 'B', accidental: '' },
    { letter: 'C', accidental: '#' },
    { letter: 'D', accidental: '' },
    { letter: 'E', accidental: '' },
    { letter: 'F', accidental: '#' },
    { letter: 'G', accidental: '#' },
    { letter: 'A', accidental: '' },
  ],
  'E major': [
    { letter: 'E', accidental: '' },
    { letter: 'F', accidental: '#' },
    { letter: 'G', accidental: '#' },
    { letter: 'A', accidental: '' },
    { letter: 'B', accidental: '' },
    { letter: 'C', accidental: '#' },
    { letter: 'D', accidental: '#' },
    { letter: 'E', accidental: '' },
  ],
  'F major': [
    { letter: 'F', accidental: '' },
    { letter: 'G', accidental: '' },
    { letter: 'A', accidental: '' },
    { letter: 'B', accidental: 'b' },
    { letter: 'C', accidental: '' },
    { letter: 'D', accidental: '' },
    { letter: 'E', accidental: '' },
    { letter: 'F', accidental: '' },
  ],
}

function majorArpeggioOneOctave(scaleKey: string): NoteName[] {
  const scale = MAJOR_ONE_OCTAVE[scaleKey]
  if (!scale) return []
  return [scale[0]!, scale[2]!, scale[4]!, scale[7]!]
}

/** RH starts at tonic in octave 4; LH one octave lower. */
export function startOctaveForHand(hand: 'right' | 'left'): number {
  return hand === 'right' ? 4 : 3
}

function noteNameOnly(n: NoteName): NoteName {
  return { letter: n.letter, accidental: n.accidental }
}

/** Ascending MIDI sequence matching spelled names (octave increases as needed). */
export function withAscendingMidi(
  names: NoteName[],
  startOctave: number,
): SpelledPitch[] {
  if (!names.length) return []
  let midi = (startOctave + 1) * 12 + pitchClass(names[0]!)
  // Snap to the tonic pitch class at/above that octave floor
  while (((midi % 12) + 12) % 12 !== pitchClass(names[0]!)) midi++

  const out: SpelledPitch[] = []
  for (let i = 0; i < names.length; i++) {
    const n = names[i]!
    const pc = pitchClass(n)
    if (i > 0) {
      midi++
      while (((midi % 12) + 12) % 12 !== pc) midi++
    }
    out.push({
      ...noteNameOnly(n),
      octave: Math.floor(midi / 12) - 1,
      midi,
    })
  }
  return out
}

export function formatPitch(p: SpelledPitch): string {
  return `${formatNoteName(p)}${p.octave}`
}

export function twoOctaveScaleNotes(
  scaleKey: string,
  hand: 'right' | 'left' = 'right',
): SpelledPitch[] {
  const one = MAJOR_ONE_OCTAVE[scaleKey]
  if (!one) return []
  const names = [...one, ...one.slice(1)]
  return withAscendingMidi(names, startOctaveForHand(hand))
}

export function twoOctaveArpeggioNotes(
  scaleKey: string,
  hand: 'right' | 'left' = 'right',
): SpelledPitch[] {
  const one = majorArpeggioOneOctave(scaleKey)
  if (!one.length) return []
  const names = [...one, ...one.slice(1)]
  return withAscendingMidi(names, startOctaveForHand(hand))
}

export const SCALE_KEY_OPTIONS = Object.keys(MAJOR_ONE_OCTAVE)
