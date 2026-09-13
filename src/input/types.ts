/** Shared input contract — drill logic is identical across modes. */

export type InputModeId = 'midi' | 'mic' | 'self-report'

export type GradeResult = 'correct' | 'incorrect' | 'pending'

export interface InputSource {
  readonly id: InputModeId
  readonly label: string
  /** Human-readable device / status line (e.g. MIDI device name). */
  getStatus(): string
  /** Currently held pitch classes (0–11), if the source can observe them. */
  getHeldPitchClasses(): number[]
  /**
   * True when this source can auto-grade the current drill kind.
   * Mic is monophonic-only — chord drills should pass false from the drill.
   */
  supportsAutomaticGrade(): boolean
  /** Start listening (mic permission, MIDI access). Idempotent. */
  start(): Promise<void>
  onChange(listener: () => void): () => void
  dispose(): void
}
