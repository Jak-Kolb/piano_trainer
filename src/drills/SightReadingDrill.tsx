import { useEffect, useMemo, useRef, useState } from 'react'
import type { InputSource } from '../input'
import { PianoBar } from '../pieces/PianoBar'
import {
  loadProgress,
  markPracticeToday,
  saveProgress,
} from '../storage/progress'
import { DrillFrame } from './DrillFrame'
import { drillActiveKeys } from './drillMidi'

const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
/** C position RH midis (C4–B4). */
const STEP_MIDI: Record<(typeof STEPS)[number], number> = {
  C: 60,
  D: 62,
  E: 64,
  F: 65,
  G: 67,
  A: 69,
  B: 71,
}

function hashBars(notes: string[]): string {
  return notes.join('|')
}

function generateLevel1(seen: Set<string>): string[] {
  for (let attempt = 0; attempt < 50; attempt++) {
    const notes: string[] = []
    let deg = 0
    for (let i = 0; i < 8; i++) {
      const delta = [-1, 0, 0, 1, 1][Math.floor(Math.random() * 5)]!
      deg = Math.max(0, Math.min(4, deg + delta))
      notes.push(STEPS[deg]!)
    }
    notes[notes.length - 1] = 'C'
    const h = hashBars(notes)
    if (!seen.has(h)) {
      seen.add(h)
      return notes
    }
  }
  return ['C', 'D', 'E', 'F', 'G', 'F', 'E', 'C']
}

export function SightReadingDrill({
  input,
  onExit,
}: {
  input: InputSource
  onExit: () => void
}) {
  const seen = useRef(new Set<string>())
  const [phase, setPhase] = useState<'preview' | 'run' | 'done'>('preview')
  const [previewLeft, setPreviewLeft] = useState(30)
  const [notes, setNotes] = useState(() => generateLevel1(seen.current))
  const [step, setStep] = useState(0)
  const [beatsLost, setBeatsLost] = useState(0)
  const [heldMidi, setHeldMidi] = useState<number[]>([])
  const timerRef = useRef<number | null>(null)
  const advanced = useRef(false)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const stepRef = useRef(step)
  stepRef.current = step
  const notesRef = useRef(notes)
  notesRef.current = notes

  const midis = useMemo(
    () => notes.map((n) => STEP_MIDI[n as (typeof STEPS)[number]] ?? 60),
    [notes],
  )
  const currentMidi = phase === 'run' ? midis[step] : undefined

  const activeKeys = useMemo(() => {
    const targets = currentMidi != null ? [currentMidi] : midis
    return drillActiveKeys(heldMidi, phase === 'preview' ? midis : targets, 'right')
  }, [heldMidi, midis, currentMidi, phase])

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const startPreview = () => {
    setPhase('preview')
    setPreviewLeft(30)
    setStep(0)
    advanced.current = false
    clearTimer()
    timerRef.current = window.setInterval(() => {
      setPreviewLeft((t) => {
        if (t <= 1) {
          clearTimer()
          setPhase('run')
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  const finish = (lost: number) => {
    clearTimer()
    setBeatsLost(lost)
    setPhase('done')
    const p = markPracticeToday(loadProgress())
    p.sightReadingCount += 1
    saveProgress(p)
  }

  useEffect(() => () => clearTimer(), [])

  useEffect(() => {
    advanced.current = false
  }, [step])

  useEffect(() => {
    return input.onChange(() => {
      const held = input.getHeldMidiNotes()
      setHeldMidi(held)
      if (phaseRef.current !== 'run') return
      if (advanced.current) return
      if (input.id !== 'midi') return
      const want = midis[stepRef.current]
      if (want == null) return
      if (!held.includes(want)) return
      advanced.current = true
      if (stepRef.current >= notesRef.current.length - 1) {
        finish(0)
      } else {
        setStep((s) => s + 1)
      }
    })
  }, [input, midis])

  if (phase === 'done') {
    return (
      <DrillFrame status={input.getStatus()} onExit={onExit}>
        <h1 className="font-display text-4xl text-ivory">Run complete</h1>
        <p className="mt-4 font-ui text-dust">Beats lost: {beatsLost}</p>
        <p className="mt-2 font-ui text-dust">No replay — next exercise is new.</p>
        <button
          type="button"
          className="mt-8 btn btn-primary min-h-16 px-8 text-lg"
          onClick={() => {
            setNotes(generateLevel1(seen.current))
            setBeatsLost(0)
            startPreview()
          }}
        >
          Next exercise
        </button>
      </DrillFrame>
    )
  }

  return (
    <DrillFrame
      status={
        phase === 'preview'
          ? `Preview ${previewLeft}s`
          : `Note ${step + 1}/${notes.length} · no pause`
      }
      round={phase === 'run' ? `${step + 1} / ${notes.length}` : undefined}
      onExit={onExit}
      keyboard={
        <PianoBar activeKeys={activeKeys} lowMidi={48} highMidi={84} />
      }
      footer={
        phase === 'run' ? (
          <>
            <button
              type="button"
              className="btn btn-primary min-h-16 flex-1 text-lg"
              onClick={() => finish(0)}
            >
              Finished clean
            </button>
            <button
              type="button"
              className="min-h-16 flex-1 bg-felt font-ui text-lg text-ivory"
              onClick={() => finish(2)}
            >
              Had stalls
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-secondary min-h-16 flex-1 text-lg"
            onClick={startPreview}
          >
            {previewLeft === 30 && phase === 'preview'
              ? 'Start preview'
              : 'Preview running…'}
          </button>
        )
      }
    >
      <p className="mb-4 font-ui text-dust">
        Level 1 · RH · C position · MIDI advances note-by-note (octave-exact)
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {notes.map((n, i) => (
          <span
            key={`${n}-${i}`}
            className={`flex h-24 w-20 items-center justify-center font-display text-4xl ${
              phase === 'run' && i === step
                ? 'bg-brass text-on-accent'
                : phase === 'run' && i < step
                  ? 'bg-brass/40 text-ivory'
                  : 'bg-shadow text-ivory'
            }`}
          >
            {n}
          </span>
        ))}
      </div>
      {phase === 'preview' && previewLeft < 30 && (
        <p className="mt-6 font-display text-5xl text-brass">{previewLeft}</p>
      )}
    </DrillFrame>
  )
}
