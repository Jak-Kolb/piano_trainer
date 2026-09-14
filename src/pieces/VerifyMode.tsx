import { useEffect, useMemo, useRef, useState } from 'react'
import type { InputSource } from '../input'
import { midiSetMatch } from './noteMatch'
import { filterNotes, groupSteps } from './parseMidi'
import { PianoRoll } from './PianoRoll'
import { PieceControlsBar } from './PieceControlsBar'
import type { ParsedPiece, PieceControls } from './types'

interface Miss {
  stepIndex: number
  measure: number
  time: number
}

interface Props {
  parsed: ParsedPiece
  controls: PieceControls
  input: InputSource
  title: string
  onExit: () => void
  onControls: (c: PieceControls) => void
}

export function VerifyMode({
  parsed,
  controls,
  input,
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
  const steps = useMemo(() => groupSteps(notes), [notes])
  const [running, setRunning] = useState(false)
  const [nowSec, setNowSec] = useState(notes[0]?.time ?? 0)
  const [flashMiss, setFlashMiss] = useState(false)
  const [misses, setMisses] = useState<Miss[]>([])
  const [hits, setHits] = useState(0)
  const [done, setDone] = useState(false)
  const startWall = useRef(0)
  const originSec = useRef(0)
  const judged = useRef(new Set<number>())
  const heldRef = useRef<number[]>([])

  const tempoFactor = controls.tempoPercent / 100

  useEffect(() => {
    return input.onChange(() => {
      heldRef.current = input.getHeldMidiNotes()
    })
  }, [input])

  useEffect(() => {
    if (!running || done) return
    let raf = 0
    const tick = () => {
      const elapsed = ((performance.now() - startWall.current) / 1000) * tempoFactor
      const t = originSec.current + elapsed
      setNowSec(t)

      const hitWindow = 0.18 / Math.max(0.4, tempoFactor)
      steps.forEach((step, idx) => {
        if (judged.current.has(idx)) return
        const at = step[0]!.time
        if (t < at - hitWindow) return
        if (t > at + hitWindow) {
          judged.current.add(idx)
          setMisses((m) => [
            ...m,
            { stepIndex: idx, measure: step[0]!.measure, time: at },
          ])
          setFlashMiss(true)
          globalThis.setTimeout(() => setFlashMiss(false), 120)
          return
        }
        // inside window — check held notes
        if (
          input.id === 'midi' &&
          midiSetMatch(heldRef.current, step, true)
        ) {
          judged.current.add(idx)
          setHits((h) => h + 1)
        }
      })

      const end =
        (notes[notes.length - 1]?.time ?? 0) +
        (notes[notes.length - 1]?.duration ?? 0) +
        0.3
      if (t >= end) {
        setRunning(false)
        setDone(true)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, done, steps, notes, tempoFactor, input.id])

  const start = () => {
    judged.current = new Set()
    setMisses([])
    setHits(0)
    setDone(false)
    originSec.current = notes[0]?.time ?? 0
    startWall.current = performance.now()
    setNowSec(originSec.current)
    setRunning(true)
  }

  const jumpToMiss = (m: Miss) => {
    onControls({
      ...controls,
      loopStartMeasure: m.measure,
      loopEndMeasure: m.measure,
    })
    onExit()
  }

  if (done) {
    const total = steps.length || 1
    const pct = Math.round((hits / total) * 100)
    return (
      <div className="flex h-full flex-col bg-ink">
        <div className="flex items-center px-4 py-3">
          <button
            type="button"
            onClick={onExit}
            className="min-h-12 px-3 font-ui text-dust"
          >
            Exit
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto px-6 py-8">
          <h1 className="font-display text-4xl text-ivory">Verify done</h1>
          <p className="font-ui text-dust">
            {hits}/{steps.length} hits · {pct}% · {misses.length} misses
          </p>
          <ul className="mt-4 w-full max-w-md space-y-2">
            {misses.length === 0 && (
              <li className="font-ui text-brass">Clean run</li>
            )}
            {misses.map((m) => (
              <li key={`${m.stepIndex}-${m.time}`}>
                <button
                  type="button"
                  className="min-h-14 w-full bg-shadow px-4 text-left font-ui text-ivory"
                  onClick={() => jumpToMiss(m)}
                >
                  Miss · bar {m.measure} — practice this bar
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-6 min-h-16 bg-brass px-8 font-ui text-ink"
            onClick={start}
          >
            Run again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-ink">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onExit}
          className="min-h-12 px-3 font-ui text-dust"
        >
          Exit
        </button>
        <p className="font-display text-lg text-ivory">{title}</p>
        <p className="font-ui text-xs text-dust">{input.getStatus()}</p>
      </div>
      <PieceControlsBar
        controls={controls}
        measureCount={parsed.measureCount}
        hasTwoHands={parsed.hasTwoHands}
        onChange={onControls}
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <PianoRoll notes={notes} nowSec={nowSec} flashMiss={flashMiss} />
        <p className="text-center font-ui text-dust">
          {running
            ? `Hits ${hits} · Misses ${misses.length}`
            : input.id === 'midi'
              ? 'Ready — play along when you start'
              : 'Use MIDI input for verify'}
        </p>
        <button
          type="button"
          className="min-h-16 bg-brass font-ui text-lg text-ink"
          onClick={running ? () => setRunning(false) : start}
        >
          {running ? 'Stop' : 'Start verify'}
        </button>
      </div>
    </div>
  )
}
