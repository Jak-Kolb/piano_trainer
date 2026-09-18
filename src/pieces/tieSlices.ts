import type { MeasureInfo, PieceNote } from './types'

export interface NoteSlice {
  /** Stable id for the underlying MIDI note (for tie pairing). */
  id: string
  midi: number
  track: number
  measure: number
  /** Absolute start time of this visual slice */
  time: number
  duration: number
  tieFromPrev: boolean
  tieToNext: boolean
  /** Original MIDI note onset (for active-step matching). */
  sourceTime: number
  velocity: number
}

/** Uniform timeline helper for tests / fallbacks (constant tempo + meter). */
export function uniformMeasures(
  count: number,
  secPerQuarter: number,
  beatsPerBar = 4,
): MeasureInfo[] {
  const barSec = Math.max(0.01, beatsPerBar * secPerQuarter)
  return Array.from({ length: Math.max(1, count) }, (_, i) => ({
    startSec: i * barSec,
    durationSec: barSec,
    beatsPerBar,
  }))
}

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
    }
  }
  return { startSec: idx * 2, durationSec: 2, beatsPerBar: 4 }
}

/** @deprecated Prefer measureInfoAt(measures, m).startSec — constant-tempo only. */
export function barStartSec(
  measure: number,
  secPerQuarter: number,
  beatsPerBar = 4,
): number {
  return (Math.max(1, measure) - 1) * beatsPerBar * secPerQuarter
}

/**
 * Split sustained MIDI notes only at real barlines from the measure timeline
 * so the sheet can draw ties across measures. Do not cut mid-bar — a ~full-bar
 * sustain should stay one slice (whole note), even in even meters.
 */
export function sliceNotesForTies(
  notes: PieceNote[],
  measures: MeasureInfo[],
): NoteSlice[] {
  const out: NoteSlice[] = []

  for (const n of notes) {
    const id = `${n.track}:${n.midi}:${n.time.toFixed(4)}`
    const end = n.time + n.duration
    let t = n.time
    let measure = n.measure

    while (t < end - 0.02) {
      const info = measureInfoAt(measures, measure)
      const start = info.startSec
      const nextBar = start + info.durationSec
      // Only structural split is the next barline.
      const cut = nextBar
      const sliceEnd = Math.min(end, cut)
      const dur = sliceEnd - t
      if (dur > 0.02) {
        out.push({
          id,
          midi: n.midi,
          track: n.track,
          measure,
          time: t,
          duration: dur,
          tieFromPrev: t > n.time + 0.02,
          tieToNext: sliceEnd < end - 0.02,
          sourceTime: n.time,
          velocity: n.velocity,
        })
      }
      t = sliceEnd
      if (t >= nextBar - 0.01) measure += 1
    }
  }

  return out
}

export function slicesInMeasure(
  slices: NoteSlice[],
  measure: number,
): NoteSlice[] {
  return slices.filter((s) => s.measure === measure)
}
