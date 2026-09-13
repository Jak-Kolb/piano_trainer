import { useState } from 'react'
import { KeyboardDiagram } from '../components/KeyboardDiagram'
import type { InputSource } from '../input'
import { spellChord, type NoteName } from '../theory'
import { formatNoteName } from '../theory'
import { DrillFrame } from './DrillFrame'
import { SelfReportButtons } from './SelfReportButtons'

const CARDS: { symbol: string; gloss: string; root: NoteName; quality: 'major' | 'minor' | 'sus4' | 'dom7' | 'maj7' | 'm7'; bass?: NoteName }[] = [
  { symbol: 'G/B', gloss: 'G major with B on the bottom', root: { letter: 'G', accidental: '' }, quality: 'major', bass: { letter: 'B', accidental: '' } },
  { symbol: 'C/E', gloss: 'C major with E on the bottom', root: { letter: 'C', accidental: '' }, quality: 'major', bass: { letter: 'E', accidental: '' } },
  { symbol: 'Dsus4', gloss: 'D with G instead of F♯', root: { letter: 'D', accidental: '' }, quality: 'sus4' },
  { symbol: 'Am7', gloss: 'A minor seventh', root: { letter: 'A', accidental: '' }, quality: 'm7' },
  { symbol: 'Fmaj7', gloss: 'F major seventh', root: { letter: 'F', accidental: '' }, quality: 'maj7' },
  { symbol: 'B♭', gloss: 'B flat major', root: { letter: 'B', accidental: 'b' }, quality: 'major' },
  { symbol: 'D/F♯', gloss: 'D major with F♯ in the bass', root: { letter: 'D', accidental: '' }, quality: 'major', bass: { letter: 'F', accidental: '#' } },
  { symbol: 'C7', gloss: 'C dominant seventh', root: { letter: 'C', accidental: '' }, quality: 'dom7' },
]

function pick() {
  return CARDS[Math.floor(Math.random() * CARDS.length)]!
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
  const spelled = spellChord(card.root, card.quality)

  const next = (hit: boolean) => {
    setStreak((s) => (hit ? s + 1 : 0))
    setCard(pick())
    setRevealed(false)
  }

  return (
    <DrillFrame
      status={input.getStatus()}
      streak={streak}
      onExit={onExit}
      footer={
        <SelfReportButtons
          onShow={revealed ? undefined : () => setRevealed(true)}
          showOnlyGrade={revealed}
          onHit={() => next(true)}
          onMiss={() => next(false)}
        />
      }
    >
      <p
        className="font-display font-bold text-ivory"
        style={{ fontSize: '18vh' }}
      >
        {card.symbol}
      </p>
      {revealed && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <p className="font-ui text-ivory">{card.gloss}</p>
          <p className="font-ui text-dust">
            {spelled.notes.map(formatNoteName).join(' · ')}
            {card.bass ? ` · bass ${formatNoteName(card.bass)}` : ''}
          </p>
          <KeyboardDiagram highlight={spelled.notes} />
        </div>
      )}
    </DrillFrame>
  )
}
