import { useEffect, useRef, type MouseEvent } from 'react'
import {
  Accidental,
  Barline,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  Voice,
} from 'vexflow'
import { resolveHands } from './parseMidi'
import {
  sliceNotesForTies,
  slicesInMeasure,
  type NoteSlice,
} from './tieSlices'
import type { PieceNote } from './types'
import {
  durationToVex,
  midiToVexKey,
  restDurationsForBeats,
  vexDurationBeats,
} from './midiToVex'

export const BARS_PER_SYSTEM = 8
const STAVE_H = 95
const SYSTEM_GAP = 18

interface Props {
  notes: PieceNote[]
  measure: number
  activeNotes: PieceNote[]
  secPerQuarter: number
  measureCount: number
  selection: { start: number; end: number } | null
  onMeasurePointer: (bar: number, shiftKey: boolean) => void
}

function groupSlices(pool: NoteSlice[], windowSec = 0.12): NoteSlice[][] {
  if (!pool.length) return []
  const sorted = [...pool].sort((a, b) => a.time - b.time || a.midi - b.midi)
  const groups: NoteSlice[][] = []
  let cur: NoteSlice[] = [sorted[0]!]
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

function isActiveGroup(g: NoteSlice[], activeNotes: PieceNote[]): boolean {
  if (!activeNotes.length || !g.length) return false
  // Active = this slice group is the sounding onset of the current step
  // (match original MIDI onset, not a tie continuation)
  const stepTime = activeNotes[0]!.time
  const fresh = g.filter((s) => !s.tieFromPrev)
  if (!fresh.length) return false
  if (Math.abs(fresh[0]!.sourceTime - stepTime) > 0.05) return false
  const need = new Set(activeNotes.map((n) => n.midi))
  const have = new Set(fresh.map((s) => s.midi))
  if (need.size !== have.size) return false
  for (const m of need) if (!have.has(m)) return false
  return true
}

type Built = {
  notes: StaveNote[]
  /** For each StaveNote, the slices that built it (same order as keys). */
  sliceGroups: NoteSlice[][]
}

function buildVoiceNotes(
  inBar: NoteSlice[],
  clef: 'treble' | 'bass',
  secPerQuarter: number,
  activeNotes: PieceNote[],
): Built {
  const groups = groupSlices(inBar)
  const notes: StaveNote[] = []
  const sliceGroups: NoteSlice[][] = []
  let beats = 0

  for (const g of groups) {
    const keys = g.map((s) => midiToVexKey(s.midi))
    const dur = durationToVex(
      Math.max(...g.map((s) => s.duration)),
      secPerQuarter,
    )
    const sn = new StaveNote({ keys, duration: dur, clef })
    keys.forEach((k, i) => {
      const pitch = k.split('/')[0]!
      // Skip accidental on tie continuations — pitch already established
      if (g[i]?.tieFromPrev) return
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
    sliceGroups.push(g)
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
    sliceGroups.push([])
  }

  if (!notes.length) {
    const rest = new StaveNote({
      keys: [restKey],
      duration: 'wr',
      clef,
    })
    rest.setStyle({ fillStyle: '#5C6478', strokeStyle: '#5C6478' })
    notes.push(rest)
    sliceGroups.push([])
  }

  return { notes, sliceGroups }
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
    systems: { start: number; top: number; bottom: number }[]
    marginLeft: number
    barW: number
  } | null>(null)

  useEffect(() => {
    const el = host.current
    const box = wrap.current
    if (!el || !box) return

    const draw = () => {
      el.innerHTML = ''
      const width = Math.max(640, Math.floor(box.clientWidth) || 900)
      const hands = resolveHands(notes)
      const isTrebleNote = (n: { track: number; midi: number }) =>
        hands ? n.track === hands.rh : n.midi >= 60
      const isBassNote = (n: { track: number; midi: number }) =>
        hands ? n.track === hands.lh : n.midi < 60

      const slices = sliceNotesForTies(notes, secPerQuarter)

      const lineStart =
        Math.floor((Math.max(1, measure) - 1) / BARS_PER_SYSTEM) *
          BARS_PER_SYSTEM +
        1
      const systemStarts = [lineStart]
      if (lineStart + BARS_PER_SYSTEM <= measureCount) {
        systemStarts.push(lineStart + BARS_PER_SYSTEM)
      }

      const windowNotes = notes.filter(
        (n) =>
          n.measure >= lineStart &&
          n.measure < lineStart + BARS_PER_SYSTEM * 2,
      )
      const hasTreble =
        windowNotes.some(isTrebleNote) || windowNotes.length === 0
      const hasBass = windowNotes.some(isBassNote) || notes.some(isBassNote)
      const showTreble = hasTreble || !hasBass
      const showBass = hasBass || !!hands
      const rows = (showTreble ? 1 : 0) + (showBass ? 1 : 0)
      const systemH = 8 + rows * STAVE_H
      const height =
        8 +
        systemStarts.length * systemH +
        (systemStarts.length - 1) * SYSTEM_GAP

      const renderer = new Renderer(el, Renderer.Backends.SVG)
      renderer.resize(width, height)
      const ctx = renderer.getContext()
      ctx.setFillStyle('#EDE4D3')
      ctx.setStrokeStyle('#5C6478')

      const marginLeft = 8
      const usable = width - marginLeft - 8
      const barW = usable / BARS_PER_SYSTEM
      const systemsMeta: { start: number; top: number; bottom: number }[] = []

      type TieKey = string
      const placed = new Map<
        TieKey,
        { sn: StaveNote; index: number; measure: number }
      >()

      const drawSystem = (start: number, y0: number) => {
        const bars = Array.from(
          { length: BARS_PER_SYSTEM },
          (_, i) => start + i,
        )
        systemsMeta.push({ start, top: y0, bottom: y0 + systemH })

        bars.forEach((barNum, bi) => {
          if (barNum > measureCount) return
          const x = marginLeft + bi * barW
          if (inSelection(barNum, selection)) {
            ctx.save()
            ctx.setFillStyle('rgba(192, 139, 62, 0.22)')
            ctx.fillRect(x, y0, barW, systemH)
            ctx.restore()
          } else if (barNum === measure) {
            ctx.save()
            ctx.setFillStyle('rgba(192, 139, 62, 0.08)')
            ctx.fillRect(x, y0, barW, systemH)
            ctx.restore()
          }
        })

        const drawRow = (
          clef: 'treble' | 'bass',
          y: number,
          pred: (n: { track: number; midi: number }) => boolean,
        ) => {
          let x = marginLeft
          const rowTies: { first: StaveNote; last: StaveNote; fi: number; li: number }[] = []

          bars.forEach((barNum, bi) => {
            const stave = new Stave(x, y, barW)
            if (bi === 0) stave.addClef(clef)
            stave.setEndBarType(Barline.type.SINGLE)
            stave.setStyle({ fillStyle: '#EDE4D3', strokeStyle: '#5C6478' })
            stave.setContext(ctx).draw()

            const inBar =
              barNum <= measureCount
                ? slicesInMeasure(slices, barNum).filter(pred)
                : []
            const built = buildVoiceNotes(
              inBar,
              clef,
              secPerQuarter,
              activeNotes,
            )
            const voice = new Voice({
              num_beats: 4,
              beat_value: 4,
            }).setStrict(false)
            voice.addTickables(built.notes)
            const inner = Math.max(50, barW - (bi === 0 ? 40 : 18))
            new Formatter().joinVoices([voice]).format([voice], inner)
            voice.draw(ctx, stave)

            built.sliceGroups.forEach((g, gi) => {
              const sn = built.notes[gi]!
              g.forEach((slice, ki) => {
                const key = `${clef}:${slice.id}`
                const prev = placed.get(key)
                if (slice.tieFromPrev && prev) {
                  rowTies.push({
                    first: prev.sn,
                    last: sn,
                    fi: prev.index,
                    li: ki,
                  })
                }
                placed.set(key, { sn, index: ki, measure: barNum })
              })
            })

            if (barNum === measure) {
              ctx.save()
              ctx.setStrokeStyle('#C08B3E')
              ctx.setLineWidth(3)
              ctx.beginPath()
              ctx.moveTo(x + 3, y + 8)
              ctx.lineTo(x + 3, y + STAVE_H - 10)
              ctx.stroke()
              ctx.restore()
            }

            x += barW
          })

          for (const t of rowTies) {
            try {
              new StaveTie({
                first_note: t.first,
                last_note: t.last,
                first_indices: [t.fi],
                last_indices: [t.li],
              })
                .setContext(ctx)
                .draw()
            } catch {
              /* ignore tie draw failures */
            }
          }
        }

        let y = y0 + 4
        if (showTreble) {
          drawRow('treble', y, isTrebleNote)
          y += STAVE_H
        }
        if (showBass) {
          drawRow('bass', y, isBassNote)
        }
      }

      // Clear placed between systems so ties don't span systems incorrectly
      // (we redraw ties per row within a system; reset map each system)
      let y = 4
      for (const start of systemStarts) {
        placed.clear()
        drawSystem(start, y)
        y += systemH + SYSTEM_GAP
      }

      layout.current = { systems: systemsMeta, marginLeft, barW }
    }

    draw()
    const ro = new ResizeObserver(() => draw())
    ro.observe(box)
    return () => ro.disconnect()
  }, [notes, measure, activeNotes, secPerQuarter, measureCount, selection])

  const lineStart =
    Math.floor((Math.max(1, measure) - 1) / BARS_PER_SYSTEM) * BARS_PER_SYSTEM +
    1
  const lineEnd = lineStart + BARS_PER_SYSTEM - 1
  const nextStart = lineStart + BARS_PER_SYSTEM
  const hasNext = nextStart <= measureCount

  const handleClick = (e: MouseEvent) => {
    const lay = layout.current
    const box = wrap.current
    if (!lay || !box) return
    const rect = box.getBoundingClientRect()
    const x = e.clientX - rect.left - lay.marginLeft
    const y = e.clientY - rect.top
    if (x < 0 || x > lay.barW * BARS_PER_SYSTEM) return
    const sys = lay.systems.find((s) => y >= s.top && y < s.bottom)
    if (!sys) return
    const bi = Math.min(BARS_PER_SYSTEM - 1, Math.floor(x / lay.barW))
    const bar = sys.start + bi
    if (bar < 1 || bar > measureCount) return
    onMeasurePointer(bar, e.shiftKey)
  }

  const selLabel =
    selection &&
    (selection.start === selection.end
      ? ` · selected bar ${selection.start}`
      : ` · selected ${Math.min(selection.start, selection.end)}–${Math.max(selection.start, selection.end)}`)

  return (
    <div
      ref={wrap}
      className="w-full cursor-pointer rounded bg-shadow px-2 py-1"
      onClick={handleClick}
      title="Click a bar to jump · Shift-click to select a range"
    >
      <div ref={host} className="w-full" />
      <p className="pb-1 text-center font-ui text-xs text-dust">
        Bars {lineStart}–{lineEnd}
        {hasNext ? ` + next ${nextStart}–${Math.min(measureCount, nextStart + BARS_PER_SYSTEM - 1)}` : ''}
        {' · '}playing {measure}
        {selLabel ?? ''}
        {' · '}
        {resolveHands(notes) ? 'tracks→hands' : 'pitch→clef'} · click /
        shift-click
      </p>
    </div>
  )
}
