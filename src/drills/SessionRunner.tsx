import { useEffect, useState } from 'react'
import type { InputSource } from '../input'
import { loadProgress, markPracticeToday, saveProgress } from '../storage/progress'
import { DrillFrame } from './DrillFrame'

const BLOCKS = [
  { id: 'warmup', title: 'Warm-up', minutes: 5, blurb: 'Scale + arpeggio + inversions in today’s key' },
  { id: 'reading', title: 'Reading', minutes: 15, blurb: 'Sight-reading + a few minutes of rhythm' },
  { id: 'repertoire', title: 'Repertoire', minutes: 20, blurb: 'Metronome + stopwatch — paper scores' },
] as const

function beep() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.value = 0.08
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.15)
    window.setTimeout(() => void ctx.close(), 300)
  } catch {
    /* ignore */
  }
}

export function SessionRunner({
  input,
  onExit,
  readingOnly = false,
}: {
  input: InputSource
  onExit: () => void
  readingOnly?: boolean
}) {
  const blocks = readingOnly ? [BLOCKS[1]] : [...BLOCKS]
  const [idx, setIdx] = useState(0)
  const [left, setLeft] = useState(blocks[0]!.minutes * 60)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const p = markPracticeToday(loadProgress())
    saveProgress(p)
  }, [])

  useEffect(() => {
    if (done) return
    const id = window.setInterval(() => {
      setLeft((t) => {
        if (t <= 1) {
          beep()
          if (idx >= blocks.length - 1) {
            setDone(true)
            return 0
          }
          setIdx((i) => i + 1)
          return blocks[idx + 1]!.minutes * 60
        }
        return t - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [blocks, done, idx])

  const block = blocks[Math.min(idx, blocks.length - 1)]!
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')

  if (done) {
    return (
      <DrillFrame status={input.getStatus()} onExit={onExit}>
        <h1 className="font-display text-4xl text-ivory">Session complete</h1>
        <button
          type="button"
          className="mt-8 min-h-16 bg-brass px-8 font-ui text-lg text-ink"
          onClick={onExit}
        >
          Done
        </button>
      </DrillFrame>
    )
  }

  return (
    <DrillFrame status={`${block.title} · ${input.getStatus()}`} onExit={onExit}>
      <p className="font-ui text-dust">
        Block {idx + 1}/{blocks.length}
      </p>
      <h1 className="mt-2 font-display text-5xl text-ivory">{block.title}</h1>
      <p className="mt-4 max-w-md text-center font-ui text-dust">{block.blurb}</p>
      <p className="mt-10 font-display text-7xl text-brass">
        {mm}:{ss}
      </p>
    </DrillFrame>
  )
}
