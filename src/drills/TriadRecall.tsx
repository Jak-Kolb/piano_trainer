import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KeyboardDiagram } from '../components/KeyboardDiagram'
import type { InputSource } from '../input'
import { pitchClassesMatchChord } from '../theory'
import { mediansForDraw, recordAttempt } from '../storage/triadStats'
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
  /** Mic cannot grade chords — keep Hit/Miss. */
  micFallsBackToSelfReport?: boolean
  onExit: () => void
}

export function TriadRecall({
  input,
  micFallsBackToSelfReport = false,
  onExit,
}: Props) {
  const [phase, setPhase] = useState<Phase>('prompt')
  const [draw, setDraw] = useState(0)
  const [prompt, setPrompt] = useState<TriadPrompt>(() =>
    drawPrompt(DEFAULT_QUALITIES, {}),
  )
  const [persistedMedians, setPersistedMedians] = useState<
    Record<string, number>
  >({})
  const [attempts, setAttempts] = useState<AttemptRecord[]>([])
  const [streak, setStreak] = useState(0)
  const [startedAt, setStartedAt] = useState(() => performance.now())
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null)
  const [heard, setHeard] = useState<string>('')
  const requeueDelayed = useRef<{ prompt: TriadPrompt; remaining: number }[]>(
    [],
  )
  const gradingLock = useRef(false)
  const promptRef = useRef(prompt)
  promptRef.current = prompt
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => {
    let cancelled = false
    void mediansForDraw().then((m) => {
      if (!cancelled) setPersistedMedians(m)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const autoGrade =
    input.supportsAutomaticGrade() &&
    input.id === 'midi' &&
    !micFallsBackToSelfReport

  const medianMsById = useMemo(() => {
    const map: Record<string, number[]> = {}
    for (const a of attempts) {
      ;(map[a.prompt.id] ??= []).push(a.ms)
    }
    const session: Record<string, number> = {}
    for (const [id, times] of Object.entries(map)) session[id] = median(times)
    return { ...persistedMedians, ...session }
  }, [attempts, persistedMedians])

  const advance = useCallback(
    (missed?: TriadPrompt) => {
      gradingLock.current = false
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

  const grade = useCallback(
    (correct: boolean) => {
      if (gradingLock.current) return
      gradingLock.current = true
      const ms = Math.round(performance.now() - startedAt)
      setElapsedMs(ms)
      setAttempts((prev) => [
        ...prev,
        { prompt: promptRef.current, correct, ms },
      ])
      void recordAttempt(promptRef.current.id, ms, correct)
      setFlash(correct ? 'hit' : 'miss')
      setStreak((s) => (correct ? s + 1 : 0))
      setPhase('revealed')
      window.setTimeout(() => {
        advance(correct ? undefined : promptRef.current)
      }, 1000)
    },
    [advance, startedAt],
  )

  const showAnswer = () => {
    setElapsedMs(Math.round(performance.now() - startedAt))
    setPhase('revealed')
  }

  useEffect(() => {
    return input.onChange(() => {
      const pcs = input.getHeldPitchClasses()
      setHeard(
        pcs.length
          ? `Hearing ${pcs.length} note${pcs.length === 1 ? '' : 's'}`
          : input.getStatus(),
      )
      if (!autoGrade) return
      if (phaseRef.current !== 'prompt') return
      if (gradingLock.current) return
      if (pcs.length === 0) return
      if (pitchClassesMatchChord(pcs, promptRef.current.pitchClasses)) {
        grade(true)
      }
    })
  }, [autoGrade, grade, input])

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
        <TopBar streak={streak} onExit={onExit} status={input.getStatus()} />
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
      <TopBar
        streak={streak}
        onExit={onExit}
        status={heard || input.getStatus()}
      />
      {micFallsBackToSelfReport && (
        <p className="bg-shadow px-4 py-2 text-center font-ui text-sm text-dust">
          Mic is monophonic — chord drills use Hit / Miss. Hearing a pitch still
          shows above.
        </p>
      )}
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
          {!autoGrade && (
            <>
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
            </>
          )}
          {autoGrade && (
            <p className="w-full text-center font-ui text-dust">
              Play the chord — MIDI grades automatically
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function TopBar({
  streak,
  onExit,
  status,
}: {
  streak: number
  onExit: () => void
  status: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <button
        type="button"
        onClick={onExit}
        className="min-h-12 shrink-0 px-3 font-ui text-dust"
      >
        Exit
      </button>
      <p className="truncate font-ui text-xs text-dust">{status}</p>
      <p className="shrink-0 font-ui text-sm text-dust">
        Streak <span className="font-display text-brass">{streak}</span>
      </p>
    </div>
  )
}
