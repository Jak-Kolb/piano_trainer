import type { HandFilter } from '../types'
import type { PerformTap, PracticeMode } from './options'

export type RunState = 'idle' | 'loading' | 'running' | 'paused'

interface Props {
  mode: PracticeMode
  onMode: (m: PracticeMode) => void
  run: RunState
  /** Listen / Play along: start or resume. */
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  /** Hear just this bar or line (Learn and Listen). */
  onPreview: (what: 'bar' | 'line') => void
  tempo: number
  /** Next tempo when speed-up is on and not yet at the target. */
  tempoTarget: number | null
  onTempo: (t: number) => void
  hands: HandFilter
  /** Not given in Perform, which always plays both hands (the control hides). */
  onHands?: (h: HandFilter) => void
  /** Perform only: what each press plays. */
  tap?: PerformTap
  onTap?: (t: PerformTap) => void
  range: { start: number; end: number } | null
  onClearRange: () => void
}

const MODES: [PracticeMode, string, string][] = [
  ['learn', 'Learn', 'Waits for you to play each step'],
  ['play', 'Play along', 'Keeps time; grades each note'],
  ['listen', 'Listen', 'Hear the piece played'],
  ['perform', 'Perform', 'Any key plays the next notes, in your rhythm and touch'],
]

/** One row: mode, what to do in it, the range, tempo and hands. */
export function TransportBar({
  mode,
  onMode,
  run,
  onPlay,
  onPause,
  onStop,
  onPreview,
  tempo,
  tempoTarget,
  onTempo,
  hands,
  onHands,
  tap,
  onTap,
  range,
  onClearRange,
}: Props) {
  const busy = run === 'running' || run === 'paused' || run === 'loading'
  return (
    <div className="transport">
      <div className="seg" role="radiogroup" aria-label="Practice mode">
        {MODES.map(([id, label, hint]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            title={hint}
            disabled={busy && mode !== id}
            className={`seg-btn${mode === id ? ' seg-btn--on' : ''}`}
            onClick={() => onMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="transport-actions">
        {(mode === 'learn' || mode === 'perform') && run === 'idle' && (
          <>
            <button type="button" className="btn btn-secondary h-9" onClick={() => onPreview('bar')}>
              Hear bar
            </button>
            <button type="button" className="btn btn-secondary h-9" onClick={() => onPreview('line')}>
              Hear line
            </button>
          </>
        )}
        {(mode === 'play' || mode === 'listen') && run === 'idle' && (
          <button type="button" className="btn btn-primary h-9 px-5" onClick={onPlay}>
            {mode === 'play' ? 'Start' : 'Play'}
          </button>
        )}
        {mode === 'listen' && run === 'idle' && (
          <>
            <button type="button" className="btn btn-secondary h-9" onClick={() => onPreview('bar')}>
              Bar
            </button>
            <button type="button" className="btn btn-secondary h-9" onClick={() => onPreview('line')}>
              Line
            </button>
          </>
        )}
        {run === 'loading' && (
          <button type="button" className="btn btn-secondary h-9" disabled>
            Loading…
          </button>
        )}
        {(run === 'running' || run === 'paused') && (
          <>
            {mode !== 'play' && (
              <button
                type="button"
                className="btn btn-primary h-9 px-5"
                onClick={run === 'paused' ? onPlay : onPause}
              >
                {run === 'paused' ? 'Resume' : 'Pause'}
              </button>
            )}
            <button type="button" className="btn btn-secondary h-9" onClick={onStop}>
              Stop
            </button>
          </>
        )}
      </div>

      <span className="transport-spacer" />

      {range ? (
        <span className="range-chip" title="Drag across bars on the sheet or the bar strip to change; click a bar to clear">
          Bars {range.start}–{range.end}
          <button type="button" className="range-chip-clear" aria-label="Practise the whole piece" onClick={onClearRange}>
            ×
          </button>
        </span>
      ) : (
        <span className="range-chip range-chip--hint" title="Drag across bars on the sheet or the bar strip to practise part of the piece">
          Whole piece
        </span>
      )}

      <label className="tempo-control" title="Tempo">
        <span className="tempo-value">
          {tempo}%{tempoTarget !== null && <span className="tempo-next"> · next {tempoTarget}%</span>}
        </span>
        <input
          type="range"
          min={40}
          max={140}
          step={5}
          value={tempo}
          disabled={busy}
          onChange={(e) => onTempo(Number(e.target.value))}
          aria-label="Tempo percent"
        />
      </label>

      {onTap && (
        <div className="seg seg--small" role="radiogroup" aria-label="Press for">
          {(
            [
              ['note', 'Every note', 'Press for each new note'],
              ['beat', 'Every beat', 'Press a steady beat; the notes inside each beat play by themselves'],
            ] as [PerformTap, string, string][]
          ).map(([id, label, hint]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={tap === id}
              title={hint}
              className={`seg-btn${tap === id ? ' seg-btn--on' : ''}`}
              onClick={() => onTap(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {onHands && (
        <div className="seg seg--small" role="radiogroup" aria-label="Hands">
          {(
            [
              ['both', 'Both'],
              ['right', 'RH'],
              ['left', 'LH'],
            ] as [HandFilter, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={hands === id}
              disabled={busy}
              className={`seg-btn${hands === id ? ' seg-btn--on' : ''}`}
              onClick={() => onHands(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
