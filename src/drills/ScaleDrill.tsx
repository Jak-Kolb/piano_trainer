import { useEffect, useMemo, useState } from 'react'
import { KeyboardDiagram } from '../components/KeyboardDiagram'
import type { InputSource } from '../input'
import {
  fingeringFor,
  formatNoteName,
  pitchClass,
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
  const [streak, setStreak] = useState(0)

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
        ? twoOctaveArpeggioNotes(key)
        : twoOctaveScaleNotes(key),
    [key, kind],
  )

  const fingers = useMemo(() => {
    const two = [...fingering, ...fingering.slice(1)]
    return two.slice(0, notes.length)
  }, [fingering, notes.length])

  const current = notes[step] ?? null
  const unverified =
    kind === 'scale' ? !fingeringFor(key, hand, 'scale')?.verified : true

  useEffect(() => {
    setStep(0)
  }, [key, hand, kind])

  useEffect(() => {
    if (input.id !== 'midi' && input.id !== 'mic') return
    if (!current) return
    const target = pitchClass(current)
    return input.onChange(() => {
      const pcs = input.getHeldPitchClasses()
      if (pcs.length === 1 && pcs[0] === target) {
        setStep((s) => Math.min(s + 1, notes.length - 1))
      }
    })
  }, [input, current, notes.length])

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
            setStep(0)
          }}
          onMiss={() => {
            setStreak(0)
            setStep(0)
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

      <div className="mt-6 w-full max-w-lg">
        <KeyboardDiagram highlight={notes} active={current} hideLabels />
      </div>

      <div className="mt-6 flex max-w-xl flex-wrap justify-center gap-2">
        {notes.map((n, i) => (
          <span
            key={`${i}-${formatNoteName(n)}`}
            className={`flex min-h-16 min-w-14 flex-col items-center justify-center px-2 font-display ${
              i === step ? 'bg-brass text-ink' : 'bg-shadow text-ivory'
            }`}
          >
            <span className="text-xl">{formatNoteName(n)}</span>
            <span className="text-sm opacity-80">{fingers[i] ?? '·'}</span>
          </span>
        ))}
      </div>

      <p className="mt-4 font-ui text-dust">
        {current ? formatNoteName(current) : '—'} · finger {fingers[step] ?? '—'}{' '}
        · {step + 1}/{notes.length}
      </p>
      <button
        type="button"
        className="mt-3 min-h-12 px-4 font-ui text-dust"
        onClick={() => setStep((s) => Math.min(s + 1, notes.length - 1))}
      >
        Next note
      </button>
    </DrillFrame>
  )
}
