import type { NoteName } from './notes'
import { formatNoteName } from './notes'

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

/** Root-position major arpeggio one octave: 1–3–5–8 */
function majorArpeggioOneOctave(scaleKey: string): NoteName[] {
  const scale = MAJOR_ONE_OCTAVE[scaleKey]
  if (!scale) return []
  return [scale[0]!, scale[2]!, scale[4]!, scale[7]!]
}

/** Two octaves ascending: repeat after the octave tonic (don't double the join twice). */
export function twoOctaveScaleNotes(scaleKey: string): NoteName[] {
  const one = MAJOR_ONE_OCTAVE[scaleKey]
  if (!one) return []
  return [...one, ...one.slice(1)]
}

export function twoOctaveArpeggioNotes(scaleKey: string): NoteName[] {
  const one = majorArpeggioOneOctave(scaleKey)
  if (!one.length) return []
  return [...one, ...one.slice(1)]
}

export function scaleNoteLabels(notes: NoteName[]): string[] {
  return notes.map(formatNoteName)
}

export const SCALE_KEY_OPTIONS = Object.keys(MAJOR_ONE_OCTAVE)
