import type { PieceNote } from './types'

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
}

export function barStartSec(
  measure: number,
  secPerQuarter: number,
  beatsPerBar = 4,
): number {
  return (Math.max(1, measure) - 1) * beatsPerBar * secPerQuarter
}

/**
 * Split sustained MIDI notes at barlines (and mid-bar in 4/4) so the sheet
 * can draw ties instead of one blob that crosses the structure.
 */
export function sliceNotesForTies(
  notes: PieceNote[],
  secPerQuarter: number,
  beatsPerBar = 4,
): NoteSlice[] {
  const barSec = beatsPerBar * secPerQuarter
  const midSec = (beatsPerBar / 2) * secPerQuarter
  const out: NoteSlice[] = []

  for (const n of notes) {
    const id = `${n.track}:${n.midi}:${n.time.toFixed(4)}`
    const end = n.time + n.duration
    let t = n.time
    let measure = n.measure

    while (t < end - 0.02) {
      const start = barStartSec(measure, secPerQuarter, beatsPerBar)
      const mid = start + midSec
      const nextBar = start + barSec
      // Next structural split after t (mid-bar or barline)
      let cut = nextBar
      if (t < mid - 0.01 && end > mid + 0.01) cut = mid
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
