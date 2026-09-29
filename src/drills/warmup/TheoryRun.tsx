import { useEffect, useRef, useState } from 'react'
import type { InputSource } from '../../input'
import { formatNoteName, pitchClass, pitchClassesMatchChord } from '../../theory'
import { notesToMidi } from '../drillMidi'
import { hasKeyboard, useKeyboard, type RunResult } from './keyboard'
import { Keys } from './shared'
import type { TheoryQuestion } from './theoryQuiz'

interface Props {
  input: InputSource
  questions: TheoryQuestion[]
  onDone: (r: RunResult) => void
}

type Outcome = 'right' | 'wrong' | null

const pc = (m: number) => ((m % 12) + 12) % 12

/** One wrong answer gets another try; the second shows the answer. */
const TRIES = 2

export function TheoryRun({ input, questions, onDone }: Props) {
  const [idx, setIdx] = useState(0)
  const [tries, setTries] = useState(0)
  const [outcome, setOutcome] = useState<Outcome>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [right, setRight] = useState(0)
  const timer = useRef<number | null>(null)
  const keyboard = hasKeyboard(input)
  const q = questions[idx]!
  const answered = outcome !== null

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  const next = (rightSoFar = right) => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    if (idx + 1 >= questions.length) {
      onDone({ line: `${rightSoFar} of ${questions.length} right`, score: rightSoFar / questions.length })
      return
    }
    setIdx(idx + 1)
    setTries(0)
    setOutcome(null)
    setPicked(null)
  }

  /** Right on the first try scores; either way, show why. */
  const answer = (correct: boolean) => {
    if (answered) return
    if (correct) {
      const score = right + (tries === 0 ? 1 : 0)
      setRight(score)
      setOutcome('right')
      timer.current = window.setTimeout(() => next(score), 2200)
      return
    }
    if (tries + 1 < TRIES) {
      setTries(tries + 1)
      return
    }
    setOutcome('wrong')
  }

  // Chord answers are judged on what's held once it's the chord's size.
  const chordLatched = useRef(false)
  const held = useKeyboard(input, {
    onPress: (midi) => {
      if (answered || q.kind !== 'note') return
      answer(pc(midi) === pitchClass(q.answer))
    },
    onHeld: (now) => {
      if (q.kind !== 'chord' || answered) return
      if (!now.length) {
        chordLatched.current = false
        return
      }
      const pcs = now.map(pc)
      if (pitchClassesMatchChord(pcs, q.answer.pcs)) answer(true)
      else if (new Set(pcs).size >= q.answer.pcs.length && !chordLatched.current) {
        chordLatched.current = true
        answer(false)
      }
    },
  })

  const targetMidi =
    q.kind === 'note'
      ? notesToMidi([q.answer], 4)
      : q.kind === 'chord'
        ? notesToMidi(q.answer.notes, 4)
        : []
  const wantPcs =
    q.kind === 'note' ? [pitchClass(q.answer)] : q.kind === 'chord' ? q.answer.pcs : []
  const answerText =
    q.kind === 'note'
      ? formatNoteName(q.answer)
      : q.kind === 'chord'
        ? `${q.answer.symbol}: ${q.answer.notes.map(formatNoteName).join(' ')}`
        : q.options[q.answer]!

  return (
    <div className={`run${outcome === 'right' ? ' run--hit' : ''}`}>
      <div className="run-body">
        <p className="theory-prompt">{q.prompt}</p>
        {q.kind === 'choice' && (
          <div className="choice-grid">
            {q.options.map((o, i) => {
              const state =
                answered && i === q.answer
                  ? ' choice--right'
                  : picked === i && (answered || tries > 0)
                    ? ' choice--wrong'
                    : ''
              return (
                <button
                  key={o}
                  type="button"
                  disabled={answered}
                  className={`choice${state}`}
                  onClick={() => {
                    setPicked(i)
                    answer(i === q.answer)
                  }}
                >
                  {o}
                </button>
              )
            })}
          </div>
        )}
        {q.kind !== 'choice' && !answered && (
          <p className="run-hint">
            {keyboard
              ? q.kind === 'note'
                ? 'Play it on your keyboard (any octave).'
                : 'Play the chord on your keyboard (any voicing).'
              : 'Work it out, then check.'}
          </p>
        )}
        {!answered && tries > 0 && <p className="run-count">Not quite. One more try.</p>}
        {answered && (
          <div className={`explain${outcome === 'right' ? ' explain--right' : ''}`}>
            <p className="explain-head">{outcome === 'right' ? 'Right' : `Answer: ${answerText}`}</p>
            <p>{q.explain}</p>
          </div>
        )}
        <p className="run-count">
          {idx + 1} / {questions.length}
        </p>
      </div>
      {q.kind !== 'choice' && (
        <Keys held={held} targets={targetMidi} showTargets={answered} wantPcs={answered ? wantPcs : held.map(pc)} />
      )}
      <div className="run-actions">
        {!keyboard && q.kind !== 'choice' && !answered && (
          <button type="button" className="btn btn-secondary" onClick={() => setOutcome('wrong')}>
            Show answer
          </button>
        )}
        {!keyboard && q.kind !== 'choice' && outcome === 'wrong' && tries === 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const score = right + 1
              setRight(score)
              next(score)
            }}
          >
            I had it
          </button>
        )}
        {answered && (
          <button type="button" className="btn btn-primary" onClick={() => next()}>
            Next
          </button>
        )}
      </div>
    </div>
  )
}
