import { Midi } from '@tonejs/midi'
import type { ParsedPiece, PieceNote } from './types'

export async function parseMidiArrayBuffer(buf: ArrayBuffer): Promise<ParsedPiece> {
  const midi = new Midi(buf)
  const secPerQuarter =
    midi.header.tempos.length > 0
      ? 60 / (midi.header.tempos[0]!.bpm || 120)
      : 0.5

  const notes: PieceNote[] = []
  midi.tracks.forEach((track, trackIndex) => {
    for (const n of track.notes) {
      const measure = Math.max(1, Math.floor(n.time / (secPerQuarter * 4)) + 1)
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
    Math.ceil(durationSec / (secPerQuarter * 4)),
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
  const tracks = [...new Set(inLoop.map((n) => n.track))].sort((a, b) => a - b)
  if (tracks.length < 2) return inLoop
  // Convention: first track RH, last track LH (common in simple piano MIDIs)
  const rh = tracks[0]!
  const lh = tracks[tracks.length - 1]!
  return inLoop.filter((n) => (hands === 'right' ? n.track === rh : n.track === lh))
}

/** Group notes that start within a small window into a chord step. */
export function groupSteps(
  notes: PieceNote[],
  windowSec = 0.05,
): PieceNote[][] {
  if (!notes.length) return []
  const steps: PieceNote[][] = []
  let current: PieceNote[] = [notes[0]!]
  let anchor = notes[0]!.time
  for (let i = 1; i < notes.length; i++) {
    const n = notes[i]!
    if (n.time - anchor <= windowSec) {
      current.push(n)
    } else {
      steps.push(current)
      current = [n]
      anchor = n.time
    }
  }
  steps.push(current)
  return steps
}
