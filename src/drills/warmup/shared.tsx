/** Pieces shared by the warmup runners and the Theory / Progressions drills. */
import type { ReactNode } from 'react'
import { PianoBar, type ActiveKey } from '../../pieces/PianoBar'
import type { HeldState } from '../../pieces/practice/learn'

const pc = (m: number) => ((m % 12) + 12) % 12

/**
 * On-screen piano: `targets` light up (when shown), held keys ring green
 * when they belong and red when they don't.
 */
export function Keys({
  held,
  targets,
  showTargets,
  wantPcs = [],
  exact = false,
  hand = 'right',
}: {
  held: number[]
  targets: number[]
  showTargets: boolean
  /** Pitch classes that count as right for held keys. */
  wantPcs?: number[]
  /** Only the target keys themselves count as right (not the same note in another octave). */
  exact?: boolean
  hand?: 'right' | 'left'
}) {
  const active: ActiveKey[] = showTargets ? targets.map((midi) => ({ midi, hand })) : []
  const want = new Set(wantPcs)
  const states = new Map<number, HeldState>(
    held.map((m) => [m, (exact ? targets.includes(m) : want.has(pc(m))) ? 'good' : 'wrong']),
  )
  return <PianoBar activeKeys={active} held={states} lowMidi={36} highMidi={84} />
}

/** Top bar for the warmup and the standalone drills. */
export function RunTop({
  onExit,
  title,
  detail,
  right,
}: {
  onExit: () => void
  title: string
  detail?: string
  right?: ReactNode
}) {
  return (
    <header className="run-top">
      <button type="button" className="btn btn-ghost" onClick={onExit}>
        Exit
      </button>
      <div className="run-top-title">
        <span className="run-top-name">{title}</span>
        {detail && <span className="run-top-detail">{detail}</span>}
      </div>
      <div className="run-top-right">{right}</div>
    </header>
  )
}

/** Key chips (the six keys with verified fingerings). */
export function KeyChips({
  keys,
  value,
  onChange,
}: {
  keys: readonly string[]
  value: string
  onChange: (k: string) => void
}) {
  return (
    <div className="seg" role="radiogroup" aria-label="Key">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          className={`seg-btn${value === k ? ' seg-btn--on' : ''}`}
          onClick={() => onChange(k)}
        >
          {k.replace(' major', '')}
        </button>
      ))}
    </div>
  )
}
