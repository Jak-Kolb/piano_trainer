/** Shared input contract — drill logic is identical across modes. */

export type GradeResult = 'correct' | 'incorrect' | 'pending'

export interface InputSource {
  readonly id: 'midi' | 'mic' | 'self-report'
  readonly label: string
  /** Currently held pitch classes (0–11), if the source can observe them. */
  getHeldPitchClasses(): number[]
  /** Self-report and mic-limited modes use explicit grade signals. */
  supportsAutomaticGrade(): boolean
  /** Subscribe to held-note changes (MIDI). Returns unsubscribe. */
  onChange(listener: () => void): () => void
  dispose(): void
}
