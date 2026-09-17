import { useEffect, useMemo, useRef, useState } from 'react'
import type { InputSource } from '../input'
import { PianoBar } from '../pieces/PianoBar'
import { preloadPiano } from '../pieces/pianoPlayer'
import {
  formatNoteName,
  inversionVoicingCorrect,
  pitchClass,
  pitchClassesMatchChord,
  spellChord,
  type NoteName,
} from '../theory'
import { DrillFrame } from './DrillFrame'
import { drillActiveKeys, notesToMidi, playChordDemo } from './drillMidi'
import { SelfReportButtons } from './SelfReportButtons'

type Quality = 'major' | 'minor' | 'sus4' | 'dom7' | 'maj7' | 'm7'

const CARDS: {
  symbol: string
  gloss: string
  root: NoteName
  quality: Quality
  bass?: NoteName
}[] = [
  {
    symbol: 'G/B',
    gloss: 'G major with B on the bottom',
    root: { letter: 'G', accidental: '' },
    quality: 'major',
    bass: { letter: 'B', accidental: '' },
  },
  {
    symbol: 'C/E',
    gloss: 'C major with E on the bottom',
    root: { letter: 'C', accidental: '' },
    quality: 'major',
    bass: { letter: 'E', accidental: '' },
  },
  {
    symbol: 'Dsus4',
    gloss: 'D with G instead of F♯',
    root: { letter: 'D', accidental: '' },
    quality: 'sus4',
  },
  {
    symbol: 'Am7',
    gloss: 'A minor seventh',
    root: { letter: 'A', accidental: '' },
    quality: 'm7',
  },
  {
    symbol: 'Fmaj7',
    gloss: 'F major seventh',
    root: { letter: 'F', accidental: '' },
    quality: 'maj7',
  },
  {
    symbol: 'B♭',
    gloss: 'B flat major',
    root: { letter: 'B', accidental: 'b' },
    quality: 'major',
  },
  {
    symbol: 'D/F♯',
    gloss: 'D major with F♯ in the bass',
    root: { letter: 'D', accidental: '' },
    quality: 'major',
    bass: { letter: 'F', accidental: '#' },
  },
  {
    symbol: 'C7',
    gloss: 'C dominant seventh',
    root: { letter: 'C', accidental: '' },
    quality: 'dom7',
  },
]

function pick() {
  return CARDS[Math.floor(Math.random() * CARDS.length)]!
}

function voicingFor(card: (typeof CARDS)[number]): NoteName[] {
  const spelled = spellChord(card.root, card.quality)
  if (!card.bass) return spelled.notes
  const bassPc = pitchClass(card.bass)
  const idx = spelled.notes.findIndex((n) => pitchClass(n) === bassPc)
  if (idx <= 0) return spelled.notes
  const copy = [...spelled.notes]
  return [...copy.slice(idx), ...copy.slice(0, idx)]
}

export function SlashChordDrill({
  input,
  onExit,
}: {
  input: InputSource
  onExit: () => void
}) {
  const [card, setCard] = useState(pick)
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
  const cardRef = useRef(card)
  cardRef.current = card
  const revealedRef = useRef(revealed)
  revealedRef.current = revealed

  const notes = useMemo(() => voicingFor(card), [card])
  const targetMidi = useMemo(() => notesToMidi(notes, 4), [notes])
  const autoMidi = input.id === 'midi' && input.supportsAutomaticGrade()

  const activeKeys = useMemo(() => {
    const targets = revealed || flash !== null ? targetMidi : []
    return drillActiveKeys(heldMidi, targets, 'right')
  }, [heldMidi, targetMidi, revealed, flash])

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
      setCard(pick())
      setRevealed(false)
      setFlash(null)
    }, 900)
  }

  const onPlayIt = async () => {
    if (playing) return
    stopDemo.current?.()
    setPlaying(true)
    try {
      const { stop } = await playChordDemo(voicingFor(cardRef.current), 4)
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
      if (gradingLock.current || revealedRef.current) return
      if (held.length === 0) return
      const c = cardRef.current
      const voiced = voicingFor(c)
      const need = spellChord(c.root, c.quality).pitchClasses
      const match = c.bass
        ? inversionVoicingCorrect(held, voiced, c.bass)
        : pitchClassesMatchChord(pcs, need)
      if (match) {
        gradingLock.current = true
        next(true)
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
          <p className="bg-brass px-4 py-2 text-center font-ui text-ink">Hit</p>
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
            className="min-h-16 flex-1 bg-shadow font-ui text-lg text-ivory disabled:opacity-60"
          >
            {playing ? 'Playing…' : 'Play it'}
          </button>
          {autoMidi && !revealed ? (
            <p className="w-full text-center font-ui text-dust">
              Play the chord
              {card.bass
                ? ` — bass ${formatNoteName(card.bass)}`
                : ''}{' '}
              · MIDI grades automatically
            </p>
          ) : (
            <SelfReportButtons
              onShow={revealed ? undefined : () => setRevealed(true)}
              showOnlyGrade={revealed}
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
        style={{ fontSize: '18vh' }}
      >
        {card.symbol}
      </p>
      {revealed && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="font-ui text-ivory">{card.gloss}</p>
          <p className="font-ui text-dust">
            {notes.map(formatNoteName).join(' · ')}
            {card.bass ? ` · bass ${formatNoteName(card.bass)}` : ''}
          </p>
        </div>
      )}
    </DrillFrame>
  )
}
