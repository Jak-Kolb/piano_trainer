import { useEffect, useRef, useState } from 'react'
import type { InputSource } from '../../input'
import { preloadPiano } from '../../pieces/pianoPlayer'
import { formatNoteName, inversionVoicingCorrect, pitchClassesMatchChord } from '../../theory'
import { notesToMidi, playChordDemo } from '../drillMidi'
import { hasKeyboard, useKeyboard, type RunResult } from './keyboard'
import { Keys } from './shared'
import type { ChordTask } from './tasks'

interface Props {
  input: InputSource
  tasks: ChordTask[]
  /** "single": one big chord at a time. "row": a progression, all in view. */
  layout: 'single' | 'row'
  /** Row layout: play it this many times; after the first, names hide (numerals only). */
  passes?: number
  /** Row layout: shown above the chords, e.g. "I–V–vi–IV in G major". */
  heading?: string
  onDone: (r: RunResult) => void
}

/** Wrong full-size chords before the answer is shown. */
const REVEAL_AFTER = 2

export function ChordRun({ input, tasks, layout, passes = 1, heading, onDone }: Props) {
  const [idx, setIdx] = useState(0)
  const [pass, setPass] = useState(0)
  const [misses, setMisses] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null)
  const [firstTry, setFirstTry] = useState(0)
  const [playing, setPlaying] = useState(false)
  const attemptLatched = useRef(false)
  const locked = useRef(false)
  const stopDemo = useRef<(() => void) | null>(null)
  const keyboard = hasKeyboard(input)
  const task = tasks[idx]!
  const total = tasks.length * passes
  const done = pass * tasks.length + idx
  const fromMemory = layout === 'row' && pass > 0

  useEffect(() => {
    preloadPiano()
    return () => stopDemo.current?.()
  }, [])

  const held = useKeyboard(input, { onHeld: (now) => grade(now) })

  const advance = (clean: boolean) => {
    // Ignore a second answer while the last one is still moving on.
    if (locked.current) return
    locked.current = true
    const nextFirstTry = firstTry + (clean ? 1 : 0)
    setFirstTry(nextFirstTry)
    setFlash(clean ? 'hit' : 'miss')
    window.setTimeout(() => {
      locked.current = false
      attemptLatched.current = false
      setFlash(null)
      setMisses(0)
      setRevealed(false)
      if (idx + 1 < tasks.length) {
        setIdx(idx + 1)
      } else if (pass + 1 < passes) {
        setPass(pass + 1)
        setIdx(0)
      } else {
        onDone({
          line: `${nextFirstTry} of ${total} first try`,
          score: nextFirstTry / total,
        })
      }
    }, 550)
  }

  /** Grade each change in the held keys. */
  function grade(now: number[]) {
    if (!keyboard || locked.current) return
    if (now.length === 0) {
      attemptLatched.current = false
      return
    }
    const pcs = now.map((m) => ((m % 12) + 12) % 12)
    const right = task.bass
      ? inversionVoicingCorrect(now, task.notes, task.bass)
      : pitchClassesMatchChord(pcs, task.pcs)
    if (right) {
      advance(misses === 0 && !revealed)
      return
    }
    // A full-size chord that isn't it counts once, until you let go.
    if (new Set(pcs).size >= task.pcs.length && !attemptLatched.current) {
      attemptLatched.current = true
      const m = misses + 1
      setMisses(m)
      if (m >= REVEAL_AFTER) setRevealed(true)
    }
  }

  const playIt = async () => {
    if (playing) return
    stopDemo.current?.()
    setPlaying(true)
    try {
      const { stop } = await playChordDemo(task.notes, 4)
      stopDemo.current = stop
      window.setTimeout(() => setPlaying(false), 1500)
    } catch {
      setPlaying(false)
    }
  }

  const targetMidi = notesToMidi(task.notes, 4)
  const answer = task.notes.map(formatNoteName).join(' ')

  return (
    <div className={`run${flash === 'hit' ? ' run--hit' : flash === 'miss' ? ' run--miss' : ''}`}>
      <div className="run-body">
        {layout === 'single' ? (
          <>
            <p className="chord-big">{task.title}</p>
            {task.detail && <p className="chord-detail">{task.detail}</p>}
            {task.hint && <p className="run-hint">{task.hint}</p>}
          </>
        ) : (
          <>
            {heading && <p className="run-label">{heading}</p>}
            <div className="chord-row">
              {tasks.map((t, i) => (
                <span
                  key={t.id}
                  className={`chord-box${i === idx ? ' chord-box--now' : ''}${i < idx ? ' chord-box--done' : ''}`}
                >
                  <span className="chord-box-roman">{t.roman}</span>
                  <span className="chord-box-name">
                    {fromMemory && i >= idx && !(i === idx && revealed) ? '?' : t.title}
                  </span>
                </span>
              ))}
            </div>
            <p className="run-hint">
              {fromMemory
                ? 'Again from the numerals: work out each chord in the key.'
                : 'Play each chord in turn. Any voicing counts.'}
            </p>
          </>
        )}
        {revealed && <p className="run-answer">{answer}</p>}
        {keyboard && misses > 0 && !revealed && <p className="run-count">Not quite. Try again.</p>}
        <p className="run-count">
          {Math.min(done + 1, total)} / {total}
        </p>
      </div>
      <Keys held={held} targets={targetMidi} showTargets={revealed} wantPcs={task.pcs} />
      <div className="run-actions">
        <button type="button" className="btn btn-secondary" disabled={playing} onClick={() => void playIt()}>
          {playing ? 'Playing…' : 'Hear it'}
        </button>
        {!revealed && (
          <button type="button" className="btn btn-secondary" onClick={() => setRevealed(true)}>
            Show me
          </button>
        )}
        {!keyboard && (
          <>
            <button type="button" className="btn btn-primary" onClick={() => advance(!revealed)}>
              Got it
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => advance(false)}>
              Missed it
            </button>
          </>
        )}
      </div>
    </div>
  )
}
