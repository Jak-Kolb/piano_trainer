import type { MeasureInfo } from './types'

export function measureInfoAt(
  measures: MeasureInfo[],
  measure: number,
): MeasureInfo {
  const idx = Math.max(1, measure) - 1
  const hit = measures[idx]
  if (hit) return hit
  // Extend past the array with the last known bar length (or a 4/4 default).
  const last = measures[measures.length - 1]
  if (last) {
    const delta = idx - (measures.length - 1)
    return {
      startSec: last.startSec + delta * last.durationSec,
      durationSec: last.durationSec,
      beatsPerBar: last.beatsPerBar,
      beatUnit: last.beatUnit,
      keySignature: last.keySignature,
    }
  }
  return {
    startSec: idx * 2,
    durationSec: 2,
    beatsPerBar: 4,
    beatUnit: 4,
    keySignature: 'C',
  }
}

/** @deprecated Prefer measureInfoAt(measures, m).startSec — constant-tempo only. */
export function barStartSec(
  measure: number,
  secPerQuarter: number,
  beatsPerBar = 4,
): number {
  return (Math.max(1, measure) - 1) * beatsPerBar * secPerQuarter
}
