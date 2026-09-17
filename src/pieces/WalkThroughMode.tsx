import { useEffect, useMemo, useRef, useState } from 'react'
import type { InputSource } from '../input'
import { playNotesDemo, lineStartMeasure } from './demoAudio'
import { midiChordHeld, midiNames } from './noteMatch'
import { chordWindowSec, filterNotes, groupSteps } from './parseMidi'
import { PianoRoll } from './PianoRoll'
import { PieceControlsBar } from './PieceControlsBar'
import { StaffNotation } from './StaffNotation'
import type { ParsedPiece, PieceControls, PieceNote } from './types'

type ViewMode = 'staff' | 'roll' | 'both'
type DemoKind = 'line' | 'bar' | null

const BARS_PER_LINE = 8

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
  const [demo, setDemo] = useState<DemoKind>(null)
  const [demoNow, setDemoNow] = useState(0)
  const stopDemoRef = useRef<(() => void) | null>(null)
  const demoMeta = useRef<{
    originSec: number
    endSec: number
    startedAt: number
    tempoFactor: number
  } | null>(null)

  const step = steps[stepIdx]
  const measure = step?.[0]?.measure ?? controls.loopStartMeasure
  const lineStart = lineStartMeasure(measure, BARS_PER_LINE)
  const lineEnd = lineStart + BARS_PER_LINE - 1

  // During demo, highlight by playback time; otherwise by practice step
  const activeNotes: PieceNote[] = useMemo(() => {
    if (demo && demoMeta.current) {
      const t = demoNow
      // Find step whose onset is current (latest onset <= t)
      let best: PieceNote[] = []
      let bestTime = -1
      for (const s of steps) {
        const onset = s[0]?.time ?? -1
        if (onset <= t + 0.02 && onset >= bestTime) {
          bestTime = onset
          best = s
        }
      }
      return best
    }
    return step ?? []
  }, [demo, demoNow, step, steps])

  const displayMeasure = activeNotes[0]?.measure ?? measure
  const nowSec = demo ? demoNow : (step?.[0]?.time ?? 0)

  useEffect(() => {
    setStepIdx(0)
  }, [notes])

  useEffect(() => {
    return () => {
      stopDemoRef.current?.()
    }
  }, [])

  // Sync practice step index while demo plays (so Skip/Back stay coherent after)
  useEffect(() => {
    if (!demo) return
    const t = demoNow
    let idx = 0
    for (let i = 0; i < steps.length; i++) {
      const onset = steps[i]![0]?.time ?? 0
      if (onset <= t + 0.02) idx = i
      else break
    }
    setStepIdx(idx)
  }, [demo, demoNow, steps])

  useEffect(() => {
    if (demo) return // don't auto-advance from MIDI during demo
    if (!step || input.id !== 'midi') return
    return input.onChange(() => {
      const held = input.getHeldMidiNotes()
      if (held.length === 0) return
      if (midiChordHeld(held, step)) {
        setStepIdx((i) => Math.min(i + 1, Math.max(0, steps.length - 1)))
      }
    })
  }, [input, step, steps.length, demo])

  const stopDemo = () => {
    stopDemoRef.current?.()
    stopDemoRef.current = null
    demoMeta.current = null
    setDemo(null)
  }

  const startDemo = async (kind: 'line' | 'bar') => {
    stopDemo()
    const lo = kind === 'bar' ? displayMeasure : lineStart
    const hi = kind === 'bar' ? displayMeasure : lineEnd
    const slice = notes.filter((n) => n.measure >= lo && n.measure <= hi)
    if (!slice.length) return

    const tempoFactor = Math.max(0.25, controls.tempoPercent / 100)
    const handle = await playNotesDemo(slice, controls.tempoPercent)
    stopDemoRef.current = handle.stop
    demoMeta.current = {
      originSec: handle.originSec,
      endSec: handle.endSec,
      startedAt: handle.startedAt,
      tempoFactor,
    }
    setDemoNow(handle.originSec)
    setDemo(kind)

    // Jump practice cursor to first note of the demo range
    const firstIdx = steps.findIndex((s) => (s[0]?.measure ?? 0) >= lo)
    if (firstIdx >= 0) setStepIdx(firstIdx)
  }

  // Demo clock
  useEffect(() => {
    if (!demo || !demoMeta.current) return
    let raf = 0
    const tick = () => {
      const meta = demoMeta.current
      if (!meta) return
      const elapsed =
        ((performance.now() - meta.startedAt) / 1000) * meta.tempoFactor
      const t = meta.originSec + elapsed
      setDemoNow(t)
      if (t >= meta.endSec) {
        stopDemo()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [demo])

  const done =
    !demo &&
    steps.length > 0 &&
    stepIdx >= steps.length - 1 &&
    step
      ? midiChordHeld(input.getHeldMidiNotes(), step)
      : !demo && stepIdx >= steps.length

  return (
    <div className="flex h-full flex-col bg-ink">
      <Header
        title={title}
        status={demo ? `Demo · ${demo === 'line' ? 'line' : 'bar'}` : input.getStatus()}
        onExit={() => {
          stopDemo()
          onExit()
        }}
      />
      <PieceControlsBar
        controls={controls}
        measureCount={parsed.measureCount}
        hasTwoHands={parsed.hasTwoHands}
        onChange={onControls}
      />
      <div className="flex flex-wrap gap-2 px-4 pt-2">
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
        <span className="mx-1 w-px self-stretch bg-dust/30" />
        {demo ? (
          <button
            type="button"
            onClick={stopDemo}
            className="min-h-12 bg-felt px-4 font-ui text-ivory"
          >
            Stop demo
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void startDemo('line')}
              className="min-h-12 bg-shadow px-4 font-ui text-ivory"
            >
              Play line ({lineStart}–{lineEnd})
            </button>
            <button
              type="button"
              onClick={() => void startDemo('bar')}
              className="min-h-12 bg-shadow px-4 font-ui text-ivory"
            >
              Play bar {displayMeasure}
            </button>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {(view === 'staff' || view === 'both') && (
          <StaffNotation
            notes={notes}
            measure={displayMeasure}
            activeNotes={activeNotes}
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
          ) : done ? (
            <p className="font-display text-4xl text-brass">Loop complete</p>
          ) : (
            <>
              <p className="font-ui text-sm text-dust">
                {demo ? 'Demo' : 'Your turn'} · Step {stepIdx + 1} / {steps.length} ·
                bar {displayMeasure}
              </p>
              <p
                className="mt-2 font-display font-bold text-ivory"
                style={{ fontSize: '8vh' }}
              >
                {activeNotes.length
                  ? midiNames(activeNotes.map((n) => n.midi))
                  : '—'}
              </p>
              <p className="mt-2 font-ui text-dust">
                {demo
                  ? 'Watch the highlight — this is how it sounds'
                  : input.id === 'midi'
                    ? activeNotes.length > 1
                      ? `Hold all ${activeNotes.length} notes together`
                      : 'Play this note on the Kawai'
                    : 'Switch to MIDI for auto-advance — or use Skip'}
              </p>
            </>
          )}
        </div>
        <div className="flex gap-3 pb-4">
          <button
            type="button"
            disabled={!!demo}
            className="min-h-16 flex-1 bg-shadow font-ui text-ivory disabled:opacity-40"
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          >
            Back
          </button>
          <button
            type="button"
            disabled={!!demo}
            className="min-h-16 flex-1 bg-brass font-ui text-ink disabled:opacity-40"
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
