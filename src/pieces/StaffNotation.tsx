import { useEffect, useRef, type MouseEvent } from 'react'
import {
  Accidental,
  Barline,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Voice,
} from 'vexflow'
import type { PieceNote } from './types'
import {
  durationToVex,
  midiToVexKey,
  notesInMeasure,
  restDurationsForBeats,
  vexDurationBeats,
} from './midiToVex'

export const BARS_PER_SYSTEM = 8

interface Props {
  notes: PieceNote[]
  measure: number
  /** Exact current step notes (match midi + onset time, not every same pitch). */
  activeNotes: PieceNote[]
  secPerQuarter: number
  measureCount: number
  /** Inclusive selected range, or null. */
  selection: { start: number; end: number } | null
  onMeasurePointer: (bar: number, shiftKey: boolean) => void
}

function groupOnsets(pool: PieceNote[], windowSec = 0.12): PieceNote[][] {
  if (!pool.length) return []
  const sorted = [...pool].sort((a, b) => a.time - b.time || a.midi - b.midi)
  const groups: PieceNote[][] = []
  let cur: PieceNote[] = [sorted[0]!]
  let anchor = sorted[0]!.time
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i]!
    if (n.time - anchor <= windowSec) cur.push(n)
    else {
      groups.push(cur)
      cur = [n]
      anchor = n.time
    }
  }
  groups.push(cur)
  return groups
}

function isActiveGroup(g: PieceNote[], activeNotes: PieceNote[]): boolean {
  if (!activeNotes.length || !g.length) return false
  const stepTime = activeNotes[0]!.time
  const groupTime = g[0]!.time
  if (Math.abs(groupTime - stepTime) > 0.05) return false
  const need = new Set(activeNotes.map((n) => n.midi))
  const have = new Set(g.map((n) => n.midi))
  if (need.size !== have.size) return false
  for (const m of need) if (!have.has(m)) return false
  return true
}

function buildVoiceNotes(
  inBar: PieceNote[],
  clef: 'treble' | 'bass',
  secPerQuarter: number,
  activeNotes: PieceNote[],
): StaveNote[] {
  const groups = groupOnsets(inBar)
  const notes: StaveNote[] = []
  let beats = 0

  for (const g of groups) {
    const keys = g.map((n) => midiToVexKey(n.midi))
    const dur = durationToVex(
      Math.max(...g.map((n) => n.duration)),
      secPerQuarter,
    )
    const sn = new StaveNote({ keys, duration: dur, clef })
    keys.forEach((k, i) => {
      const pitch = k.split('/')[0]!
      if (pitch.includes('#')) sn.addModifier(new Accidental('#'), i)
      else if (pitch.endsWith('bb')) sn.addModifier(new Accidental('bb'), i)
      else if (pitch.length > 1 && pitch.endsWith('b'))
        sn.addModifier(new Accidental('b'), i)
    })
    const isActive = isActiveGroup(g, activeNotes)
    sn.setStyle({
      fillStyle: isActive ? '#C08B3E' : '#EDE4D3',
      strokeStyle: isActive ? '#C08B3E' : '#EDE4D3',
    })
    notes.push(sn)
    beats += vexDurationBeats(dur)
  }

  const restKey = clef === 'bass' ? 'd/3' : 'b/4'
  for (const rd of restDurationsForBeats(Math.max(0, 4 - beats))) {
    const rest = new StaveNote({
      keys: [restKey],
      duration: `${rd}r`,
      clef,
    })
    rest.setStyle({ fillStyle: '#5C6478', strokeStyle: '#5C6478' })
    notes.push(rest)
  }

  if (!notes.length) {
    const rest = new StaveNote({
      keys: [restKey],
      duration: 'wr',
      clef,
    })
    rest.setStyle({ fillStyle: '#5C6478', strokeStyle: '#5C6478' })
    notes.push(rest)
  }

  return notes
}

function inSelection(
  bar: number,
  selection: { start: number; end: number } | null,
): boolean {
  if (!selection) return false
  const lo = Math.min(selection.start, selection.end)
  const hi = Math.max(selection.start, selection.end)
  return bar >= lo && bar <= hi
}

/**
 * Always draws an 8-bar system. Click a bar to jump; shift-click to select a range.
 */
export function StaffNotation({
  notes,
  measure,
  activeNotes,
  secPerQuarter,
  measureCount,
  selection,
  onMeasurePointer,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const layout = useRef<{
    start: number
    marginLeft: number
    barW: number
    width: number
  } | null>(null)

  useEffect(() => {
    const el = host.current
    const box = wrap.current
    if (!el || !box) return

    const draw = () => {
      el.innerHTML = ''
      const width = Math.max(640, Math.floor(box.clientWidth) || 900)

      const start =
        Math.floor((Math.max(1, measure) - 1) / BARS_PER_SYSTEM) *
          BARS_PER_SYSTEM +
        1
      const bars = Array.from({ length: BARS_PER_SYSTEM }, (_, i) => start + i)

      const systemNotes = notes.filter(
        (n) => n.measure >= bars[0]! && n.measure <= bars[bars.length - 1]!,
      )
      const hasTreble =
        systemNotes.some((n) => n.midi >= 60) || systemNotes.length === 0
      const hasBass = systemNotes.some((n) => n.midi < 60)
      const showTreble = hasTreble || !hasBass
      const showBass = hasBass || notes.some((n) => n.midi < 60)
      const rows = (showTreble ? 1 : 0) + (showBass ? 1 : 0)
      const height = 24 + rows * 110

      const renderer = new Renderer(el, Renderer.Backends.SVG)
      renderer.resize(width, height)
      const ctx = renderer.getContext()
      ctx.setFillStyle('#EDE4D3')
      ctx.setStrokeStyle('#5C6478')

      const marginLeft = 8
      const usable = width - marginLeft - 8
      const barW = usable / BARS_PER_SYSTEM
      layout.current = { start, marginLeft, barW, width }

      // Selection + current-bar backgrounds (behind staves)
      bars.forEach((barNum, bi) => {
        if (barNum > measureCount) return
        const x = marginLeft + bi * barW
        if (inSelection(barNum, selection)) {
          ctx.save()
          ctx.setFillStyle('rgba(192, 139, 62, 0.22)')
          ctx.fillRect(x, 4, barW, height - 8)
          ctx.restore()
        } else if (barNum === measure) {
          ctx.save()
          ctx.setFillStyle('rgba(192, 139, 62, 0.08)')
          ctx.fillRect(x, 4, barW, height - 8)
          ctx.restore()
        }
      })

      const drawRow = (
        clef: 'treble' | 'bass',
        y: number,
        pred: (m: number) => boolean,
      ) => {
        let x = marginLeft
        bars.forEach((barNum, bi) => {
          const stave = new Stave(x, y, barW)
          if (bi === 0) stave.addClef(clef)
          stave.setEndBarType(Barline.type.SINGLE)
          stave.setStyle({ fillStyle: '#EDE4D3', strokeStyle: '#5C6478' })
          stave.setContext(ctx).draw()

          const inBar =
            barNum <= measureCount
              ? notesInMeasure(notes, barNum).filter((n) => pred(n.midi))
              : []
          const vfNotes = buildVoiceNotes(
            inBar,
            clef,
            secPerQuarter,
            activeNotes,
          )
          const voice = new Voice({
            num_beats: 4,
            beat_value: 4,
          }).setStrict(false)
          voice.addTickables(vfNotes)
          const inner = Math.max(50, barW - (bi === 0 ? 40 : 18))
          new Formatter().joinVoices([voice]).format([voice], inner)
          voice.draw(ctx, stave)

          if (barNum === measure) {
            ctx.save()
            ctx.setStrokeStyle('#C08B3E')
            ctx.setLineWidth(3)
            ctx.beginPath()
            ctx.moveTo(x + 3, y + 8)
            ctx.lineTo(x + 3, y + 95)
            ctx.stroke()
            ctx.restore()
          }

          x += barW
        })
      }

      let y = 8
      if (showTreble) {
        drawRow('treble', y, (m) => m >= 60)
        y += 110
      }
      if (showBass) {
        drawRow('bass', y, (m) => m < 60)
      }
    }

    draw()
    const ro = new ResizeObserver(() => draw())
    ro.observe(box)
    return () => ro.disconnect()
  }, [notes, measure, activeNotes, secPerQuarter, measureCount, selection])

  const start =
    Math.floor((Math.max(1, measure) - 1) / BARS_PER_SYSTEM) * BARS_PER_SYSTEM +
    1
  const end = start + BARS_PER_SYSTEM - 1

  const handleClick = (e: MouseEvent) => {
    const lay = layout.current
    const box = wrap.current
    if (!lay || !box) return
    const rect = box.getBoundingClientRect()
    const x = e.clientX - rect.left - lay.marginLeft
    if (x < 0 || x > lay.barW * BARS_PER_SYSTEM) return
    const bi = Math.min(BARS_PER_SYSTEM - 1, Math.floor(x / lay.barW))
    const bar = lay.start + bi
    if (bar < 1 || bar > measureCount) return
    onMeasurePointer(bar, e.shiftKey)
  }

  const selLabel =
    selection &&
    (selection.start === selection.end
      ? ` · selected bar ${selection.start}`
      : ` · selected bars ${Math.min(selection.start, selection.end)}–${Math.max(selection.start, selection.end)}`)

  return (
    <div
      ref={wrap}
      className="w-full cursor-pointer rounded bg-shadow px-2 py-2"
      onClick={handleClick}
      title="Click a bar to jump · Shift-click to select a range"
    >
      <div ref={host} className="w-full" style={{ minHeight: 200 }} />
      <p className="pb-2 text-center font-ui text-sm text-dust">
        Line: bars {start}–{end} (playing bar {measure})
        {selLabel ?? ''}
      </p>
      <p className="pb-1 text-center font-ui text-xs text-dust/80">
        Click bar to jump · Shift-click range to select
      </p>
    </div>
  )
}
