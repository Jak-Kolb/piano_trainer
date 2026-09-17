import { useCallback, useEffect, useRef, useState } from 'react'
import type { InputSource } from '../input'
import { DrillFrame } from './DrillFrame'

/** One bar of 4/4 at 60 BPM (1000 ms/beat): quarters + one eighth. */
const PATTERN = [0, 1000, 1500, 2000, 3000]
const LABELS = ['1', '&', '2', '3', '4']

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
  const [streak, setStreak] = useState(0)
  const startRef = useRef(0)
  const runningRef = useRef(false)
  const lastMidiTap = useRef(0)

  const finish = useCallback((next: number[]) => {
    setRunning(false)
    runningRef.current = false
    const errs = PATTERN.map((p, i) => Math.abs((next[i] ?? 0) - p))
    const avg = Math.round(errs.reduce((a, b) => a + b, 0) / errs.length)
    setResult(`Avg drift ${avg} ms`)
    setStreak((s) => (avg <= 80 ? s + 1 : 0))
  }, [])

  const tap = useCallback(() => {
    if (!runningRef.current) return
    const t = performance.now() - startRef.current
    setTaps((prev) => {
      const next = [...prev, t]
      if (next.length >= PATTERN.length) finish(next)
      return next
    })
  }, [finish])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        tap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tap])

  useEffect(() => {
    if (input.id !== 'midi') return
    return input.onChange(() => {
      if (!runningRef.current) return
      if (input.getHeldPitchClasses().length === 0) return
      const now = performance.now()
      // Debounce MIDI note-on chatter
      if (now - lastMidiTap.current < 80) return
      lastMidiTap.current = now
      tap()
    })
  }, [input, tap])

  const start = () => {
    setResult(null)
    setTaps([])
    setRunning(true)
    runningRef.current = true
    startRef.current = performance.now()
  }

  return (
    <DrillFrame
      status={input.getStatus()}
      streak={streak}
      onExit={onExit}
      footer={
        <button
          type="button"
          className="btn btn-primary min-h-16 flex-1 text-lg"
          onClick={running ? tap : start}
        >
          {running ? 'Tap' : 'Start bar'}
        </button>
      }
    >
      <p className="font-display text-4xl text-ivory">Rhythm</p>
      <p className="mt-2 font-ui text-dust">
        60 BPM · space, tap, or any MIDI key
      </p>
      <p className="mt-2 font-ui text-sm text-dust">
        Pattern: 1 · &amp; · 2 · 3 · 4 (quarter, eighth, quarters)
      </p>
      <div className="mt-10 flex gap-3">
        {PATTERN.map((p, i) => (
          <div key={p} className="flex flex-col items-center gap-2">
            <div
              className={`h-24 w-16 ${
                taps.length > i ? 'rounded-[var(--radius-sm)] bg-brass' : 'surface-panel'
              }`}
            />
            <span className="font-ui text-sm text-dust">{LABELS[i]}</span>
          </div>
        ))}
      </div>
      {result && (
        <p className="mt-8 font-display text-2xl text-ivory">{result}</p>
      )}
      {result && (
        <p className="mt-2 font-ui text-sm text-dust">
          ≤80 ms avg keeps the streak
        </p>
      )}
    </DrillFrame>
  )
}
