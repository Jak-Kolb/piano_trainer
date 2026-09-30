import { useEffect, useRef, useState } from 'react'
import type { InputSource } from '../../input'
import { preloadPiano } from '../../pieces/pianoPlayer'
import { formatNoteName, formatPitch } from '../../theory'
import { playSequenceDemo } from '../drillMidi'
import { hasKeyboard, useKeyboard, type RunResult } from './keyboard'
import { Keys } from './shared'
import type { NotePass } from './tasks'

interface Props {
  input: InputSource
  passes: NotePass[]
  onDone: (r: RunResult) => void
}

/**
 * Scales and arpeggios note by note: only the exact key (right octave)
 * moves on, any other key counts as wrong. Without a keyboard, tick off
 * each pass.
 */
export function NoteRun({ input, passes, onDone }: Props) {
  const [passIdx, setPassIdx] = useState(0)
  const [step, setStep] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [playing, setPlaying] = useState(false)
  const stopDemo = useRef<(() => void) | null>(null)
  const pass = passes[passIdx]!
  const target = pass.notes[step]
  const keyboard = hasKeyboard(input)

  const state = useRef({ passIdx, step, wrong })
  state.current = { passIdx, step, wrong }

  useEffect(() => {
    preloadPiano()
    return () => stopDemo.current?.()
  }, [])

  const finishPass = () => {
    const { passIdx: i, wrong: w } = state.current
    if (i + 1 < passes.length) {
      setPassIdx(i + 1)
      setStep(0)
      return
    }
    const notes = passes.reduce((a, p) => a + p.notes.length, 0)
    onDone({
      line: keyboard
        ? w === 0
          ? `${passes.length} clean runs`
          : `${passes.length} runs · ${w} wrong ${w === 1 ? 'note' : 'notes'}`
        : `${passes.length} runs`,
      score: keyboard ? Math.max(0, 1 - w / notes) : 1,
    })
  }

  const held = useKeyboard(input, {
    onPress: (midi) => {
      const { passIdx: i, step: s } = state.current
      const want = passes[i]?.notes[s]
      if (!want) return
      if (midi !== want.midi) {
        setWrong((w) => w + 1)
        return
      }
      if (s + 1 < passes[i]!.notes.length) setStep(s + 1)
      else finishPass()
    },
  })

  const playIt = async () => {
    if (playing) return
    stopDemo.current?.()
    setPlaying(true)
    try {
      const { stop } = await playSequenceDemo(pass.notes.map((n) => n.midi), 0.3)
      stopDemo.current = stop
      window.setTimeout(() => setPlaying(false), pass.notes.length * 300 + 400)
    } catch {
      setPlaying(false)
    }
  }

  return (
    <div className="run">
      <div className="run-body">
        <p className="run-label">{pass.label}</p>
        <div className="note-strip">
          {pass.notes.map((n, i) => (
            <span
              key={i}
              className={`note-box${i === step && keyboard ? ' note-box--now' : ''}${i < step && keyboard ? ' note-box--done' : ''}`}
            >
              <span className="note-box-name">{formatNoteName(n)}</span>
              {pass.fingers && <span className="note-box-finger">{pass.fingers[i]}</span>}
            </span>
          ))}
        </div>
        <p className="run-hint">
          {keyboard && target
            ? `Next: ${formatPitch(target)}${pass.fingers ? ` with finger ${pass.fingers[step]}` : ''}`
            : 'Play it up and back down, then tick it off.'}
        </p>
        {keyboard && wrong > 0 && <p className="run-count">{wrong} wrong so far</p>}
      </div>
      <Keys
        held={held}
        targets={target ? [target.midi] : []}
        showTargets
        exact
        hand={pass.hand}
      />
      <div className="run-actions">
        <button type="button" className="btn btn-secondary" disabled={playing} onClick={() => void playIt()}>
          {playing ? 'Playing…' : 'Hear it'}
        </button>
        {!keyboard && (
          <button type="button" className="btn btn-primary" onClick={finishPass}>
            Played it
          </button>
        )}
      </div>
    </div>
  )
}
