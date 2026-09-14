import { useEffect, useMemo, useState } from 'react'
import type { InputSource } from '../input'
import { midiSetMatch, midiNames } from './noteMatch'
import { filterNotes, groupSteps } from './parseMidi'
import { PianoRoll } from './PianoRoll'
import { PieceControlsBar } from './PieceControlsBar'
import type { ParsedPiece, PieceControls } from './types'

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
  const steps = useMemo(() => groupSteps(notes), [notes])
  const [stepIdx, setStepIdx] = useState(0)
  const step = steps[stepIdx]
  const nowSec = step?.[0]?.time ?? 0

  useEffect(() => {
    setStepIdx(0)
  }, [notes])

  useEffect(() => {
    if (!step || input.id !== 'midi') return
    return input.onChange(() => {
      const held = input.getHeldMidiNotes()
      if (held.length === 0) return
      if (midiSetMatch(held, step, true)) {
        setStepIdx((i) => Math.min(i + 1, Math.max(0, steps.length - 1)))
      }
    })
  }, [input, step, steps.length])

  const done = steps.length > 0 && stepIdx >= steps.length - 1 && step
    ? midiSetMatch(input.getHeldMidiNotes(), step, true)
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
      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <PianoRoll notes={notes} nowSec={nowSec} />
        <div className="flex flex-1 flex-col items-center justify-center">
          {steps.length === 0 ? (
            <p className="font-ui text-dust">No notes in this loop / hand filter.</p>
          ) : done && stepIdx >= steps.length - 1 ? (
            <p className="font-display text-4xl text-brass">Loop complete</p>
          ) : (
            <>
              <p className="font-ui text-sm text-dust">
                Step {stepIdx + 1} / {steps.length} · bar {step?.[0]?.measure}
              </p>
              <p
                className="mt-4 font-display font-bold text-ivory"
                style={{ fontSize: '12vh' }}
              >
                {step ? midiNames(step.map((n) => n.midi)) : '—'}
              </p>
              <p className="mt-4 font-ui text-dust">
                {input.id === 'midi'
                  ? 'Play these notes on the Kawai'
                  : 'Switch to MIDI input to auto-advance'}
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
