export interface MicSettings {
  /** Absolute RMS floor — higher = less sensitive to quiet noise. */
  minRms: number
  /** YIN clarity 0–1 — higher = pickier about “is this a real note?” */
  minClarity: number
  /** Frames a pitch must hold before we report it. */
  attackFrames: number
  /** Quiet frames before clearing the held note. */
  releaseFrames: number
  /** Multiplier on adaptive noise floor for the live gate. */
  noiseGateMult: number
  /** YIN difference threshold — lower = more detections. */
  yinThreshold: number
}

export const DEFAULT_MIC_SETTINGS: MicSettings = {
  minRms: 0.035,
  minClarity: 0.82,
  attackFrames: 5,
  releaseFrames: 10,
  noiseGateMult: 5,
  yinThreshold: 0.12,
}

const KEY = 'keys.micSettings'

export function loadMicSettings(): MicSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_MIC_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<MicSettings>
    return { ...DEFAULT_MIC_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_MIC_SETTINGS }
  }
}

export function saveMicSettings(s: MicSettings) {
  localStorage.setItem(KEY, JSON.stringify(s))
}
