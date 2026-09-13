import { useRef, useState } from 'react'
import type { InputSource } from '../input'
import { loadProgress, markPracticeToday, saveProgress } from '../storage/progress'
import { DrillFrame } from './DrillFrame'

const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const

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
  const [beatsLost, setBeatsLost] = useState(0)
  const timerRef = useRef<number | null>(null)

  const startPreview = () => {
    setPhase('preview')
    setPreviewLeft(30)
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      setPreviewLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current)
          setPhase('run')
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  const finish = (lost: number) => {
    setBeatsLost(lost)
    setPhase('done')
    const p = markPracticeToday(loadProgress())
    p.sightReadingCount += 1
    saveProgress(p)
  }

  if (phase === 'done') {
    return (
      <DrillFrame status={input.getStatus()} onExit={onExit}>
        <h1 className="font-display text-4xl text-ivory">Run complete</h1>
        <p className="mt-4 font-ui text-dust">Beats lost: {beatsLost}</p>
        <p className="mt-2 font-ui text-dust">No replay — next exercise is new.</p>
        <button
          type="button"
          className="mt-8 min-h-16 bg-brass px-8 font-ui text-lg text-ink"
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
          : 'Play through — no pause'
      }
      onExit={onExit}
      footer={
        phase === 'run' ? (
          <>
            <button
              type="button"
              className="min-h-16 flex-1 bg-brass font-ui text-lg text-ink"
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
            className="min-h-16 flex-1 bg-shadow font-ui text-lg text-ivory"
            onClick={startPreview}
          >
            {previewLeft === 30 && phase === 'preview' ? 'Start preview' : '…'}
          </button>
        )
      }
    >
      <p className="mb-4 font-ui text-dust">Level 1 · RH · C position</p>
      <div className="flex flex-wrap justify-center gap-3">
        {notes.map((n, i) => (
          <span
            key={`${n}-${i}`}
            className="flex h-20 w-16 items-center justify-center bg-shadow font-display text-3xl text-ivory"
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
