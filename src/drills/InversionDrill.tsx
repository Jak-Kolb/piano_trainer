import { useEffect, useMemo, useRef, useState } from 'react'
import type { InputSource } from '../input'
import { PianoBar } from '../pieces/PianoBar'
import { preloadPiano } from '../pieces/pianoPlayer'
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
import { drillActiveKeys, notesToMidi, playChordDemo } from './drillMidi'
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
  const [hits, setHits] = useState(0)
  const [tries, setTries] = useState(0)
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null)
  const [heard, setHeard] = useState('')
  const [heldMidi, setHeldMidi] = useState<number[]>([])
  const [playing, setPlaying] = useState(false)
  const gradingLock = useRef(false)
  const stopDemo = useRef<(() => void) | null>(null)
  const promptRef = useRef(prompt)
  promptRef.current = prompt
  const revealedRef = useRef(revealed)
  revealedRef.current = revealed

  const title = useMemo(
    () => `${prompt.symbol} · ${prompt.invLabel}`,
    [prompt],
  )

  const targetMidi = useMemo(() => notesToMidi(prompt.notes, 4), [prompt.notes])

  const activeKeys = useMemo(() => {
    const targets = revealed || flash !== null ? targetMidi : []
    return drillActiveKeys(heldMidi, targets, 'right')
  }, [heldMidi, targetMidi, revealed, flash])

  const autoMidi = input.id === 'midi' && input.supportsAutomaticGrade()

  useEffect(() => {
    preloadPiano()
    return () => stopDemo.current?.()
  }, [])

  const next = (hit: boolean) => {
    setStreak((s) => (hit ? s + 1 : 0))
    setHits((h) => h + (hit ? 1 : 0))
    setTries((t) => t + 1)
    setFlash(hit ? 'hit' : 'miss')
    setRevealed(true)
    window.setTimeout(() => {
      gradingLock.current = false
      setPrompt(draw())
      setRevealed(false)
      setFlash(null)
    }, 900)
  }

  const onPlayIt = async () => {
    if (playing) return
    stopDemo.current?.()
    setPlaying(true)
    try {
      const { stop } = await playChordDemo(promptRef.current.notes, 4)
      stopDemo.current = stop
      window.setTimeout(() => setPlaying(false), 1600)
    } catch {
      setPlaying(false)
    }
  }

  useEffect(() => {
    return input.onChange(() => {
      const held = input.getHeldMidiNotes()
      const pcs = input.getHeldPitchClasses()
      setHeldMidi(held)
      setHeard(
        held.length
          ? `Hearing ${held.length} note${held.length === 1 ? '' : 's'}`
          : input.getStatus(),
      )
      if (!autoMidi) return
      if (gradingLock.current) return
      if (revealedRef.current) return
      if (held.length === 0) return
      const p = promptRef.current
      if (inversionVoicingCorrect(held, p.notes, p.bass)) {
        gradingLock.current = true
        next(true)
      } else if (pcs.length >= 3) {
        // Wrong bass / voicing — wait for correct or Show me / Miss
      }
    })
  }, [autoMidi, input])

  const accuracy =
    tries === 0 ? undefined : `${Math.round((hits / tries) * 100)}%`

  return (
    <DrillFrame
      status={heard || input.getStatus()}
      streak={streak}
      accuracy={accuracy}
      onExit={onExit}
      banner={
        flash === 'hit' ? (
          <p className="bg-brass px-4 py-2 text-center font-ui text-on-accent">Hit</p>
        ) : flash === 'miss' ? (
          <p className="bg-felt px-4 py-2 text-center font-ui text-ivory">Miss</p>
        ) : undefined
      }
      keyboard={<PianoBar activeKeys={activeKeys} lowMidi={48} highMidi={84} />}
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
          {autoMidi && !revealed ? (
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
          )}
        </>
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
        <p className="mt-3 text-center font-ui text-ivory">
          Bass {formatNoteName(prompt.bass)} ·{' '}
          {prompt.notes.map((n) => formatNoteName(n)).join(' ')}
        </p>
      )}
    </DrillFrame>
  )
}
