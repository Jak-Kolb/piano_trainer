import { useEffect, useMemo, useState } from 'react'
import type { InputSource } from '../input'
import { midiChordHeld, midiNames } from './noteMatch'
import { chordWindowSec, filterNotes, groupSteps } from './parseMidi'
import { PianoRoll } from './PianoRoll'
import { PieceControlsBar } from './PieceControlsBar'
import { StaffNotation } from './StaffNotation'
import type { ParsedPiece, PieceControls } from './types'

type ViewMode = 'staff' | 'roll' | 'both'

interface Props {
  parsed: ParsedPiece
  controls: PieceControls
  input: InputSource
  title: string
  onExit: () => void
  onControls: (c: PieceControls) => void
}

export function WalkThroughMode({
  parsed,
  controls,
  input,
  title,
  onExit,
  onControls,
}: Props) {
  const notes = useMemo(
    () =>
      filterNotes(
        parsed.notes,
        controls.hands,
        parsed.hasTwoHands,
        controls.loopStartMeasure,
        controls.loopEndMeasure,
      ),
    [parsed, controls],
  )
  const steps = useMemo(
    () => groupSteps(notes, chordWindowSec(parsed.secPerQuarter)),
    [notes, parsed.secPerQuarter],
  )
  const [stepIdx, setStepIdx] = useState(0)
  const [view, setView] = useState<ViewMode>('staff')
  const step = steps[stepIdx]
  const nowSec = step?.[0]?.time ?? 0
  const measure = step?.[0]?.measure ?? controls.loopStartMeasure
  const activeMidis = step?.map((n) => n.midi) ?? []

  useEffect(() => {
    setStepIdx(0)
  }, [notes])

  useEffect(() => {
    if (!step || input.id !== 'midi') return
    return input.onChange(() => {
      const held = input.getHeldMidiNotes()
      if (held.length === 0) return
      if (midiChordHeld(held, step)) {
        setStepIdx((i) => Math.min(i + 1, Math.max(0, steps.length - 1)))
      }
    })
  }, [input, step, steps.length])

  const done =
    steps.length > 0 && stepIdx >= steps.length - 1 && step
      ? midiChordHeld(input.getHeldMidiNotes(), step)
      : stepIdx >= steps.length

  return (
    <div className="flex h-full flex-col bg-ink">
      <Header title={title} status={input.getStatus()} onExit={onExit} />
      <PieceControlsBar
        controls={controls}
        measureCount={parsed.measureCount}
        hasTwoHands={parsed.hasTwoHands}
        onChange={onControls}
      />
      <div className="flex gap-2 px-4 pt-2">
        {(
          [
            ['staff', 'Sheet'],
            ['roll', 'Roll'],
            ['both', 'Both'],
          ] as [ViewMode, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`min-h-12 px-4 font-ui ${
              view === id ? 'bg-brass text-ink' : 'bg-shadow text-dust'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {(view === 'staff' || view === 'both') && (
          <StaffNotation
            notes={notes}
            measure={measure}
            activeMidis={activeMidis}
            secPerQuarter={parsed.secPerQuarter}
            measureCount={Math.max(controls.loopEndMeasure, parsed.measureCount)}
          />
        )}
        {(view === 'roll' || view === 'both') && (
          <PianoRoll notes={notes} nowSec={nowSec} />
        )}
        <div className="flex flex-col items-center justify-center py-2">
          {steps.length === 0 ? (
            <p className="font-ui text-dust">No notes in this loop / hand filter.</p>
          ) : done && stepIdx >= steps.length - 1 ? (
            <p className="font-display text-4xl text-brass">Loop complete</p>
          ) : (
            <>
              <p className="font-ui text-sm text-dust">
                Step {stepIdx + 1} / {steps.length} · bar {measure}
              </p>
              <p
                className="mt-2 font-display font-bold text-ivory"
                style={{ fontSize: '8vh' }}
              >
                {step ? midiNames(step.map((n) => n.midi)) : '—'}
              </p>
              <p className="mt-2 font-ui text-dust">
                {input.id === 'midi'
                  ? step && step.length > 1
                    ? `Hold all ${step.length} notes together`
                    : 'Play this note on the Kawai'
                  : 'Switch to MIDI for auto-advance — or use Skip'}
              </p>
            </>
          )}
        </div>
        <div className="flex gap-3 pb-4">
          <button
            type="button"
            className="min-h-16 flex-1 bg-shadow font-ui text-ivory"
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          >
            Back
          </button>
          <button
            type="button"
            className="min-h-16 flex-1 bg-brass font-ui text-ink"
            onClick={() =>
              setStepIdx((i) => Math.min(steps.length - 1, i + 1))
            }
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}

function Header({
  title,
  status,
  onExit,
}: {
  title: string
  status: string
  onExit: () => void
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
      <p className="truncate font-display text-lg text-ivory">{title}</p>
      <p className="max-w-[30%] truncate font-ui text-xs text-dust">{status}</p>
    </div>
  )
}
