import type { HandFilter } from '../types'
import type { PracticeMode } from './options'

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
  onHands: (h: HandFilter) => void
  range: { start: number; end: number } | null
  onClearRange: () => void
}

const MODES: [PracticeMode, string, string][] = [
  ['learn', 'Learn', 'Waits for you to play each step'],
  ['play', 'Play along', 'Keeps time; grades each note'],
  ['listen', 'Listen', 'Hear the piece played'],
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
        {mode === 'learn' && run === 'idle' && (
          <>
            <button type="button" className="btn btn-secondary h-9" onClick={() => onPreview('bar')}>
              Hear bar
            </button>
            <button type="button" className="btn btn-secondary h-9" onClick={() => onPreview('line')}>
              Hear line
            </button>
          </>
        )}
        {mode !== 'learn' && run === 'idle' && (
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
        <span className="range-chip" title="Drag on the bar strip (or shift-click bars) to change">
          Bars {range.start}–{range.end}
          <button type="button" className="range-chip-clear" aria-label="Practise the whole piece" onClick={onClearRange}>
            ×
          </button>
        </span>
      ) : (
        <span className="range-chip range-chip--hint" title="Drag on the bar strip (or shift-click bars) to practise part of the piece">
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
    </div>
  )
}
