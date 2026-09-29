import { useEffect, useMemo, useState } from 'react'
import type { InputSource } from '../../input'
import { loadProgress, markPracticeToday, saveProgress } from '../../storage/progress'
import { ChordRun } from './ChordRun'
import { NoteRun } from './NoteRun'
import { hasKeyboard, type RunResult } from './keyboard'
import { KeyChips, RunTop } from './shared'
import {
  arpeggioPasses,
  inversionTasks,
  keyOfTheDay,
  progressionOfTheDay,
  progressionTasks,
  scalePasses,
  triadTasks,
  WARMUP_KEYS,
} from './tasks'
import { theoryQuestions } from './theoryQuiz'
import { TheoryRun } from './TheoryRun'

interface Props {
  input: InputSource
  onExit: () => void
}

type Kind = 'scale' | 'arpeggio' | 'triads' | 'inversions' | 'progression' | 'theory'

interface Section {
  kind: Kind
  title: string
  blurb: string
  minutes: number
}

/** About ten minutes, technique first, then chords, then theory. */
const SECTIONS: Section[] = [
  { kind: 'scale', title: 'Scale', blurb: 'One octave up and down, each hand, with fingering', minutes: 2 },
  { kind: 'arpeggio', title: 'Arpeggio', blurb: 'The same key’s arpeggio, each hand', minutes: 1.5 },
  { kind: 'triads', title: 'Triads', blurb: 'Chord symbols: mostly the key’s own chords', minutes: 2 },
  { kind: 'inversions', title: 'Inversions', blurb: 'Root, 1st and 2nd inversion: exact lowest note', minutes: 1.5 },
  { kind: 'progression', title: 'Progression', blurb: 'A common progression, then again from the numerals', minutes: 1.5 },
  { kind: 'theory', title: 'Theory', blurb: 'Intervals, key signatures, scale degrees, chord names', minutes: 1.5 },
]

const TOTAL_MIN = SECTIONS.reduce((a, s) => a + s.minutes, 0)

function clock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export function WarmupSession({ input, onExit }: Props) {
  const [key, setKey] = useState(() => keyOfTheDay())
  const [phase, setPhase] = useState<'intro' | 'run' | 'done'>('intro')
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<(RunResult | null)[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [today] = useState(() => new Date())
  const progression = useMemo(() => progressionOfTheDay(today), [today])

  // Fresh exercises each time the warmup starts (or the key changes).
  const [round, setRound] = useState(0)
  const content = useMemo(() => {
    void round
    return {
      scale: scalePasses(key),
      arpeggio: arpeggioPasses(key),
      triads: triadTasks(key, 10),
      inversions: inversionTasks(key, 8),
      progression: progressionTasks(key, progression),
      theory: theoryQuestions(key, 6),
    }
  }, [key, progression, round])

  useEffect(() => {
    if (phase !== 'run') return
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [phase])

  const start = () => {
    saveProgress(markPracticeToday(loadProgress()))
    setRound((r) => r + 1)
    setResults([])
    setElapsed(0)
    setIdx(0)
    setPhase('run')
  }

  const finish = (r: RunResult | null) => {
    const next = [...results]
    next[idx] = r
    setResults(next)
    if (idx + 1 < SECTIONS.length) setIdx(idx + 1)
    else setPhase('done')
  }

  if (phase === 'intro') {
    return (
      <div className="run-page">
        <RunTop onExit={onExit} title="10-minute warmup" />
        <main className="warmup-intro">
          <p className="warmup-kicker">Today’s key</p>
          <h1 className="warmup-key">{key}</h1>
          <KeyChips keys={WARMUP_KEYS} value={key} onChange={setKey} />
          <ol className="warmup-plan">
            {SECTIONS.map((s, i) => (
              <li key={s.kind}>
                <span className="warmup-plan-num">{i + 1}</span>
                <span className="warmup-plan-text">
                  <span className="warmup-plan-title">
                    {s.title}
                    {s.kind === 'progression' && ` · ${progression.name}`}
                  </span>
                  <span className="warmup-plan-blurb">{s.blurb}</span>
                </span>
                <span className="warmup-plan-min">{s.minutes} min</span>
              </li>
            ))}
          </ol>
          {!hasKeyboard(input) && (
            <p className="warmup-note">
              No keyboard connected: you can still follow along and mark each exercise yourself.
            </p>
          )}
          <button type="button" className="btn btn-primary warmup-start" onClick={start}>
            Start warmup
          </button>
        </main>
      </div>
    )
  }

  if (phase === 'done') {
    const tomorrow = keyOfTheDay(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
    )
    return (
      <div className="run-page">
        <RunTop onExit={onExit} title="10-minute warmup" detail={key} />
        <main className="warmup-intro">
          <h1 className="warmup-key">Warmed up</h1>
          <p className="warmup-kicker">
            {clock(elapsed)} · {key}
          </p>
          <ul className="warmup-results">
            {SECTIONS.map((s, i) => {
              const r = results[i]
              return (
                <li key={s.kind}>
                  <span className="warmup-plan-title">{s.title}</span>
                  <span
                    className={`warmup-result${r ? (r.score >= 0.85 ? ' warmup-result--good' : r.score < 0.6 ? ' warmup-result--low' : '') : ' warmup-result--skipped'}`}
                  >
                    {r ? r.line : 'skipped'}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="warmup-note">Tomorrow’s key: {tomorrow}</p>
          <div className="warmup-done-actions">
            <button type="button" className="btn btn-primary" onClick={onExit}>
              Done
            </button>
            <button type="button" className="btn btn-secondary" onClick={start}>
              Go again
            </button>
          </div>
        </main>
      </div>
    )
  }

  const section = SECTIONS[idx]!
  return (
    <div className="run-page">
      <RunTop
        onExit={onExit}
        title={`${section.title} · ${key}`}
        detail={`Part ${idx + 1} of ${SECTIONS.length}`}
        right={
          <>
            <span className={`run-clock${elapsed > TOTAL_MIN * 60 ? ' run-clock--over' : ''}`}>
              {clock(elapsed)} / {clock(TOTAL_MIN * 60)}
            </span>
            <button type="button" className="btn btn-ghost" onClick={() => finish(null)}>
              Skip section
            </button>
          </>
        }
      />
      <div className="warmup-steps" aria-hidden>
        {SECTIONS.map((s, i) => (
          <span
            key={s.kind}
            className={`warmup-step${i === idx ? ' warmup-step--now' : i < idx ? ' warmup-step--done' : ''}`}
          />
        ))}
      </div>
      {section.kind === 'scale' && <NoteRun key={`s${round}`} input={input} passes={content.scale} onDone={finish} />}
      {section.kind === 'arpeggio' && <NoteRun key={`a${round}`} input={input} passes={content.arpeggio} onDone={finish} />}
      {section.kind === 'triads' && (
        <ChordRun key={`t${round}`} input={input} tasks={content.triads} layout="single" onDone={finish} />
      )}
      {section.kind === 'inversions' && (
        <ChordRun key={`i${round}`} input={input} tasks={content.inversions} layout="single" onDone={finish} />
      )}
      {section.kind === 'progression' && (
        <ChordRun
          key={`p${round}`}
          input={input}
          tasks={content.progression}
          layout="row"
          passes={2}
          heading={`${progression.name} in ${key}`}
          onDone={finish}
        />
      )}
      {section.kind === 'theory' && <TheoryRun key={`q${round}`} input={input} questions={content.theory} onDone={finish} />}
    </div>
  )
}
