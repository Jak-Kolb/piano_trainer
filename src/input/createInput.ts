import type { MicSettings } from '../settings/micSettings'
import { DEFAULT_MIC_SETTINGS } from '../settings/micSettings'
import { createMicSource } from './MicSource'
import { createMidiSource, midiSupported } from './MidiSource'
import { createSelfReportSource } from './SelfReportSource'
import type { InputModeId, InputSource } from './types'

const STORAGE_KEY = 'keys.inputMode'

export function loadSavedInputMode(): InputModeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'midi' || v === 'mic' || v === 'self-report') return v
  } catch {
    /* ignore */
  }
  return midiSupported() ? 'midi' : 'self-report'
}

export function saveInputMode(mode: InputModeId) {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}

export function createInputSource(
  mode: InputModeId,
  micSettings: MicSettings = DEFAULT_MIC_SETTINGS,
): InputSource {
  switch (mode) {
    case 'midi':
      return createMidiSource()
    case 'mic':
      return createMicSource(micSettings)
    case 'self-report':
      return createSelfReportSource()
  }
}

export const INPUT_MODE_OPTIONS: {
  id: InputModeId
  label: string
  hint: string
}[] = [
  {
    id: 'midi',
    label: 'MIDI',
    hint: 'USB keyboard grades chords & notes automatically',
  },
  {
    id: 'mic',
    label: 'Microphone',
    hint: 'Clear single notes only — ignores noise; chords use Hit/Miss',
  },
  {
    id: 'self-report',
    label: 'Self-report',
    hint: 'You tap Hit or Miss — always works',
  },
]
