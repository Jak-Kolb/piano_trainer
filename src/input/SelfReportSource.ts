import type { InputSource } from './types'

/** Always-available fallback: no automatic pitch observation. */
export function createSelfReportSource(): InputSource {
  const listeners = new Set<() => void>()
  return {
    id: 'self-report',
    label: 'Self-report',
    getHeldPitchClasses: () => [],
    supportsAutomaticGrade: () => false,
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      listeners.clear()
    },
  }
}
