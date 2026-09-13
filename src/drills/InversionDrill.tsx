import { useMemo, useState } from 'react'
import { KeyboardDiagram } from '../components/KeyboardDiagram'
import type { InputSource } from '../input'
import {
  CHROMATIC_ROOTS,
  chordSymbol,
  invertNotes,
  spellChord,
  type Inversion,
  type TriadQuality,
} from '../theory'
import { formatNoteName } from '../theory'
import { DrillFrame } from './DrillFrame'
import { SelfReportButtons } from './SelfReportButtons'

const INVERSIONS: { inv: Inversion; label: string }[] = [
  { inv: 0, label: 'root' },
  { inv: 1, label: '1st' },
  { inv: 2, label: '2nd' },
]

function draw() {
  const root = CHROMATIC_ROOTS[Math.floor(Math.random() * CHROMATIC_ROOTS.length)]!
  const quality: TriadQuality = Math.random() < 0.5 ? 'major' : 'minor'
  const inv = INVERSIONS[Math.floor(Math.random() * 3)]!
  const spelled = spellChord(root, quality)
  const notes = invertNotes(spelled.notes, inv.inv)
  return {
    symbol: chordSymbol(root, quality),
    invLabel: inv.label,
    notes,
    bass: notes[0]!,
  }
}

export function InversionDrill({
  input,
  onExit,
}: {
  input: InputSource
  onExit: () => void
}) {
  const [prompt, setPrompt] = useState(draw)
  const [revealed, setRevealed] = useState(false)
  const [streak, setStreak] = useState(0)
  const title = useMemo(
    () => `${prompt.symbol} · ${prompt.invLabel}`,
    [prompt],
  )

  const next = (hit: boolean) => {
    setStreak((s) => (hit ? s + 1 : 0))
    setPrompt(draw())
    setRevealed(false)
  }

  return (
    <DrillFrame
      status={input.getStatus()}
      streak={streak}
      onExit={onExit}
      footer={
        revealed ? (
          <SelfReportButtons
            showOnlyGrade
            onHit={() => next(true)}
            onMiss={() => next(false)}
          />
        ) : (
          <SelfReportButtons
            onShow={() => setRevealed(true)}
            onHit={() => next(true)}
            onMiss={() => next(false)}
          />
        )
      }
    >
      <p
        className="font-display font-bold text-ivory"
        style={{ fontSize: '14vh' }}
      >
        {title}
      </p>
      <p className="mt-4 font-ui text-dust">Play that exact inversion</p>
      {revealed && (
        <div className="mt-6">
          <p className="mb-2 text-center font-ui text-ivory">
            Bass {formatNoteName(prompt.bass)}
          </p>
          <KeyboardDiagram highlight={prompt.notes} />
        </div>
      )}
    </DrillFrame>
  )
}
