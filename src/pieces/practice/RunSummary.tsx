import type { RunSummary as Summary } from './grading'

interface Props {
  summary: Summary
  tempo: number
  /** Tempo for the next run, when speed-up raised it. */
  nextTempo: number | null
  graded: boolean
  onAgain: () => void
  onClose: () => void
}

function timingNote(meanMs: number): string {
  if (meanMs < -25) return `You're a little ahead of the beat (about ${Math.round(-meanMs)} ms early).`
  if (meanMs > 25) return `You're a little behind the beat (about ${Math.round(meanMs)} ms late).`
  return 'Steady timing.'
}

/** After a play-along run: how it went, in plain words. */
export function RunSummary({ summary, tempo, nextTempo, graded, onAgain, onClose }: Props) {
  const pct = Math.round(summary.accuracy * 100)
  const clean = summary.missed === 0 && summary.wrong === 0
  return (
    <div className="run-summary" role="dialog" aria-label="Run results">
      {graded ? (
        <>
          <p className="run-summary-score">
            {pct}
            <span className="run-summary-unit">%</span>
          </p>
          <p className="run-summary-line">
            {clean ? `Clean run at ${tempo}% tempo` : `At ${tempo}% tempo`}
          </p>
          <ul className="run-summary-counts">
            <li>
              <span className="dot dot--good" /> {summary.good} on time
            </li>
            <li>
              <span className="dot dot--warn" /> {summary.early} early · {summary.late} late
            </li>
            <li>
              <span className="dot dot--bad" /> {summary.missed} missed · {summary.wrong} wrong
            </li>
          </ul>
          {summary.good + summary.early + summary.late > 0 && (
            <p className="run-summary-note">{timingNote(summary.meanOffsetMs)}</p>
          )}
          {nextTempo !== null && (
            <p className="run-summary-note">Next run speeds up to {nextTempo}%.</p>
          )}
        </>
      ) : (
        <p className="run-summary-line">Run finished. Connect a MIDI keyboard to have it graded.</p>
      )}
      <div className="run-summary-actions">
        <button type="button" className="btn btn-primary h-9 px-5" onClick={onAgain}>
          Again
        </button>
        <button type="button" className="btn btn-secondary h-9" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}
