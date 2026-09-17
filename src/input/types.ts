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

export interface InputSource {
  readonly id: InputModeId
  readonly label: string
  getStatus(): string
  getHeldPitchClasses(): number[]
  getHeldMidiNotes(): number[]
  /** Live level meter — mic only; others may return null. */
  getMeter(): MicMeter | null
  supportsAutomaticGrade(): boolean
  start(): Promise<void>
  onChange(listener: () => void): () => void
  dispose(): void
}
