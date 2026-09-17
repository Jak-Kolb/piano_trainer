import { useMemo } from 'react'
import type { PieceNote } from './types'

const NOTE_H = 6
const MIN_MIDI = 21
const MAX_MIDI = 108

interface Props {
  notes: PieceNote[]
  nowSec: number
  windowSec?: number
  flashMiss?: boolean
}

export function PianoRoll({
  notes,
  nowSec,
  windowSec = 8,
  flashMiss = false,
}: Props) {
  const { minMidi, maxMidi } = useMemo(() => {
    if (!notes.length) return { minMidi: 48, maxMidi: 72 }
    let lo = 127
    let hi = 0
    for (const n of notes) {
      lo = Math.min(lo, n.midi)
      hi = Math.max(hi, n.midi)
    }
    return {
      minMidi: Math.max(MIN_MIDI, lo - 2),
      maxMidi: Math.min(MAX_MIDI, hi + 2),
    }
  }, [notes])

  const range = maxMidi - minMidi + 1
  const height = range * NOTE_H
  const start = Math.max(0, nowSec - 1)
  const end = nowSec + windowSec

  const visible = notes.filter(
    (n) => n.time + n.duration >= start && n.time <= end,
  )

  return (
    <div
      className={`relative w-full overflow-hidden border border-dust/30 ${
        flashMiss ? 'bg-felt/40' : 'bg-shadow'
      }`}
      style={{ height: Math.max(180, Math.min(360, height)) }}
    >
      {/* now line */}
      <div
        className="absolute top-0 bottom-0 z-20 w-0.5 bg-brass"
        style={{ left: '12.5%' }}
      />
      {visible.map((n, i) => {
        const leftPct =
          ((n.time - start) / (end - start)) * 100
        const widthPct = Math.max(
          0.8,
          (n.duration / (end - start)) * 100,
        )
        const top = (maxMidi - n.midi) * NOTE_H
        const atNow =
          n.time <= nowSec + 0.05 && n.time + n.duration >= nowSec - 0.02
        return (
          <div
            key={`${n.time}-${n.midi}-${i}`}
            className={`absolute rounded-sm ${
              atNow ? 'bg-brass' : 'bg-ivory/70'
            }`}
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              top,
              height: NOTE_H - 1,
            }}
          />
        )
      })}
    </div>
  )
}
