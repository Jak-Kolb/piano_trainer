import { Midi } from '@tonejs/midi'
import type { ParsedPiece, PieceNote } from './types'

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
      })
    }
  })

  notes.sort((a, b) => a.time - b.time || a.midi - b.midi)

  const durationSec =
    notes.reduce((m, n) => Math.max(m, n.time + n.duration), 0) || midi.duration

  const measureCount = Math.max(
    1,
    ...notes.map((n) => n.measure),
    Math.ceil(durationSec / (secPerQuarter * beatsPerBar)),
  )

  const activeTracks = new Set(notes.map((n) => n.track))
  const hasTwoHands = activeTracks.size >= 2

  return {
    notes,
    durationSec,
    measureCount,
    hasTwoHands,
    ppq: midi.header.ppq,
    secPerQuarter,
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
