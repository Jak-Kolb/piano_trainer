/** Shared input contract — drill logic is identical across modes. */

export type InputModeId = 'midi' | 'mic' | 'self-report'

export type GradeResult = 'correct' | 'incorrect' | 'pending'

export interface InputSource {
  readonly id: InputModeId
  readonly label: string
  getStatus(): string
  /** Pitch classes 0–11 currently held / detected. */
  getHeldPitchClasses(): number[]
  /** Raw MIDI note numbers held (MIDI source only; others may be empty). */
  getHeldMidiNotes(): number[]
  supportsAutomaticGrade(): boolean
  start(): Promise<void>
  onChange(listener: () => void): () => void
  dispose(): void
}
