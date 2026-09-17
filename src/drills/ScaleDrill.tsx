import { useEffect, useMemo, useRef, useState } from 'react'
import { KeyboardDiagram } from '../components/KeyboardDiagram'
import type { InputSource } from '../input'
import {
  fingeringFor,
  formatPitch,
  twoOctaveArpeggioNotes,
  twoOctaveScaleNotes,
} from '../theory'
import { DrillFrame } from './DrillFrame'
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
  const advancedForStep = useRef(false)

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

  const restart = () => {
    setDone(false)
    setStep(0)
    advancedForStep.current = false
  }

  const advanceFromMatch = () => {
    if (advancedForStep.current || done) return
    advancedForStep.current = true
    if (step >= notes.length - 1) {
      setDone(true)
      setStreak((s) => s + 1)
      return
    }
    setStep((s) => s + 1)
  }

  useEffect(() => {
    restart()
  }, [key, hand, kind])

  useEffect(() => {
    advancedForStep.current = false
  }, [step])

  useEffect(() => {
    if (!current || done) return
    return input.onChange(() => {
      if (advancedForStep.current) return

      if (input.id === 'midi') {
        const held = input.getHeldMidiNotes()
        if (held.includes(current.midi)) advanceFromMatch()
        return
      }

      if (input.id === 'mic') {
        const held = input.getHeldMidiNotes()
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

  if (done) {
    return (
      <DrillFrame status={input.getStatus()} streak={streak} onExit={onExit}>
        <p className="font-display text-4xl text-brass">{label} complete</p>
        <p className="mt-3 font-ui text-dust">
          {kind === 'scale' ? key : key.replace('major', 'arpeggio')} · {hand === 'right' ? 'RH' : 'LH'}
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
      footer={
        <SelfReportButtons
          onHit={() => {
            setStreak((s) => s + 1)
            restart()
          }}
          onMiss={() => {
            setStreak(0)
            restart()
          }}
          showOnlyGrade
        />
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
      <p className="mt-1 font-ui text-sm text-dust">
        MIDI needs the correct octave (C4 ≠ C5)
      </p>

      <div className="mt-6 w-full max-w-lg">
        <KeyboardDiagram highlight={notes} active={current} hideLabels />
      </div>

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
          if (step >= notes.length - 1) {
            setDone(true)
            setStreak((s) => s + 1)
          } else {
            setStep((s) => s + 1)
          }
        }}
      >
        {step >= notes.length - 1 ? 'Finish' : 'Next note'}
      </button>
    </DrillFrame>
  )
}
