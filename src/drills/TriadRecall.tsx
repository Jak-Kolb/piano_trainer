import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { InputSource } from '../input'
import { PianoBar } from '../pieces/PianoBar'
import { preloadPiano } from '../pieces/pianoPlayer'
import { pitchClassesMatchChord } from '../theory'
import { mediansForDraw, recordAttempt } from '../storage/triadStats'
import {
  drillActiveKeys,
  notesToMidi,
  playChordDemo,
} from './drillMidi'
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
  const [persistedMedians, setPersistedMedians] = useState<
    Record<string, number>
  >({})
  const [attempts, setAttempts] = useState<AttemptRecord[]>([])
  const [streak, setStreak] = useState(0)
  const [startedAt, setStartedAt] = useState(() => performance.now())
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null)
  const [heard, setHeard] = useState<string>('')
  const [heldMidi, setHeldMidi] = useState<number[]>([])
  const [playing, setPlaying] = useState(false)
  const requeueDelayed = useRef<{ prompt: TriadPrompt; remaining: number }[]>(
    [],
  )
  const gradingLock = useRef(false)
  const stopDemo = useRef<(() => void) | null>(null)
  const promptRef = useRef(prompt)
  promptRef.current = prompt
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => {
    preloadPiano()
    return () => {
      stopDemo.current?.()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void mediansForDraw().then((m) => {
      if (!cancelled) setPersistedMedians(m)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const autoGrade = input.supportsAutomaticGrade() && input.id === 'midi'

  const targetMidi = useMemo(
    () => notesToMidi(prompt.notes, 4),
    [prompt.notes],
  )

  const activeKeys = useMemo(() => {
    const targets = phase === 'revealed' || flash !== null ? targetMidi : []
    return drillActiveKeys(heldMidi, targets, 'right')
  }, [heldMidi, targetMidi, phase, flash])

  const medianMsById = useMemo(() => {
    const map: Record<string, number[]> = {}
    for (const a of attempts) {
      ;(map[a.prompt.id] ??= []).push(a.ms)
    }
    const session: Record<string, number> = {}
    for (const [id, times] of Object.entries(map)) session[id] = median(times)
    return { ...persistedMedians, ...session }
  }, [attempts, persistedMedians])

  const accuracy =
    attempts.length === 0
      ? undefined
      : `${Math.round(
          (attempts.filter((a) => a.correct).length / attempts.length) * 100,
        )}%`

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

  const onPlayIt = async () => {
    if (playing) return
    stopDemo.current?.()
    setPlaying(true)
    try {
      const { stop } = await playChordDemo(promptRef.current.notes, 4)
      stopDemo.current = stop
      window.setTimeout(() => {
        setPlaying(false)
      }, 1600)
    } catch {
      setPlaying(false)
    }
  }

  useEffect(() => {
    return input.onChange(() => {
      const held = input.getHeldMidiNotes()
      const pcs = input.getHeldPitchClasses()
      setHeldMidi(held)
      setHeard(
        held.length
          ? `Hearing ${held.length} note${held.length === 1 ? '' : 's'}`
          : pcs.length
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

  const keyboard = (
    <PianoBar
      activeKeys={activeKeys}
      lowMidi={48}
      highMidi={84}
    />
  )

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
        <TopBar
          streak={streak}
          onExit={onExit}
          status={input.getStatus()}
          round={`${SESSION_LENGTH} / ${SESSION_LENGTH}`}
          accuracy={`${hitRate}%`}
        />
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
        round={`${Math.min(draw + 1, SESSION_LENGTH)} / ${SESSION_LENGTH}`}
        accuracy={accuracy}
      />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4">
        <p
          className="font-display font-bold leading-none text-ivory"
          style={{ fontSize: '22vh' }}
        >
          {prompt.symbol}
        </p>
        {phase === 'revealed' && elapsedMs !== null && (
          <p className="mt-4 font-ui text-ivory">{elapsedMs} ms</p>
        )}
      </div>
      {keyboard}
      <div className="flex flex-wrap gap-3 p-4 pb-6">
        {phase === 'prompt' && (
          <>
            <button
              type="button"
              onClick={() => void onPlayIt()}
              disabled={playing}
              className="min-h-16 flex-1 bg-shadow font-ui text-lg text-ivory disabled:opacity-60"
            >
              {playing ? 'Playing…' : 'Play it'}
            </button>
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
                Play the chord — MIDI grades automatically · keys light as you
                hold
              </p>
            )}
          </>
        )}
        {phase === 'revealed' && flash === null && (
          <>
            <button
              type="button"
              onClick={() => void onPlayIt()}
              disabled={playing}
              className="min-h-16 flex-1 bg-shadow font-ui text-lg text-ivory disabled:opacity-60"
            >
              {playing ? 'Playing…' : 'Play it'}
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
        {phase === 'revealed' && flash !== null && (
          <button
            type="button"
            onClick={() => void onPlayIt()}
            disabled={playing}
            className="min-h-16 flex-1 bg-shadow font-ui text-lg text-ivory disabled:opacity-60"
          >
            {playing ? 'Playing…' : 'Play it'}
          </button>
        )}
      </div>
    </div>
  )
}

function TopBar({
  streak,
  onExit,
  status,
  round,
  accuracy,
}: {
  streak: number
  onExit: () => void
  status: string
  round?: string
  accuracy?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <button
        type="button"
        onClick={onExit}
        className="min-h-11 shrink-0 px-3 font-ui text-dust"
      >
        Exit
      </button>
      <div className="min-w-0 flex-1 text-center">
        <p className="truncate font-ui text-[11px] text-dust">{status}</p>
        {(round || accuracy) && (
          <p className="font-ui text-xs text-dust">
            {round}
            {round && accuracy ? ' · ' : ''}
            {accuracy ? (
              <>
                Acc <span className="text-brass">{accuracy}</span>
              </>
            ) : null}
          </p>
        )}
      </div>
      <p className="shrink-0 font-ui text-sm text-dust">
        Streak <span className="font-display text-brass">{streak}</span>
      </p>
    </div>
  )
}
