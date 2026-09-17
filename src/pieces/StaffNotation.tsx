import { useEffect, useRef, type MouseEvent } from 'react'
import {
  Accidental,
  Barline,
  Dot,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  Voice,
} from 'vexflow'
import { resolveHands } from './parseMidi'
import {
  barStartSec,
  sliceNotesForTies,
  slicesInMeasure,
  type NoteSlice,
} from './tieSlices'
import type { PieceNote } from './types'
import { writtenAccidental } from './keySig'
import {
  durationToVex,
  midiToVexKey,
  restDurationsForBeats,
  type VexDuration,
} from './midiToVex'

/** @deprecated Prefer barsPerSystem(beatsPerBar) — kept for callers. */
export const BARS_PER_SYSTEM = 6
const STAVE_H = 95
const SYSTEM_GAP = 18

/**
 * Line scroll in system-units: hold the next line still for the first half of
 * the current line, then ease it up into place so the handoff never snaps.
 */
function lineScrollPos(
  measure: number,
  beatFrac: number,
  barsPerLine: number,
): number {
  const bps = Math.max(1, barsPerLine)
  const abs = Math.max(0, measure - 1) + Math.min(0.999, Math.max(0, beatFrac))
  const lineIdx = Math.floor(abs / bps)
  const within = (abs % bps) / bps
  const raw = within < 0.5 ? 0 : (within - 0.5) / 0.5
  const eased = raw * raw * (3 - 2 * raw) // smoothstep
  return lineIdx + eased
}


interface Props {
  notes: PieceNote[]
  measure: number
  activeNotes: PieceNote[]
  secPerQuarter: number
  measureCount: number
  selection: { start: number; end: number } | null
  onMeasurePointer: (bar: number, shiftKey: boolean) => void
  /** +1 next measure, -1 previous — from wheel/trackpad on the sheet. */
  onMeasureScroll?: (dir: 1 | -1) => void
  /** Playhead time (sec) for smooth line glide during demo / practice. */
  nowSec?: number
  /** VexFlow key, e.g. "G" or "Em". */
  keySignature?: string
  /** Bars drawn per staff line (from time signature). */
  barsPerLine?: number
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


/** VexFlow only counts dots in timing when duration is e.g. "qd" / "qdr". */
function vexDurationString(dur: VexDuration, rest: boolean): string {
  const dots = dur.dots > 0 ? 'd' : ''
  return rest ? `${dur.key}${dots}r` : `${dur.key}${dots}`
}

function makeRest(clef: 'treble' | 'bass', dur: VexDuration): StaveNote {
  const restKey = clef === 'bass' ? 'd/3' : 'b/4'
  const rest = new StaveNote({
    keys: [restKey],
    duration: vexDurationString(dur, true),
    clef,
  })
  // Visual dot (ticks already include it via "qdr" etc.)
  if (dur.dots > 0) Dot.buildAndAttach([rest], { all: true })
  rest.setStyle({ fillStyle: '#5C6478', strokeStyle: '#5C6478' })
  return rest
}

type Built = {
  notes: StaveNote[]
  /** For each StaveNote, the slices that built it (same order as keys). */
  sliceGroups: NoteSlice[][]
}

/**
 * Build a bar in time order: rests go in the gaps before/between notes,
 * not dumped at the end.
 *
 * Cursor advances only by beats actually emitted as VexFlow glyphs so treble
 * and bass stay on the same tick grid when joinVoices formats them.
 */
function buildVoiceNotes(
  inBar: NoteSlice[],
  clef: 'treble' | 'bass',
  secPerQuarter: number,
  activeNotes: PieceNote[],
  measure: number,
  keySignature: string,
): Built {
  const groups = groupSlices(inBar)
  const notes: StaveNote[] = []
  const sliceGroups: NoteSlice[][] = []
  const spq = Math.max(0.01, secPerQuarter)
  const barStart = barStartSec(measure, spq)
  const barBeats = 4
  let cursor = 0 // beats from start of bar (must match Σ glyph beats)

  const emitRests = (beats: number) => {
    if (beats < 0.24) return
    const specs = restDurationsForBeats(beats)
    let placed = 0
    for (const rd of specs) {
      notes.push(makeRest(clef, rd))
      sliceGroups.push([])
      placed += rd.beats
    }
    cursor += placed
  }

  if (!groups.length) {
    emitRests(barBeats)
    return { notes, sliceGroups }
  }

  for (const gRaw of groups) {
    // Low→high so VexFlow can displace adjacent seconds cleanly
    const g = [...gRaw].sort((a, b) => a.midi - b.midi)
    const onset =
      Math.round(((g[0]!.time - barStart) / spq) * 4) / 4 // 16th grid
    const gap = onset - cursor
    if (gap >= 0.24) emitRests(gap)

    const rawBeats = Math.max(...g.map((s) => s.duration)) / spq
    const start = Math.max(cursor, Math.min(onset, barBeats))
    // Snap start forward if we skipped a tiny gap (notes must not share ticks)
    if (start < cursor) {
      /* keep cursor */
    }
    const room = Math.max(0.25, barBeats - cursor)
    const capped = Math.min(Math.max(rawBeats, 0.25), room)
    const dur = durationToVex(capped * spq, spq)

    const keys = g.map((s) => midiToVexKey(s.midi))
    const sn = new StaveNote({
      keys,
      duration: vexDurationString(dur, false),
      clef,
    })
    keys.forEach((k, i) => {
      if (g[i]?.tieFromPrev) return
      const pitch = k.split('/')[0]!
      const acc = writtenAccidental(pitch, keySignature)
      if (acc) sn.addModifier(new Accidental(acc), i)
    })
    // Dot modifier is visual only; timing comes from "qd" duration above
    if (dur.dots > 0) Dot.buildAndAttach([sn], { all: true })
    const isActive = isActiveGroup(g, activeNotes)
    sn.setStyle({
      fillStyle: isActive ? '#C08B3E' : '#EDE4D3',
      strokeStyle: isActive ? '#C08B3E' : '#EDE4D3',
    })
    sn.setLedgerLineStyle({
      strokeStyle: isActive ? '#C08B3E' : '#9AA3B5',
      lineWidth: 1.25,
    })
    notes.push(sn)
    sliceGroups.push(g)
    cursor += dur.beats
    if (cursor > barBeats + 0.001) break
  }

  if (cursor < barBeats - 0.001) emitRests(barBeats - cursor)

  // Final safety: still short → whole rest (empty-ish bar)
  if (!notes.length) {
    notes.push(makeRest(clef, { key: 'w', dots: 0, beats: 4 }))
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
  onMeasureScroll,
  nowSec,
  keySignature = 'C',
  barsPerLine = 6,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const layout = useRef<{
    systems: { start: number; top: number; bottom: number }[]
    marginLeft: number
    barW: number
    scrollY: number
  } | null>(null)
  const scrollAccum = useRef(0)
  const onMeasureScrollRef = useRef(onMeasureScroll)
  onMeasureScrollRef.current = onMeasureScroll

  const BPS = Math.max(3, barsPerLine)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const cb = onMeasureScrollRef.current
      if (!cb) return
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
      e.preventDefault()
      scrollAccum.current += e.deltaY
      const step = 40
      while (scrollAccum.current >= step) {
        scrollAccum.current -= step
        cb(1)
      }
      while (scrollAccum.current <= -step) {
        scrollAccum.current += step
        cb(-1)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

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

      const barStart = barStartSec(measure, secPerQuarter)
      const barDur = 4 * Math.max(0.01, secPerQuarter)
      const tPlay =
        nowSec ??
        activeNotes[0]?.time ??
        barStart
      const beatFrac = Math.min(
        0.999,
        Math.max(0, (tPlay - barStart) / barDur),
      )
      const scrollPos = lineScrollPos(measure, beatFrac, BPS)

      const baseLine = Math.max(0, Math.floor(scrollPos))
      const localT = scrollPos - baseLine // 0..1 within the glide window
      const systemStarts: number[] = []
      for (let i = 0; i < 3; i++) {
        const start = (baseLine + i) * BPS + 1
        if (start <= measureCount) systemStarts.push(start)
      }
      if (
        systemStarts.length < 2 &&
        systemStarts[0] != null &&
        systemStarts[0] + BPS <= measureCount
      ) {
        systemStarts.push(systemStarts[0] + BPS)
      }

      const windowNotes = notes.filter(
        (n) =>
          n.measure >= (systemStarts[0] ?? 1) &&
          n.measure < (systemStarts[0] ?? 1) + BPS * 3,
      )
      const hasTreble =
        windowNotes.some(isTrebleNote) || windowNotes.length === 0
      const hasBass = windowNotes.some(isBassNote) || notes.some(isBassNote)
      const showTreble = hasTreble || !hasBass
      const showBass = hasBass || !!hands
      const rows = (showTreble ? 1 : 0) + (showBass ? 1 : 0)
      const systemH = 8 + rows * STAVE_H
      const stride = systemH + SYSTEM_GAP
      // Local Y for the 2–3 visible lines only (keeps canvas bounded)
      const height = 8 + systemStarts.length * stride
      const viewH = 8 + 2 * systemH + SYSTEM_GAP

      const renderer = new Renderer(el, Renderer.Backends.SVG)
      renderer.resize(width, height)
      const ctx = renderer.getContext()
      ctx.setFillStyle('#EDE4D3')
      ctx.setStrokeStyle('#7A8496')

      const marginLeft = 8
      const usable = width - marginLeft - 8
      const barW = usable / BPS
      const systemsMeta: { start: number; top: number; bottom: number }[] = []

      type TieKey = string
      const placed = new Map<
        TieKey,
        { sn: StaveNote; index: number; measure: number }
      >()

      const drawSystem = (start: number, y0: number) => {
        const bars = Array.from(
          { length: BPS },
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

        const trebleY = y0 + 4
        const bassY = trebleY + (showTreble ? STAVE_H : 0)
        const rowTies: {
          first: StaveNote
          last: StaveNote
          fi: number
          li: number
        }[] = []

        // Draw each bar as a grand-staff unit: format treble+bass together
        // so the same beat lines up vertically across clefs.
        bars.forEach((barNum, bi) => {
          if (barNum > measureCount) return
          const x = marginLeft + bi * barW
          const inner = Math.max(50, barW - (bi === 0 ? 40 : 18))

          const staves: { clef: 'treble' | 'bass'; stave: Stave; built: Built }[] =
            []

          if (showTreble) {
            const stave = new Stave(x, trebleY, barW)
            if (bi === 0) {
              stave.addClef('treble')
              if (keySignature && keySignature !== 'C') {
                stave.addKeySignature(keySignature)
              }
            }
            stave.setEndBarType(Barline.type.SINGLE)
            stave.setStyle({ fillStyle: '#7A8496', strokeStyle: '#7A8496', lineWidth: 1 })
            stave.setContext(ctx).draw()
            const inBar = slicesInMeasure(slices, barNum).filter(isTrebleNote)
            const built = buildVoiceNotes(
              inBar,
              'treble',
              secPerQuarter,
              activeNotes,
              barNum,
              keySignature,
            )
            staves.push({ clef: 'treble', stave, built })
          }

          if (showBass) {
            const stave = new Stave(x, bassY, barW)
            if (bi === 0) {
              stave.addClef('bass')
              if (keySignature && keySignature !== 'C') {
                stave.addKeySignature(keySignature)
              }
            }
            stave.setEndBarType(Barline.type.SINGLE)
            stave.setStyle({ fillStyle: '#7A8496', strokeStyle: '#7A8496', lineWidth: 1 })
            stave.setContext(ctx).draw()
            const inBar = slicesInMeasure(slices, barNum).filter(isBassNote)
            const built = buildVoiceNotes(
              inBar,
              'bass',
              secPerQuarter,
              activeNotes,
              barNum,
              keySignature,
            )
            staves.push({ clef: 'bass', stave, built })
          }

          const voices: Voice[] = []
          for (const row of staves) {
            const voice = new Voice({
              num_beats: 4,
              beat_value: 4,
            }).setStrict(false)
            voice.addTickables(row.built.notes)
            voices.push(voice)
          }

          if (voices.length) {
            const fmt = new Formatter()
            fmt.joinVoices(voices)
            fmt.format(voices, inner)
            staves.forEach((row, i) => {
              voices[i]!.draw(ctx, row.stave)
            })
          }

          for (const row of staves) {
            row.built.sliceGroups.forEach((g, gi) => {
              const sn = row.built.notes[gi]!
              g.forEach((slice, ki) => {
                const key = `${row.clef}:${slice.id}`
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
          }

          if (barNum === measure) {
            ctx.save()
            ctx.setStrokeStyle('#C08B3E')
            ctx.setLineWidth(3)
            ctx.beginPath()
            const top = showTreble ? trebleY + 8 : bassY + 8
            const bot =
              (showBass ? bassY : trebleY) + STAVE_H - 10
            ctx.moveTo(x + 3, top)
            ctx.lineTo(x + 3, bot)
            ctx.stroke()
            ctx.restore()
          }
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

      // Local Y: line 0 at top of canvas, then next lines below.
      // translateY(-localT * stride) eases the next line into place; when
      // baseLine ticks forward the content remaps with no visible jump.
      systemStarts.forEach((start, i) => {
        placed.clear()
        drawSystem(start, 4 + i * stride)
      })

      const scrollY = localT * stride
      el.style.transform = `translateY(${-scrollY}px)`
      el.style.willChange = 'transform'
      // Short ease between practice steps; demo nowSec updates track closely
      el.style.transition = 'transform 220ms ease-out'
      box.style.height = `${viewH}px`
      box.style.overflow = 'hidden'

      layout.current = {
        systems: systemsMeta.map((s) => ({
          ...s,
          top: s.top - scrollY,
          bottom: s.bottom - scrollY,
        })),
        marginLeft,
        barW,
        scrollY,
      }
    }

    draw()
    const ro = new ResizeObserver(() => draw())
    ro.observe(box)
    return () => ro.disconnect()
  }, [notes, measure, activeNotes, nowSec, secPerQuarter, measureCount, selection, keySignature, BPS])

  const lineStart =
    Math.floor((Math.max(1, measure) - 1) / BPS) * BPS +
    1
  const lineEnd = lineStart + BPS - 1
  const nextStart = lineStart + BPS
  const hasNext = nextStart <= measureCount

  const handleClick = (e: MouseEvent) => {
    const lay = layout.current
    const box = wrap.current
    if (!lay || !box) return
    const rect = box.getBoundingClientRect()
    const x = e.clientX - rect.left - lay.marginLeft
    const y = e.clientY - rect.top
    if (x < 0 || x > lay.barW * BPS) return
    const sys = lay.systems.find((s) => y >= s.top && y < s.bottom)
    if (!sys) return
    const bi = Math.min(BPS - 1, Math.floor(x / lay.barW))
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
      className="w-full cursor-pointer overflow-hidden rounded bg-shadow px-2 py-1"
      onClick={handleClick}
      title="Click a bar to jump · Shift-click to select · Scroll to move measures"
    >
      <div ref={host} className="w-full" />
      <p className="pb-1 text-center font-ui text-xs text-dust">
        Bars {lineStart}–{lineEnd}
        {hasNext ? ` + next ${nextStart}–${Math.min(measureCount, nextStart + BPS - 1)}` : ''}
        {' · '}playing {measure}
        {selLabel ?? ''}
        {' · '}
        {resolveHands(notes) ? 'tracks→hands' : 'pitch→clef'} · click /
        shift-click · scroll · lines glide
      </p>
    </div>
  )
}
