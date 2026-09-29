import type { InputSource } from './types'

export function createSelfReportSource(): InputSource {
  const listeners = new Set<() => void>()
  return {
    id: 'self-report',
    label: 'Self-report',
    getStatus: () => 'Tap Hit or Miss after you play',
    getHeldPitchClasses: () => [],
    getHeldMidiNotes: () => [],
    getMeter: () => null,
    supportsAutomaticGrade: () => false,
    hasDevice: () => false,
    async start() {},
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    onNote: () => () => {},
    dispose() {
      listeners.clear()
    },
  }
}
