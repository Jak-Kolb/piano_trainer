import { measureInfoAt } from './tieSlices'
import type { MeasureInfo } from './types'

/** Bar length in quarter notes (6/8 → 3, 2/2 → 4). */
export function barQuarters(m: MeasureInfo): number {
  return (m.beatsPerBar * 4) / (m.beatUnit || 4)
}

export function timeSigLabel(m: MeasureInfo): string {
  return `${m.beatsPerBar}/${m.beatUnit || 4}`
}

/** A first bar shorter than the second is a pickup (anacrusis). */
export function hasPickup(measures: MeasureInfo[]): boolean {
  return (
    measures.length >= 2 &&
    barQuarters(measures[0]!) < barQuarters(measures[1]!) - 1e-6
  )
}

/**
 * Time signature to print at the start of `bar`, or null. Printed at bar 1 and
 * wherever the meter changes. After a pickup, bar 1 shows the real meter and
 * bar 2 shows nothing (MIDI files encode a pickup as a short first bar).
 */
export function timeSigToDraw(
  measures: MeasureInfo[],
  bar: number,
): string | null {
  const pickup = hasPickup(measures)
  if (bar <= 1) {
    return timeSigLabel(pickup ? measures[1]! : measureInfoAt(measures, 1))
  }
  if (bar === 2 && pickup) return null
  const prev = timeSigLabel(measureInfoAt(measures, bar - 1))
  const cur = timeSigLabel(measureInfoAt(measures, bar))
  return prev === cur ? null : cur
}
