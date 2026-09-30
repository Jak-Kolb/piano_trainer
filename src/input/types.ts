/** Shared input contract — drill logic is identical across modes. */

export type InputModeId = 'midi' | 'self-report'

export type GradeResult = 'correct' | 'incorrect' | 'pending'

export interface MicMeter {
  rms: number
  gate: number
  /** Detected note name, or null if listening / silence */
  note: string | null
  status: string
}

/** One key press or release, timed on the performance.now() clock (ms). */
export interface NoteEvent {
  midi: number
  on: boolean
  /** 0–1; 0 for releases. */
  velocity: number
  time: number
}

export interface InputSource {
  readonly id: InputModeId
  readonly label: string
  getStatus(): string
  getHeldPitchClasses(): number[]
  getHeldMidiNotes(): number[]
  /** Live level meter — mic only; others may return null. */
  getMeter(): MicMeter | null
  supportsAutomaticGrade(): boolean
  /** A keyboard is actually connected (MIDI mode with a device plugged in). */
  hasDevice(): boolean
  start(): Promise<void>
  onChange(listener: () => void): () => void
  /** Individual key presses/releases with timestamps (MIDI only). */
  onNote(listener: (e: NoteEvent) => void): () => void
  dispose(): void
}
