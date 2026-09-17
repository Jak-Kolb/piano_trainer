import { useEffect, useMemo, useRef, useState } from 'react'
import { playPianoNotes, preloadPiano } from './pianoPlayer'
import { filterNotes } from './parseMidi'
import { PianoRoll } from './PianoRoll'
import { PieceControlsBar } from './PieceControlsBar'
import type { ParsedPiece, PieceControls } from './types'

interface Props {
  parsed: ParsedPiece
  controls: PieceControls
  title: string
  onExit: () => void
  onControls: (c: PieceControls) => void
}

export function ListenMode({
  parsed,
  controls,
  title,
  onExit,
  onControls,
}: Props) {
  const notes = useMemo(
    () =>
      filterNotes(
        parsed.notes,
        controls.hands,
        parsed.hasTwoHands,
        controls.loopStartMeasure,
        controls.loopEndMeasure,
      ),
    [parsed, controls],
  )
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [nowSec, setNowSec] = useState(notes[0]?.time ?? 0)
  const stopRef = useRef<(() => void) | null>(null)
  const metaRef = useRef<{
    originSec: number
    endSec: number
    startedAt: number
    tempoFactor: number
  } | null>(null)

  const tempoFactor = Math.max(0.25, controls.tempoPercent / 100)

  useEffect(() => {
    preloadPiano()
  }, [])

  useEffect(() => {
    return () => {
      stopRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (!playing || !metaRef.current) return
    let raf = 0
    const tick = () => {
      const meta = metaRef.current
      if (!meta) return
      const elapsed =
        ((performance.now() - meta.startedAt) / 1000) * meta.tempoFactor
      const t = meta.originSec + elapsed
      setNowSec(t)
      if (t >= meta.endSec) {
        stopRef.current?.()
        stopRef.current = null
        metaRef.current = null
        setPlaying(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const stop = () => {
    stopRef.current?.()
    stopRef.current = null
    metaRef.current = null
    setPlaying(false)
  }

  const play = async () => {
    if (!notes.length) return
    stop()
    setLoading(true)
    try {
      const handle = await playPianoNotes(notes, controls.tempoPercent)
      stopRef.current = handle.stop
      metaRef.current = {
        originSec: handle.originSec,
        endSec: handle.endSec,
        startedAt: handle.startedAt,
        tempoFactor,
      }
      setNowSec(handle.originSec)
      setPlaying(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-ink">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => {
            stop()
            onExit()
          }}
          className="min-h-12 px-3 font-ui text-dust"
        >
          Exit
        </button>
        <p className="font-display text-lg text-ivory">{title}</p>
        <span />
      </div>
      <PieceControlsBar
        controls={controls}
        measureCount={parsed.measureCount}
        hasTwoHands={parsed.hasTwoHands}
        onChange={onControls}
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <PianoRoll notes={notes} nowSec={nowSec} />
        <button
          type="button"
          disabled={loading}
          className="min-h-16 bg-brass font-ui text-lg text-ink disabled:opacity-50"
          onClick={() => {
            if (playing) stop()
            else void play()
          }}
        >
          {loading ? 'Loading piano…' : playing ? 'Stop' : 'Play'}
        </button>
      </div>
    </div>
  )
}
