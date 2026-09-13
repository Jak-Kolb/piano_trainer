import { useEffect, useRef, useState } from 'react'
import type { InputSource } from '../input'
import { DrillFrame } from './DrillFrame'

/** One bar of 4/4: beat positions in ms from bar start at 60bpm = 1000ms/beat */
const PATTERN = [0, 1000, 1500, 2000, 3000] // quarters + one eighth

export function RhythmDrill({
  input,
  onExit,
}: {
  input: InputSource
  onExit: () => void
}) {
  const [running, setRunning] = useState(false)
  const [taps, setTaps] = useState<number[]>([])
  const [result, setResult] = useState<string | null>(null)
  const startRef = useRef(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        tap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const tap = () => {
    if (!running) return
    const t = performance.now() - startRef.current
    setTaps((prev) => {
      const next = [...prev, t]
      if (next.length >= PATTERN.length) {
        setRunning(false)
        const errs = PATTERN.map((p, i) => Math.abs((next[i] ?? 0) - p))
        const avg = Math.round(errs.reduce((a, b) => a + b, 0) / errs.length)
        setResult(`Avg drift ${avg} ms`)
      }
      return next
    })
  }

  useEffect(() => {
    if (input.id !== 'midi') return
    return input.onChange(() => {
      if (input.getHeldPitchClasses().length > 0) tap()
    })
  })

  const start = () => {
    setResult(null)
    setTaps([])
    setRunning(true)
    startRef.current = performance.now()
  }

  return (
    <DrillFrame
      status={input.getStatus()}
      onExit={onExit}
      footer={
        <button
          type="button"
          className="min-h-16 flex-1 bg-brass font-ui text-lg text-ink"
          onClick={running ? tap : start}
        >
          {running ? 'Tap' : 'Start bar'}
        </button>
      }
    >
      <p className="font-display text-4xl text-ivory">Rhythm</p>
      <p className="mt-2 font-ui text-dust">60 BPM · space, tap, or any MIDI key</p>
      <div className="mt-10 flex gap-3">
        {PATTERN.map((p, i) => (
          <div
            key={p}
            className={`h-24 w-16 ${
              taps.length > i ? 'bg-brass' : 'bg-shadow'
            }`}
          />
        ))}
      </div>
      {result && <p className="mt-8 font-display text-2xl text-ivory">{result}</p>}
    </DrillFrame>
  )
}
