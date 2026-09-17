/** Pure bar timeline: note onsets → rest gaps in beat units (4/4). */

export type BarEvent =
  | { kind: 'rest'; beats: number }
  | { kind: 'note'; beats: number; onset: number }

/** Plan rests in gaps for a 4/4 bar given note onsets + durations (beats). */
export function planBarEvents(
  notes: { onset: number; beats: number }[],
  barBeats = 4,
): BarEvent[] {
  const sorted = [...notes].sort((a, b) => a.onset - b.onset)
  const out: BarEvent[] = []
  let cursor = 0
  for (const n of sorted) {
    const onset = Math.round(n.onset * 4) / 4
    const gap = onset - cursor
    if (gap >= 0.24) {
      out.push({ kind: 'rest', beats: gap })
      cursor += gap
    }
    const start = Math.max(cursor, Math.min(onset, barBeats))
    let beats = n.beats
    const room = barBeats - start
    if (beats > room && room > 0) beats = room
    out.push({ kind: 'note', beats, onset: start })
    cursor = Math.max(cursor, start + beats)
  }
  if (cursor < barBeats - 0.2) {
    out.push({ kind: 'rest', beats: barBeats - cursor })
  }
  if (!out.length) out.push({ kind: 'rest', beats: barBeats })
  return out
}
