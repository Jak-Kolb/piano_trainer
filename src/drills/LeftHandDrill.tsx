import { useState } from 'react'
import type { InputSource } from '../input'
import { DrillFrame } from './DrillFrame'
import { SelfReportButtons } from './SelfReportButtons'

const PATTERNS: { name: string; notes: string }[] = [
  { name: 'Block', notes: 'C + E + G together' },
  { name: 'Broken 1-5-8', notes: 'C · G · C′' },
  { name: 'Broken 1-5-10', notes: 'C · G · E′' },
  { name: 'Alberti', notes: 'C · G · E · G' },
]

const KEYS = ['C', 'G', 'Am', 'F', 'D', 'Em']

export function LeftHandDrill({
  input,
  onExit,
}: {
  input: InputSource
  onExit: () => void
}) {
  const [pattern, setPattern] = useState(PATTERNS[0]!)
  const [key, setKey] = useState('C')
  const [streak, setStreak] = useState(0)

  return (
    <DrillFrame
      status={input.getStatus()}
      streak={streak}
      onExit={onExit}
      footer={
        <SelfReportButtons
          showOnlyGrade
          onHit={() => setStreak((s) => s + 1)}
          onMiss={() => setStreak(0)}
        />
      }
    >
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKey(k)}
            className={`min-h-12 px-3 font-ui ${key === k ? 'bg-brass text-ink' : 'bg-shadow text-dust'}`}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {PATTERNS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => setPattern(p)}
            className={`min-h-12 px-3 font-ui ${pattern.name === p.name ? 'bg-brass text-ink' : 'bg-shadow text-dust'}`}
          >
            {p.name}
          </button>
        ))}
      </div>
      <p className="font-display text-5xl text-ivory">{key}</p>
      <p className="mt-4 font-display text-3xl text-brass">{pattern.name}</p>
      <p className="mt-6 font-ui text-2xl text-dust">{pattern.notes}</p>
      <p className="mt-4 max-w-sm text-center font-ui text-sm text-dust">
        Same shape in every key — loop with a metronome at your own tempo.
      </p>
    </DrillFrame>
  )
}
