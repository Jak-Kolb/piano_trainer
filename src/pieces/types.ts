export type HandFilter = 'both' | 'right' | 'left'

export interface PieceNote {
  /** MIDI note number 0–127 */
  midi: number
  /** Start time in seconds at original tempo */
  time: number
  duration: number
  /** MIDI track index from the file (used to separate LH/RH when ≥2 tracks). */
  track: number
  measure: number
}

export interface StoredPiece {
  id: string
  name: string
  createdAt: string
  /** Original file bytes */
  midiBytes: ArrayBuffer
  durationSec: number
  noteCount: number
  measureCount: number
  hasTwoHands: boolean
}

export interface ParsedPiece {
  notes: PieceNote[]
  durationSec: number
  measureCount: number
  hasTwoHands: boolean
  ppq: number
  /** seconds per quarter at file tempo (first tempo) */
  secPerQuarter: number
  /** VexFlow key name, e.g. "G" or "Em". Defaults to "C". */
  keySignature: string
  /** Time-signature numerator (beats per bar), e.g. 4 in 4/4. */
  beatsPerBar: number
}

export interface PieceControls {
  tempoPercent: number
  loopStartMeasure: number
  loopEndMeasure: number
  hands: HandFilter
}
