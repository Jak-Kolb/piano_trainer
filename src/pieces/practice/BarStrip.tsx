import { useRef, useState, type PointerEvent } from 'react'
import type { SystemPlan } from '../sheetLayout'

interface Props {
  count: number
  current: number
  range: { start: number; end: number } | null
  /** Bar → 0–1 mistake density (practice stats). */
  trouble?: ReadonlyMap<number, number>
  /** Line starts, drawn as ticks so the strip matches the sheet. */
  systems?: SystemPlan[]
  disabled?: boolean
  onJump: (bar: number) => void
  onRange: (range: { start: number; end: number } | null) => void
}

/**
 * The whole piece in one row: where you are, the practice range, and
 * (with stats on) where the mistakes cluster. Click to jump, drag to
 * choose bars to practise.
 */
export function BarStrip({
  count,
  current,
  range,
  trouble,
  systems,
  disabled,
  onJump,
  onRange,
}: Props) {
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<{ from: number; moved: boolean } | null>(null)
  const [preview, setPreview] = useState<{ start: number; end: number } | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  const barAt = (clientX: number) => {
    const el = track.current
    if (!el) return 1
    const r = el.getBoundingClientRect()
    const f = Math.min(0.9999, Math.max(0, (clientX - r.left) / r.width))
    return Math.floor(f * count) + 1
  }
  const pct = (bar: number) => ((bar - 1) / count) * 100
  const shown = preview ?? range

  const onDown = (e: PointerEvent) => {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { from: barAt(e.clientX), moved: false }
  }
  const onMove = (e: PointerEvent) => {
    const bar = barAt(e.clientX)
    setHover(bar)
    const d = drag.current
    if (!d) return
    if (bar !== d.from) d.moved = true
    if (d.moved) {
      setPreview({ start: Math.min(d.from, bar), end: Math.max(d.from, bar) })
    }
  }
  const onUp = (e: PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    // From the drag itself: a fast drag can end before the preview renders.
    const bar = barAt(e.clientX)
    if (d.moved || bar !== d.from) {
      onRange({ start: Math.min(d.from, bar), end: Math.max(d.from, bar) })
    } else {
      onJump(bar)
    }
    setPreview(null)
  }

  return (
    <div className={`bar-strip${disabled ? ' bar-strip--disabled' : ''}`}>
      <div
        ref={track}
        className="bar-strip-track"
        role="slider"
        aria-label="Bars — click to jump, drag to choose a practice range"
        aria-valuemin={1}
        aria-valuemax={count}
        aria-valuenow={current}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => setHover(null)}
      >
        {trouble &&
          [...trouble].map(([bar, w]) =>
            bar >= 1 && bar <= count && w > 0.05 ? (
              <span
                key={bar}
                className="bar-strip-trouble"
                style={{
                  left: `${pct(bar)}%`,
                  width: `${100 / count}%`,
                  opacity: 0.25 + 0.75 * w,
                }}
              />
            ) : null,
          )}
        {systems?.slice(1).map((s) => (
          <span key={s.start} className="bar-strip-line" style={{ left: `${pct(s.start)}%` }} />
        ))}
        {shown && (
          <span
            className="bar-strip-range"
            style={{
              left: `${pct(shown.start)}%`,
              width: `${((shown.end - shown.start + 1) / count) * 100}%`,
            }}
          />
        )}
        <span
          className="bar-strip-now"
          style={{ left: `${pct(current)}%`, width: `max(3px, ${100 / count}%)` }}
        />
        {hover !== null && (
          <span className="bar-strip-hover" style={{ left: `${pct(hover)}%` }}>
            {preview ? `${preview.start}–${preview.end}` : hover}
          </span>
        )}
      </div>
      <span className="bar-strip-label">
        Bar {current} of {count}
      </span>
    </div>
  )
}
