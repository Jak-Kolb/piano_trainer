import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [nowSec, setNowSec] = useState(notes[0]?.time ?? 0)
  const ctxRef = useRef<AudioContext | null>(null)
  const startWall = useRef(0)
  const origin = useRef(0)
  const scheduled = useRef<OscillatorNode[]>([])

  const tempoFactor = controls.tempoPercent / 100

  const stopAll = () => {
    for (const o of scheduled.current) {
      try {
        o.stop()
      } catch {
        /* ignore */
      }
    }
    scheduled.current = []
  }

  useEffect(() => () => stopAll(), [])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      const elapsed =
        ((performance.now() - startWall.current) / 1000) * tempoFactor
      const t = origin.current + elapsed
      setNowSec(t)
      const end =
        (notes[notes.length - 1]?.time ?? 0) +
        (notes[notes.length - 1]?.duration ?? 0)
      if (t >= end) {
        setPlaying(false)
        stopAll()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, notes, tempoFactor])

  const play = async () => {
    stopAll()
    const ctx = ctxRef.current ?? new AudioContext()
    ctxRef.current = ctx
    await ctx.resume()
    origin.current = notes[0]?.time ?? 0
    startWall.current = performance.now()
    setNowSec(origin.current)
    setPlaying(true)

    for (const n of notes) {
      const when =
        ctx.currentTime +
        (n.time - origin.current) / tempoFactor
      const dur = n.duration / tempoFactor
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = 440 * 2 ** ((n.midi - 69) / 12)
      g.gain.value = 0.04
      osc.connect(g)
      g.connect(ctx.destination)
      osc.start(when)
      osc.stop(when + Math.max(0.05, dur))
      scheduled.current.push(osc)
    }
  }

  return (
    <div className="flex h-full flex-col bg-ink">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => {
            stopAll()
            setPlaying(false)
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
          className="min-h-16 bg-brass font-ui text-lg text-ink"
          onClick={() => {
            if (playing) {
              stopAll()
              setPlaying(false)
            } else void play()
          }}
        >
          {playing ? 'Stop' : 'Play'}
        </button>
      </div>
    </div>
  )
}
