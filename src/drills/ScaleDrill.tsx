import { useEffect, useMemo, useState } from 'react'
import type { InputSource } from '../input'
import { fingeringFor } from '../theory'
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
      // Root-position arpeggio fingers (common): RH 1 2 3 5, LH 5 3 2 1 — marked unverified in data later
      return hand === 'right' ? [1, 2, 3, 5, 1, 2, 3, 5] : [5, 3, 2, 1, 5, 3, 2, 1]
    }
    return fingeringFor(key, hand, 'scale')?.ascending ?? [1, 2, 3, 1, 2, 3, 4, 5]
  }, [hand, key, kind])

  const twoOct = useMemo(() => [...fingering, ...fingering.slice(1)], [fingering])
  const unverified =
    kind === 'scale'
      ? !fingeringFor(key, hand, 'scale')?.verified
      : true

  useEffect(() => {
    if (input.id !== 'midi' && input.id !== 'mic') return
    return input.onChange(() => {
      const pcs = input.getHeldPitchClasses()
      if (pcs.length === 1) {
        // advance on any single note for monophonic practice pacing
        setStep((s) => Math.min(s + 1, twoOct.length - 1))
      }
    })
  }, [input, twoOct.length])

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
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKey(k)
              setStep(0)
            }}
            className={`min-h-12 px-3 font-ui ${key === k ? 'bg-brass text-ink' : 'bg-shadow text-dust'}`}
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
            onClick={() => {
              setHand(h)
              setStep(0)
            }}
            className={`min-h-12 px-4 font-ui ${hand === h ? 'bg-brass text-ink' : 'bg-shadow text-dust'}`}
          >
            {h === 'right' ? 'RH' : 'LH'}
          </button>
        ))}
      </div>
      <p className="font-display text-4xl text-ivory">
        {kind === 'scale' ? key : key.replace('major', 'arpeggio')}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {twoOct.map((f, i) => (
          <span
            key={`${i}-${f}`}
            className={`flex h-14 w-14 items-center justify-center font-display text-2xl ${
              i === step ? 'bg-brass text-ink' : 'bg-shadow text-ivory'
            }`}
          >
            {f}
          </span>
        ))}
      </div>
      <p className="mt-6 font-ui text-dust">
        Finger {twoOct[step]} · step {step + 1}/{twoOct.length}
      </p>
      <button
        type="button"
        className="mt-4 min-h-12 px-4 font-ui text-dust"
        onClick={() => setStep((s) => Math.min(s + 1, twoOct.length - 1))}
      >
        Next note
      </button>
    </DrillFrame>
  )
}

