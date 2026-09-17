import { useEffect, useMemo, useRef, useState } from 'react'
import { KeyboardDiagram } from '../components/KeyboardDiagram'
import type { InputSource } from '../input'
import {
  CHROMATIC_ROOTS,
  chordSymbol,
  formatNoteName,
  invertNotes,
  inversionVoicingCorrect,
  spellChord,
  type Inversion,
  type NoteName,
  type TriadQuality,
} from '../theory'
import { DrillFrame } from './DrillFrame'
import { SelfReportButtons } from './SelfReportButtons'

const INVERSIONS: { inv: Inversion; label: string }[] = [
  { inv: 0, label: 'root' },
  { inv: 1, label: '1st' },
  { inv: 2, label: '2nd' },
]

interface Prompt {
  symbol: string
  invLabel: string
  notes: NoteName[]
  bass: NoteName
}

function draw(): Prompt {
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
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null)
  const [heard, setHeard] = useState('')
  const gradingLock = useRef(false)
  const promptRef = useRef(prompt)
  promptRef.current = prompt

  const title = useMemo(
    () => `${prompt.symbol} · ${prompt.invLabel}`,
    [prompt],
  )

  const autoMidi = input.id === 'midi' && input.supportsAutomaticGrade()

  const next = (hit: boolean) => {
    setStreak((s) => (hit ? s + 1 : 0))
    setFlash(hit ? 'hit' : 'miss')
    setRevealed(true)
    window.setTimeout(() => {
      gradingLock.current = false
      setPrompt(draw())
      setRevealed(false)
      setFlash(null)
    }, 900)
  }

  useEffect(() => {
    return input.onChange(() => {
      const held = input.getHeldMidiNotes()
      const pcs = input.getHeldPitchClasses()
      setHeard(
        held.length
          ? `Hearing ${held.length} note${held.length === 1 ? '' : 's'}`
          : input.getStatus(),
      )
      if (!autoMidi) return
      if (gradingLock.current) return
      if (held.length === 0) return
      const p = promptRef.current
      if (inversionVoicingCorrect(held, p.notes, p.bass)) {
        gradingLock.current = true
        next(true)
      } else if (
        // Wrong bass but full chord pcs — soft miss signal only when they release? 
        // Don't auto-miss; wait for correct or Show me / Miss.
        pcs.length >= 3
      ) {
        // leave for self-report / keep holding until bass is correct
      }
    })
  }, [autoMidi, input])

  return (
    <DrillFrame
      status={heard || input.getStatus()}
      streak={streak}
      onExit={onExit}
      banner={
        flash === 'hit' ? (
          <p className="bg-brass px-4 py-2 text-center font-ui text-ink">Hit</p>
        ) : flash === 'miss' ? (
          <p className="bg-felt px-4 py-2 text-center font-ui text-ivory">Miss</p>
        ) : undefined
      }
      footer={
        autoMidi && !revealed ? (
          <p className="w-full text-center font-ui text-dust">
            Play the inversion — bass must be{' '}
            <span className="text-ivory">{formatNoteName(prompt.bass)}</span>
          </p>
        ) : revealed ? (
          <SelfReportButtons
            showOnlyGrade
            onHit={() => {
              if (gradingLock.current) return
              gradingLock.current = true
              next(true)
            }}
            onMiss={() => {
              if (gradingLock.current) return
              gradingLock.current = true
              next(false)
            }}
          />
        ) : (
          <SelfReportButtons
            onShow={() => setRevealed(true)}
            onHit={() => {
              if (gradingLock.current) return
              gradingLock.current = true
              next(true)
            }}
            onMiss={() => {
              if (gradingLock.current) return
              gradingLock.current = true
              next(false)
            }}
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
      <p className="mt-4 font-ui text-dust">
        Exact inversion — lowest note is {formatNoteName(prompt.bass)}
      </p>
      {(revealed || flash === 'miss') && (
        <div className="mt-6">
          <p className="mb-2 text-center font-ui text-ivory">
            Bass {formatNoteName(prompt.bass)} · pcs{' '}
            {prompt.notes.map((n) => formatNoteName(n)).join(' ')}
          </p>
          <KeyboardDiagram highlight={prompt.notes} active={prompt.bass} />
        </div>
      )}
    </DrillFrame>
  )
}
