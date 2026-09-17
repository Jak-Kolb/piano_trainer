import { useEffect, useMemo, useRef, useState } from 'react'
import type { InputSource } from '../input'
import { PianoBar } from '../pieces/PianoBar'
import { preloadPiano } from '../pieces/pianoPlayer'
import {
  formatNoteName,
  spellChord,
  type NoteName,
  type TriadQuality,
} from '../theory'
import { DrillFrame } from './DrillFrame'
import {
  drillActiveKeys,
  notesToMidi,
  playChordDemo,
  playSequenceDemo,
} from './drillMidi'
import { SelfReportButtons } from './SelfReportButtons'

type PatternId = 'block' | 'broken15' | 'broken1510' | 'alberti'

const PATTERNS: { id: PatternId; name: string; blurb: string }[] = [
  { id: 'block', name: 'Block', blurb: 'Root · 3rd · 5th together' },
  { id: 'broken15', name: 'Broken 1-5-8', blurb: 'Root · 5th · octave' },
  { id: 'broken1510', name: 'Broken 1-5-10', blurb: 'Root · 5th · 10th' },
  { id: 'alberti', name: 'Alberti', blurb: 'Root · 5th · 3rd · 5th' },
]

const KEYS: { label: string; root: NoteName; quality: TriadQuality }[] = [
  { label: 'C', root: { letter: 'C', accidental: '' }, quality: 'major' },
  { label: 'G', root: { letter: 'G', accidental: '' }, quality: 'major' },
  { label: 'Am', root: { letter: 'A', accidental: '' }, quality: 'minor' },
  { label: 'F', root: { letter: 'F', accidental: '' }, quality: 'major' },
  { label: 'D', root: { letter: 'D', accidental: '' }, quality: 'major' },
  { label: 'Em', root: { letter: 'E', accidental: '' }, quality: 'minor' },
]

function patternMidis(triad: number[], id: PatternId): number[] {
  const [r, third, fifth] = triad
  if (r == null || third == null || fifth == null) return triad
  const oct = r + 12
  const tenth = third + 12
  switch (id) {
    case 'block':
      return [r, third, fifth]
    case 'broken15':
      return [r, fifth, oct]
    case 'broken1510':
      return [r, fifth, tenth]
    case 'alberti':
      return [r, fifth, third, fifth]
  }
}

export function LeftHandDrill({
  input,
  onExit,
}: {
  input: InputSource
  onExit: () => void
}) {
  const [pattern, setPattern] = useState(PATTERNS[0]!)
  const [key, setKey] = useState(KEYS[0]!)
  const [streak, setStreak] = useState(0)
  const [hits, setHits] = useState(0)
  const [tries, setTries] = useState(0)
  const [heldMidi, setHeldMidi] = useState<number[]>([])
  const [playing, setPlaying] = useState(false)
  const [revealed, setRevealed] = useState(true)
  const stopDemo = useRef<(() => void) | null>(null)

  const triadNotes = useMemo(
    () => spellChord(key.root, key.quality).notes,
    [key],
  )
  const triadMidi = useMemo(() => notesToMidi(triadNotes, 3), [triadNotes])
  const demoMidis = useMemo(
    () => patternMidis(triadMidi, pattern.id),
    [triadMidi, pattern.id],
  )

  const activeKeys = useMemo(
    () =>
      drillActiveKeys(
        heldMidi,
        revealed ? demoMidis : [],
        'left',
      ),
    [heldMidi, demoMidis, revealed],
  )

  useEffect(() => {
    preloadPiano()
    return () => stopDemo.current?.()
  }, [])

  useEffect(() => {
    return input.onChange(() => {
      setHeldMidi(input.getHeldMidiNotes())
    })
  }, [input])

  const onPlayIt = async () => {
    if (playing) return
    stopDemo.current?.()
    setPlaying(true)
    try {
      const result =
        pattern.id === 'block'
          ? await playChordDemo(triadNotes, 3)
          : await playSequenceDemo(demoMidis, 0.32)
      stopDemo.current = result.stop
      const ms =
        pattern.id === 'block'
          ? 1600
          : Math.round(demoMidis.length * 320 + 400)
      window.setTimeout(() => setPlaying(false), ms)
    } catch {
      setPlaying(false)
    }
  }

  const grade = (hit: boolean) => {
    setStreak((s) => (hit ? s + 1 : 0))
    setHits((h) => h + (hit ? 1 : 0))
    setTries((t) => t + 1)
  }

  const accuracy =
    tries === 0 ? undefined : `${Math.round((hits / tries) * 100)}%`

  return (
    <DrillFrame
      status={input.getStatus()}
      streak={streak}
      accuracy={accuracy}
      onExit={onExit}
      keyboard={
        <PianoBar activeKeys={activeKeys} lowMidi={36} highMidi={72} />
      }
      footer={
        <>
          <button
            type="button"
            onClick={() => void onPlayIt()}
            disabled={playing}
            className="btn btn-secondary min-h-16 flex-1 text-lg"
          >
            {playing ? 'Playing…' : 'Play it'}
          </button>
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="btn btn-secondary min-h-16 flex-1 text-lg"
          >
            {revealed ? 'Hide keys' : 'Show keys'}
          </button>
          <SelfReportButtons
            showOnlyGrade
            onHit={() => grade(true)}
            onMiss={() => grade(false)}
          />
        </>
      }
    >
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {KEYS.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => setKey(k)}
            className={`min-h-12 px-3 font-ui ${
              key.label === k.label ? 'btn btn-chip btn-chip-active' : 'btn btn-chip btn-chip-idle'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {PATTERNS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPattern(p)}
            className={`min-h-12 px-3 font-ui ${
              pattern.id === p.id ? 'btn btn-chip btn-chip-active' : 'btn btn-chip btn-chip-idle'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>
      <p className="font-display text-5xl text-ivory">{key.label}</p>
      <p className="mt-3 font-display text-3xl text-brass">{pattern.name}</p>
      <p className="mt-4 font-ui text-xl text-dust">{pattern.blurb}</p>
      <p className="mt-3 font-ui text-sm text-dust">
        LH · {triadNotes.map(formatNoteName).join(' · ')} · loop with a
        metronome
      </p>
    </DrillFrame>
  )
}
