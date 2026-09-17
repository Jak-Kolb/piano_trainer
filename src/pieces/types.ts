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
  /** Note-on velocity 0–1 from the MIDI file (dynamics). */
  velocity: number
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

/** Absolute timing for one bar (handles tempo + time-sig changes). */
export interface MeasureInfo {
  /** Absolute start time (seconds) */
  startSec: number
  /** Bar length in seconds */
  durationSec: number
  /** Numerator for this bar (3 or 4 etc.) */
  beatsPerBar: number
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
  /** Time-signature numerator of the *first* bar (for barsPerSystem). */
  beatsPerBar: number
  /**
   * Per-measure timeline. Index 0 = measure 1.
   * Built from Tone ticksToMeasures / ticksToSeconds so bar starts
   * stay correct across tempo and meter changes.
   */
  measures: MeasureInfo[]
}

export interface PieceControls {
  tempoPercent: number
  loopStartMeasure: number
  loopEndMeasure: number
  hands: HandFilter
}
