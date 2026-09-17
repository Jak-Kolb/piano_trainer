import { useEffect, useMemo, useRef, useState } from 'react'
import type { InputSource } from '../input'
import { PianoBar } from '../pieces/PianoBar'
import { preloadPiano } from '../pieces/pianoPlayer'
import {
  formatMs,
  getBestMs,
  recordCompletion,
} from '../storage/techniqueTimes'
import {
  fingeringFor,
  formatPitch,
  twoOctaveArpeggioNotes,
  twoOctaveScaleNotes,
} from '../theory'
import { DrillFrame } from './DrillFrame'
import { drillActiveKeys, playSequenceDemo } from './drillMidi'
import { SelfReportButtons } from './SelfReportButtons'

const KEYS = ['C major', 'G major', 'D major', 'A major', 'E major', 'F major'] as const

export function ScaleDrill({
  input,
  onExit,
  kind = 'scale',
}: {
  input: InputSource
  onExit: () => void
  kind?: 'scale' | 'arpeggio'
}) {
  const [key, setKey] = useState<(typeof KEYS)[number]>('C major')
  const [hand, setHand] = useState<'right' | 'left'>('right')
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [streak, setStreak] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [lastMs, setLastMs] = useState<number | null>(null)
  const [bestMs, setBestMs] = useState<number | null>(() =>
    getBestMs(kind, 'C major', 'right'),
  )
  const [isNewBest, setIsNewBest] = useState(false)
  const [heldMidi, setHeldMidi] = useState<number[]>([])
  const [playing, setPlaying] = useState(false)
  const stopDemo = useRef<(() => void) | null>(null)
  const advancedForStep = useRef(false)
  const startedAt = useRef<number | null>(null)
  const tickRef = useRef(0)

  const fingering = useMemo(() => {
    if (kind === 'arpeggio') {
      return hand === 'right'
        ? [1, 2, 3, 5, 1, 2, 3, 5]
        : [5, 3, 2, 1, 5, 3, 2, 1]
    }
    return (
      fingeringFor(key, hand, 'scale')?.ascending ?? [1, 2, 3, 1, 2, 3, 4, 5]
    )
  }, [hand, key, kind])

  const notes = useMemo(
    () =>
      kind === 'arpeggio'
        ? twoOctaveArpeggioNotes(key, hand)
        : twoOctaveScaleNotes(key, hand),
    [key, kind, hand],
  )

  const fingers = useMemo(() => {
    const two = [...fingering, ...fingering.slice(1)]
    return two.slice(0, notes.length)
  }, [fingering, notes.length])

  const current = done ? null : (notes[step] ?? null)
  const unverified =
    kind === 'scale' ? !fingeringFor(key, hand, 'scale')?.verified : true
  const label = kind === 'scale' ? 'Scale' : 'Arpeggio'

  const ensureTimer = () => {
    if (startedAt.current === null) startedAt.current = performance.now()
  }

  const restart = () => {
    setDone(false)
    setStep(0)
    setElapsedMs(0)
    setLastMs(null)
    setIsNewBest(false)
    advancedForStep.current = false
    startedAt.current = null
    setBestMs(getBestMs(kind, key, hand))
  }

  const completeRun = () => {
    const ms = Math.round(performance.now() - (startedAt.current ?? performance.now()))
    setLastMs(ms)
    const result = recordCompletion(kind, key, hand, ms)
    setBestMs(result.bestMs)
    setIsNewBest(result.isNewBest)
    setDone(true)
    setStreak((s) => s + 1)
  }

  const advanceFromMatch = () => {
    if (advancedForStep.current || done) return
    ensureTimer()
    advancedForStep.current = true
    if (step >= notes.length - 1) {
      completeRun()
      return
    }
    setStep((s) => s + 1)
  }

  useEffect(() => {
    restart()
  }, [key, hand, kind])

  useEffect(() => {
    preloadPiano()
    return () => stopDemo.current?.()
  }, [])


  useEffect(() => {
    advancedForStep.current = false
  }, [step])

  // Live elapsed while running
  useEffect(() => {
    if (done) return
    const id = window.setInterval(() => {
      if (startedAt.current !== null) {
        setElapsedMs(Math.round(performance.now() - startedAt.current))
      }
    }, 100)
    tickRef.current = id
    return () => window.clearInterval(id)
  }, [done, key, hand, kind])

  useEffect(() => {
    if (!current || done) return
    return input.onChange(() => {
      const held = input.getHeldMidiNotes()
      setHeldMidi(held)
      if (advancedForStep.current) return

      if (input.id === 'midi') {
        if (held.includes(current.midi)) advanceFromMatch()
        return
      }

      if (input.id === 'mic') {
        const pcs = input.getHeldPitchClasses()
        if (held.includes(current.midi)) {
          advanceFromMatch()
        } else if (
          held.length === 0 &&
          pcs.length === 1 &&
          pcs[0] === ((current.midi % 12) + 12) % 12
        ) {
          advanceFromMatch()
        }
      }
    })
  }, [input, current, done, step, notes.length])

  const targetMidi = current ? [current.midi] : []
  const scaleMidis = notes.map((n) => n.midi)
  const activeKeys = drillActiveKeys(
    heldMidi,
    targetMidi,
    hand === 'right' ? 'right' : 'left',
  )

  const onPlayIt = async () => {
    if (playing || done) return
    stopDemo.current?.()
    setPlaying(true)
    try {
      const { stop } = await playSequenceDemo(scaleMidis, 0.22)
      stopDemo.current = stop
      window.setTimeout(
        () => setPlaying(false),
        Math.round(scaleMidis.length * 220 + 400),
      )
    } catch {
      setPlaying(false)
    }
  }

  if (done) {
    return (
      <DrillFrame status={input.getStatus()} streak={streak} onExit={onExit}>
        <p className="font-display text-4xl text-brass">{label} complete</p>
        <p className="mt-3 font-ui text-dust">
          {kind === 'scale' ? key : key.replace('major', 'arpeggio')} ·{' '}
          {hand === 'right' ? 'RH' : 'LH'}
        </p>
        <p className="mt-6 font-display text-3xl text-ivory">
          {lastMs !== null ? formatMs(lastMs) : '—'}
        </p>
        <p className="mt-2 font-ui text-dust">
          Best{' '}
          <span className="text-brass">
            {bestMs !== null ? formatMs(bestMs) : '—'}
          </span>
          {isNewBest ? ' · new best' : ''}
        </p>
        <button
          type="button"
          className="mt-8 min-h-16 bg-brass px-8 font-ui text-lg text-ink"
          onClick={restart}
        >
          Again
        </button>
      </DrillFrame>
    )
  }

  return (
    <DrillFrame
      status={input.getStatus()}
      streak={streak}
      onExit={onExit}
      banner={
        unverified ? (
          <p className="bg-felt/40 px-4 py-2 text-center font-ui text-sm text-ivory">
            Unverified fingering — confirm against a published chart
          </p>
        ) : undefined
      }
      keyboard={
        <PianoBar
          activeKeys={activeKeys}
          lowMidi={hand === 'left' ? 36 : 48}
          highMidi={hand === 'left' ? 72 : 84}
        />
      }
      footer={
        <>
          <button
            type="button"
            onClick={() => void onPlayIt()}
            disabled={playing}
            className="min-h-16 flex-1 bg-shadow font-ui text-lg text-ivory disabled:opacity-60"
          >
            {playing ? 'Playing…' : 'Play it'}
          </button>
          <SelfReportButtons
            onHit={() => {
              ensureTimer()
              completeRun()
            }}
            onMiss={() => {
              setStreak(0)
              restart()
            }}
            showOnlyGrade
          />
        </>
      }
    >
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKey(k)}
            className={`min-h-12 px-3 font-ui ${
              key === k ? 'bg-brass text-ink' : 'bg-shadow text-dust'
            }`}
          >
            {k.replace(' major', '')}
          </button>
        ))}
      </div>
      <div className="mb-4 flex gap-2">
        {(['right', 'left'] as const).map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHand(h)}
            className={`min-h-12 px-4 font-ui ${
              hand === h ? 'bg-brass text-ink' : 'bg-shadow text-dust'
            }`}
          >
            {h === 'right' ? 'RH' : 'LH'}
          </button>
        ))}
      </div>
      <p className="font-display text-3xl text-ivory">
        {kind === 'scale' ? key : key.replace('major', 'arpeggio')}
      </p>
      <p className="mt-2 font-ui text-sm text-dust">
        Time {startedAt.current ? formatMs(elapsedMs) : '0.0s'} · Best{' '}
        {bestMs !== null ? formatMs(bestMs) : '—'}
      </p>
      <p className="mt-1 font-ui text-sm text-dust">
        MIDI needs the correct octave (C4 ≠ C5)
      </p>

      <div className="mt-6 flex max-w-xl flex-wrap justify-center gap-2">
        {notes.map((n, i) => (
          <span
            key={`${i}-${formatPitch(n)}`}
            className={`flex min-h-16 min-w-14 flex-col items-center justify-center px-2 font-display ${
              i === step ? 'bg-brass text-ink' : 'bg-shadow text-ivory'
            }`}
          >
            <span className="text-lg">{formatPitch(n)}</span>
            <span className="text-sm opacity-80">{fingers[i] ?? '·'}</span>
          </span>
        ))}
      </div>

      <p className="mt-4 font-ui text-dust">
        {current ? formatPitch(current) : '—'} · finger {fingers[step] ?? '—'} ·{' '}
        {step + 1}/{notes.length}
      </p>
      <button
        type="button"
        className="mt-3 min-h-12 px-4 font-ui text-dust"
        onClick={() => {
          ensureTimer()
          if (step >= notes.length - 1) completeRun()
          else setStep((s) => s + 1)
        }}
      >
        {step >= notes.length - 1 ? 'Finish' : 'Next note'}
      </button>
    </DrillFrame>
  )
}
