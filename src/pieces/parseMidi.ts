import { Midi } from '@tonejs/midi'
import type { MeasureInfo, ParsedPiece, PieceNote } from './types'

type MidiHeader = Midi['header']

/**
 * Smallest tick where ticksToMeasures(tick) >= barIndex (Tone 0-based bars).
 */
function barStartTick(
  header: MidiHeader,
  barIndex: number,
  maxTickHint: number,
): number {
  if (barIndex <= 0) return 0
  let hi = Math.max(maxTickHint, header.ppq * 4)
  // Grow until the tick is past the target bar.
  while (header.ticksToMeasures(hi) < barIndex && hi < 1e12) {
    hi = Math.max(hi * 2, hi + header.ppq * 64)
  }
  let lo = 0
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (header.ticksToMeasures(mid) >= barIndex) hi = mid
    else lo = mid + 1
  }
  return lo
}

function beatsPerBarAtTick(header: MidiHeader, tick: number): number {
  const tss = header.timeSignatures
  if (!tss.length) return 4
  let beats = tss[0]!.timeSignature[0] || 4
  for (const ts of tss) {
    if (ts.ticks <= tick) beats = ts.timeSignature[0] || 4
    else break
  }
  return Math.max(1, beats)
}

/**
 * Build one MeasureInfo per displayed measure (index 0 = measure 1).
 * Uses Tone's ticksToMeasures / ticksToSeconds so tempo and meter changes
 * produce real wall-clock bar starts (not first-tempo * constant meter).
 */
export function buildMeasureTimeline(
  header: MidiHeader,
  measureCount: number,
  durationSec: number,
): MeasureInfo[] {
  const count = Math.max(1, measureCount)
  const maxTickHint = Math.max(
    header.ppq * 4,
    header.secondsToTicks(Math.max(durationSec, 0.01)) + header.ppq * 16,
  )
  const starts: number[] = []
  for (let b = 0; b <= count; b++) {
    starts.push(barStartTick(header, b, maxTickHint))
  }
  const measures: MeasureInfo[] = []
  for (let i = 0; i < count; i++) {
    const startTick = starts[i]!
    const endTick = starts[i + 1]!
    const startSec = header.ticksToSeconds(startTick)
    let endSec = header.ticksToSeconds(endTick)
    // Last bar: if next-bar search collapsed (identical tick), fall back to piece end.
    if (endSec <= startSec + 1e-6) {
      endSec = Math.max(durationSec, startSec + 0.01)
    }
    measures.push({
      startSec,
      durationSec: Math.max(0.01, endSec - startSec),
      beatsPerBar: beatsPerBarAtTick(header, startTick),
    })
  }
  return measures
}

export async function parseMidiArrayBuffer(buf: ArrayBuffer): Promise<ParsedPiece> {
  const midi = new Midi(buf)
  const secPerQuarter =
    midi.header.tempos.length > 0
      ? 60 / (midi.header.tempos[0]!.bpm || 120)
      : 0.5

  const ts = midi.header.timeSignatures[0]
  const beatsPerBar = ts ? ts.timeSignature[0] || 4 : 4

  const notes: PieceNote[] = []
  midi.tracks.forEach((track, trackIndex) => {
    for (const n of track.notes) {
      // Prefer Tone's bar position when present; else derive from time
      const barFloat =
        typeof (n as { bars?: number }).bars === 'number'
          ? (n as { bars: number }).bars
          : n.time / (secPerQuarter * beatsPerBar)
      const measure = Math.max(1, Math.floor(barFloat) + 1)
      notes.push({
        midi: n.midi,
        time: n.time,
        duration: Math.max(0.05, n.duration),
        track: trackIndex,
        measure,
        velocity: typeof n.velocity === 'number' ? n.velocity : 0.7,
      })
    }
  })

  notes.sort((a, b) => a.time - b.time || a.midi - b.midi)

  const durationSec =
    notes.reduce((m, n) => Math.max(m, n.time + n.duration), 0) || midi.duration

  // Prefer Tone bar indices over first-tempo * first-meter estimates.
  let maxToneBar = 0
  for (const n of notes) {
    maxToneBar = Math.max(maxToneBar, n.measure)
  }
  // Include bars covered by note sustains (end of last sounding note).
  if (durationSec > 0) {
    const endBars = midi.header.ticksToMeasures(
      midi.header.secondsToTicks(durationSec),
    )
    maxToneBar = Math.max(maxToneBar, Math.ceil(endBars))
  }
  const measureCount = Math.max(1, maxToneBar)

  const measures = buildMeasureTimeline(midi.header, measureCount, durationSec)

  const activeTracks = new Set(notes.map((n) => n.track))
  const hasTwoHands = activeTracks.size >= 2

  const ks = midi.header.keySignatures[0]
  let keySignature = 'C'
  if (ks) {
    // Tone: key is major tonic (e.g. "G"); scale is "major" | "minor"
    keySignature =
      ks.scale === 'minor'
        ? ks.key.endsWith('m')
          ? ks.key
          : `${ks.key}m`
        : ks.key
  } else {
    // No key meta — light heuristic so G-major songs don't stamp # on every F
    const fSharp = notes.filter((n) => ((n.midi % 12) + 12) % 12 === 6).length
    const fNat = notes.filter((n) => ((n.midi % 12) + 12) % 12 === 5).length
    if (fSharp > 8 && fSharp > fNat * 3) keySignature = 'G'
  }

  return {
    notes,
    durationSec,
    measureCount,
    hasTwoHands,
    ppq: midi.header.ppq,
    secPerQuarter,
    keySignature,
    beatsPerBar,
    measures,
  }
}


/** Map two busiest tracks to RH/LH by mean pitch (higher = right hand). */
export function resolveHands(
  notes: PieceNote[],
): { rh: number; lh: number } | null {
  const counts = new Map<number, { sum: number; n: number }>()
  for (const note of notes) {
    const c = counts.get(note.track) ?? { sum: 0, n: 0 }
    c.sum += note.midi
    c.n += 1
    counts.set(note.track, c)
  }
  const ranked = [...counts.entries()]
    .map(([track, c]) => ({ track, mean: c.sum / c.n, n: c.n }))
    .sort((a, b) => b.n - a.n)
  if (ranked.length < 2) return null
  const top = ranked.slice(0, 2)
  top.sort((a, b) => b.mean - a.mean)
  return { rh: top[0]!.track, lh: top[1]!.track }
}

export function filterNotes(
  notes: PieceNote[],
  hands: 'both' | 'right' | 'left',
  hasTwoHands: boolean,
  loopStart: number,
  loopEnd: number,
): PieceNote[] {
  const inLoop = notes.filter(
    (n) => n.measure >= loopStart && n.measure <= loopEnd,
  )
  if (!hasTwoHands || hands === 'both') return inLoop
  const pair = resolveHands(inLoop)
  if (!pair) return inLoop
  return inLoop.filter((n) =>
    hands === 'right' ? n.track === pair.rh : n.track === pair.lh,
  )
}

/**
 * Group notes that start together into one step (chords / both hands).
 */
export function groupSteps(
  notes: PieceNote[],
  windowSec = 0.12,
): PieceNote[][] {
  if (!notes.length) return []
  const sorted = [...notes].sort((a, b) => a.time - b.time || a.midi - b.midi)
  const steps: PieceNote[][] = []
  let current: PieceNote[] = [sorted[0]!]
  let anchor = sorted[0]!.time
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i]!
    if (n.time - anchor <= windowSec) {
      current.push(n)
    } else {
      steps.push(dedupeMidi(current))
      current = [n]
      anchor = n.time
    }
  }
  steps.push(dedupeMidi(current))
  return steps
}

function dedupeMidi(group: PieceNote[]): PieceNote[] {
  const seen = new Set<number>()
  const out: PieceNote[] = []
  for (const n of group) {
    if (seen.has(n.midi)) continue
    seen.add(n.midi)
    out.push(n)
  }
  return out
}

export function chordWindowSec(secPerQuarter: number): number {
  return Math.max(0.12, secPerQuarter * 0.2)
}
