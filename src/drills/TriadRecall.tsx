import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KeyboardDiagram } from '../components/KeyboardDiagram'
import type { InputSource } from '../input'
import {
  DEFAULT_QUALITIES,
  SESSION_LENGTH,
  drawPrompt,
  median,
  type AttemptRecord,
  type TriadPrompt,
} from './triadSession'

type Phase = 'prompt' | 'revealed' | 'done'

interface Props {
  input: InputSource
  onExit: () => void
}

export function TriadRecall({ input, onExit }: Props) {
  const [phase, setPhase] = useState<Phase>('prompt')
  const [draw, setDraw] = useState(0)
  const [prompt, setPrompt] = useState<TriadPrompt>(() =>
    drawPrompt(DEFAULT_QUALITIES, {}),
  )
  const [attempts, setAttempts] = useState<AttemptRecord[]>([])
  const [streak, setStreak] = useState(0)
  const [startedAt, setStartedAt] = useState(() => performance.now())
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null)
  const requeueDelayed = useRef<{ prompt: TriadPrompt; remaining: number }[]>(
    [],
  )

  const medianMsById = useMemo(() => {
    const map: Record<string, number[]> = {}
    for (const a of attempts) {
      ;(map[a.prompt.id] ??= []).push(a.ms)
    }
    const out: Record<string, number> = {}
    for (const [id, times] of Object.entries(map)) out[id] = median(times)
    return out
  }, [attempts])

  const advance = useCallback(
    (missed?: TriadPrompt) => {
      if (missed) {
        requeueDelayed.current.push({ prompt: missed, remaining: 3 })
      }
      requeueDelayed.current = requeueDelayed.current.map((r) => ({
        ...r,
        remaining: r.remaining - 1,
      }))
      const due = requeueDelayed.current.find((r) => r.remaining <= 0)
      requeueDelayed.current = requeueDelayed.current.filter(
        (r) => r.remaining > 0,
      )

      const nextDraw = draw + 1
      if (nextDraw >= SESSION_LENGTH) {
        setDraw(nextDraw)
        setPhase('done')
        setFlash(null)
        return
      }
      const next =
        due?.prompt ?? drawPrompt(DEFAULT_QUALITIES, medianMsById, prompt.id)
      setPrompt(next)
      setDraw(nextDraw)
      setPhase('prompt')
      setStartedAt(performance.now())
      setElapsedMs(null)
      setFlash(null)
    },
    [draw, medianMsById, prompt.id],
  )

  const grade = (correct: boolean) => {
    const ms = Math.round(performance.now() - startedAt)
    setElapsedMs(ms)
    setAttempts((prev) => [...prev, { prompt, correct, ms }])
    setFlash(correct ? 'hit' : 'miss')
    setStreak((s) => (correct ? s + 1 : 0))
    setPhase('revealed')
    window.setTimeout(() => {
      advance(correct ? undefined : prompt)
    }, 1000)
  }

  const showAnswer = () => {
    setElapsedMs(Math.round(performance.now() - startedAt))
    setPhase('revealed')
  }

  useEffect(() => input.onChange(() => {}), [input])

  if (phase === 'done') {
    const hitRate = attempts.length
      ? Math.round(
          (attempts.filter((a) => a.correct).length / attempts.length) * 100,
        )
      : 0
    const med = median(attempts.map((a) => a.ms))
    const slowest = [...attempts].sort((a, b) => b.ms - a.ms).slice(0, 3)

    return (
      <div className="flex h-full flex-col bg-ink">
        <TopBar streak={streak} onExit={onExit} />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
          <h1 className="font-display text-4xl text-ivory">Session done</h1>
          <p className="font-ui text-dust">
            Median {med} ms · Hit rate {hitRate}%
          </p>
          <div className="w-full max-w-sm space-y-2">
            <p className="font-ui text-sm text-dust">Slowest three</p>
            {slowest.map((a) => (
              <div
                key={`${a.prompt.id}-${a.ms}`}
                className="flex justify-between border-b border-dust/30 py-2 font-display text-xl"
              >
                <span>{a.prompt.symbol}</span>
                <span className="text-dust">{a.ms} ms</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onExit}
            className="mt-4 min-h-16 min-w-[12rem] bg-brass px-8 font-ui text-lg font-medium text-ink"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex h-full flex-col duration-100 ${
        flash === 'hit' ? 'bg-brass' : flash === 'miss' ? 'bg-felt' : 'bg-ink'
      }`}
    >
      <TopBar streak={streak} onExit={onExit} />
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <p className="mb-4 font-ui text-sm text-dust">
          {Math.min(draw + 1, SESSION_LENGTH)} / {SESSION_LENGTH}
        </p>
        <p
          className="font-display font-bold leading-none text-ivory"
          style={{ fontSize: '22vh' }}
        >
          {prompt.symbol}
        </p>
        {phase === 'revealed' && (
          <div className="mt-6 flex flex-col items-center gap-3">
            {elapsedMs !== null && (
              <p className="font-ui text-ivory">{elapsedMs} ms</p>
            )}
            <KeyboardDiagram highlight={prompt.notes} />
            {flash === null && (
              <div className="mt-4 flex w-full max-w-md gap-3">
                <button
                  type="button"
                  onClick={() => grade(true)}
                  className="min-h-16 flex-1 bg-brass font-ui text-lg font-medium text-ink"
                >
                  Hit
                </button>
                <button
                  type="button"
                  onClick={() => grade(false)}
                  className="min-h-16 flex-1 bg-felt font-ui text-lg font-medium text-ivory"
                >
                  Miss
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {phase === 'prompt' && (
        <div className="flex gap-3 p-4 pb-8">
          <button
            type="button"
            onClick={showAnswer}
            className="min-h-16 flex-1 bg-shadow font-ui text-lg text-ivory"
          >
            Show me
          </button>
          <button
            type="button"
            onClick={() => grade(true)}
            className="min-h-16 flex-1 bg-brass font-ui text-lg font-medium text-ink"
          >
            Hit
          </button>
          <button
            type="button"
            onClick={() => grade(false)}
            className="min-h-16 flex-1 bg-felt font-ui text-lg font-medium text-ivory"
          >
            Miss
          </button>
        </div>
      )}
    </div>
  )
}

function TopBar({ streak, onExit }: { streak: number; onExit: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <button
        type="button"
        onClick={onExit}
        className="min-h-12 px-3 font-ui text-dust"
      >
        Exit
      </button>
      <p className="font-ui text-sm text-dust">
        Streak <span className="font-display text-brass">{streak}</span>
      </p>
    </div>
  )
}
