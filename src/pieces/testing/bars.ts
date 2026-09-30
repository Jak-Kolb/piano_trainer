import type { MeasureInfo } from '../types'

/** Constant tempo and meter bar timeline for tests. */
export function uniformBars(
  count: number,
  secPerQuarter: number,
  beatsPerBar = 4,
  beatUnit = 4,
): MeasureInfo[] {
  const barSec = ((beatsPerBar * 4) / beatUnit) * secPerQuarter
  return Array.from({ length: count }, (_, i) => ({
    startSec: i * barSec,
    durationSec: barSec,
    beatsPerBar,
    beatUnit,
    keySignature: 'C',
  }))
}
