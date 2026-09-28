import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import {
  Accidental,
  Barline,
  Beam,
  Dot,
  Formatter,
  GhostNote,
  MultiMeasureRest,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  Stem,
  Tuplet,
  Voice,
} from 'vexflow'
import { resolveHands } from './parseMidi'
import { measureInfoAt } from './tieSlices'
import type { MeasureInfo, PieceNote } from './types'
import { dynamicMarksForPiece } from './dynamics'
import { isCompound, timeSigToDraw } from './meter'
import {
  CLEFS,
  notatePiece,
  staffAssigner,
  TPQ,
  type Clef,
  type NotatedBar,
  type NotatedEvent,
  type NotatedNote,
  type NotatedVoice,
} from './notate'
import {
  barWidths as planBarWidths,
  clefsForSystem,
  lineScrollPos,
  packSystems,
  systemIndexOf,
  type PackOptions,
  type SystemPlan,
} from './sheetLayout'
import {
  isPureTieContinuation,
  shouldDrawPartialInbound,
  shouldDrawPartialOutbound,
} from './staffTies'
import {
  sheetColorsForPolarity,
  type SheetPolarity,
} from '../settings/colorProfile'
import type { Grade } from './practice/grading'

/** @deprecated Prefer barsPerSystem(beatsPerBar) — kept for callers. */
export const BARS_PER_SYSTEM = 6
const STAVE_H = 100
/** Vertical room between treble and bass (dynamics, ledger clearance). */
const CLEF_GAP = 18
/** Extra space above the top staff / below the bottom staff per system. */
const SYSTEM_PAD_TOP = 16
const SYSTEM_PAD_BOTTOM = 14
const SYSTEM_GAP = 28
/** Left padding the formatter keeps inside every bar. */
const NOTE_INSET = 28
/** Extra width of a line's first bar so clef + key don't squeeze its notes. */
const CLEF_PAD = 52
const MARGIN_LEFT = 8

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
  /** Bars drawn per staff line (from time signature). */
  barsPerLine?: number
  /** Beats per bar from the piece time signature (default 4) — first bar. */
  beatsPerBar?: number
  /**
   * Per-measure absolute timeline (index 0 = measure 1). Required for correct
   * layout after tempo / time-signature changes.
   */
  measures: MeasureInfo[]
  /** Light notes on dark paper, or dark notes on light paper. */
  polarity?: SheetPolarity
  /** Which bars share each staff line (changes with width and content). */
  onSystemsChange?: (systems: SystemPlan[]) => void
  /** Fade this staff (the hand you're not practising). */
  dimStaff?: Clef | null
  /** Play-along result per note id, coloured on the noteheads. */
  noteMarks?: ReadonlyMap<string, Grade>
}

function isActiveGroup(g: NotatedNote[], activeNotes: PieceNote[]): boolean {
  if (!activeNotes.length || !g.length) return false
  // Active = this slice group is part of the current step's onset.
  // Hands are split across staves, so match a non-empty subset of the step
  // midis (exact set equality hid downbeat two-hand chords).
  const stepTime = activeNotes[0]!.time
  const fresh = g.filter((s) => !s.tieFromPrev)
  if (!fresh.length) return false
  if (Math.abs(fresh[0]!.sourceTime - stepTime) > 0.05) return false
  const need = new Set(activeNotes.map((n) => n.midi))
  return fresh.every((s) => need.has(s.midi))
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return `rgba(192, 139, 62, ${alpha})`
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

type Built = {
  notes: (StaveNote | GhostNote)[]
  /** For each tickable, the notes that built it (same order as keys). */
  sliceGroups: NotatedNote[][]
  tuplets: Tuplet[]
  beams: Beam[]
}

/** Rest heights: centred for one voice, above/below when voices share a staff. */
const REST_KEYS: Record<Clef, Record<NotatedVoice['stem'], string>> = {
  treble: { auto: 'b/4', up: 'e/5', down: 'f/4' },
  bass: { auto: 'd/3', up: 'g/3', down: 'a/2' },
}

/** Beam groups in ticks: per beat, half notes in x/2, dotted quarters in compound x/8. */
function beamGroupTicks(info: MeasureInfo): number {
  if (info.beatUnit === 2) return TPQ * 2
  if (info.beatUnit >= 8) return isCompound(info) ? (TPQ * 3) / 2 : TPQ
  return TPQ
}

type SheetColors = ReturnType<typeof sheetColorsForPolarity>

/** How to tint a voice: faded (other hand) and/or play-along results. */
interface VoiceLook {
  dim?: boolean
  marks?: ReadonlyMap<string, Grade>
}

const MARK_COLOR: Record<Grade, keyof SheetColors> = {
  good: 'good',
  early: 'warn',
  late: 'warn',
  missed: 'bad',
}

/** One notated voice → VexFlow tickables, tuplets and beams for a bar. */
function buildVoice(
  voice: NotatedVoice,
  clef: Clef,
  info: MeasureInfo,
  activeNotes: PieceNote[],
  colors: SheetColors,
  look: VoiceLook = {},
): Built {
  const notes: (StaveNote | GhostNote)[] = []
  const sliceGroups: NotatedNote[][] = []
  const stem =
    voice.stem === 'up' ? Stem.UP : voice.stem === 'down' ? Stem.DOWN : null

  for (const ev of voice.events) {
    const duration = `${ev.value}${'d'.repeat(ev.dots)}`
    if (ev.rest && ev.hidden) {
      notes.push(new GhostNote({ duration }))
      sliceGroups.push([])
      continue
    }
    if (ev.rest) {
      const rest = new StaveNote({
        keys: [REST_KEYS[clef][voice.stem]],
        duration: `${duration}r`,
        clef,
      })
      // Visual dot (ticks already include it via "qdr" etc.)
      if (ev.dots > 0) Dot.buildAndAttach([rest], { all: true })
      rest.setStyle({ fillStyle: colors.rest, strokeStyle: colors.rest })
      notes.push(rest)
      sliceGroups.push([])
      continue
    }
    const sn = new StaveNote({
      keys: ev.notes.map((n) => n.key),
      duration,
      clef,
      ...(stem === null ? { auto_stem: true } : { stem_direction: stem }),
    })
    ev.notes.forEach((n, i) => {
      if (n.accidental) sn.addModifier(new Accidental(n.accidental), i)
    })
    // Dot modifier is visual only; timing comes from "qd" duration above
    if (ev.dots > 0) Dot.buildAndAttach([sn], { all: true })

    const isActive = isActiveGroup(ev.notes, activeNotes)
    const ink = isActive
      ? colors.active
      : look.dim
        ? hexToRgba(colors.note, 0.32)
        : colors.note
    sn.setStyle({ fillStyle: ink, strokeStyle: ink })
    sn.setLedgerLineStyle({
      strokeStyle: isActive ? colors.active : look.dim ? hexToRgba(colors.ledger, 0.32) : colors.ledger,
      lineWidth: 1.25,
    })
    if (look.marks) {
      ev.notes.forEach((n, i) => {
        const mark = look.marks!.get(n.id)
        if (!mark) return
        const c = colors[MARK_COLOR[mark]]
        sn.setKeyStyle(i, { fillStyle: c, strokeStyle: c })
      })
    }
    notes.push(sn)
    sliceGroups.push(ev.notes)
  }

  // Beam runs of eighths and shorter within each beam group. Tie
  // continuations break the run so barline-tied chords stay unbeamed.
  const beams: Beam[] = []
  const beamed = new Set<StaveNote | GhostNote>()
  const groupTicks = beamGroupTicks(info)
  let run: StaveNote[] = []
  let runGroup = -1
  const flush = () => {
    if (run.length > 1) {
      beams.push(new Beam(run, stem === null))
      for (const n of run) beamed.add(n)
    }
    run = []
  }
  voice.events.forEach((ev, i) => {
    const t = notes[i]!
    const beamable =
      !ev.rest &&
      (ev.value === '8' || ev.value === '16') &&
      !isPureTieContinuation(ev.notes) &&
      t instanceof StaveNote
    const group = Math.floor(ev.start / groupTicks)
    if (!beamable || group !== runGroup) flush()
    if (beamable) {
      run.push(t)
      runGroup = group
    }
  })
  flush()

  // Tuplets set the 2/3 tick multiplier, so build them before formatting.
  // Printed style: just "3" / "6"; a bracket only when the group isn't beamed.
  const cells = new Map<string, { ref: NotatedEvent['tuplet']; idx: number[] }>()
  voice.events.forEach((ev, i) => {
    if (!ev.tuplet) return
    const cell = cells.get(ev.tuplet.id) ?? { ref: ev.tuplet, idx: [] }
    cell.idx.push(i)
    cells.set(ev.tuplet.id, cell)
  })
  const tuplets: Tuplet[] = []
  for (const { ref, idx } of cells.values()) {
    const group = idx.map((i) => notes[i]!)
    const tuplet = new Tuplet(group, {
      num_notes: ref!.numNotes,
      notes_occupied: ref!.notesOccupied,
      ratioed: false,
      bracketed: !group.every((t) => beamed.has(t)),
    })
    // A number needs real stems; cells padded with spacer rests stay unmarked.
    if (group.every((t) => t instanceof StaveNote)) tuplets.push(tuplet)
  }

  return { notes, sliceGroups, tuplets, beams }
}

const noteStartCache = new Map<string, number>()

/** Where notes start on a stave carrying these begin modifiers (cached). */
function noteStartOffset(
  clef: 'treble' | 'bass' | null,
  key: string | null,
  cancel: string | null,
  time: string | null,
): number {
  const id = `${clef}|${key}|${cancel}|${time}`
  let x = noteStartCache.get(id)
  if (x === undefined) {
    const stave = new Stave(0, 0, 400)
    if (clef) stave.addClef(clef)
    if (key) stave.addKeySignature(key, cancel ?? undefined)
    if (time) stave.addTimeSignature(time)
    x = stave.getNoteStartX()
    noteStartCache.set(id, x)
  }
  return x
}

/** Key / time signatures printed at the start of this bar. */
function beginModifiers(
  measures: MeasureInfo[],
  barNum: number,
  lineStart: boolean,
) {
  const info = measureInfoAt(measures, barNum)
  const prevKey =
    barNum > 1 ? measureInfoAt(measures, barNum - 1).keySignature : info.keySignature
  const changed = info.keySignature !== prevKey
  const key =
    changed || (lineStart && info.keySignature !== 'C') ? info.keySignature : null
  return {
    key,
    cancel: changed ? prevKey : null,
    time: timeSigToDraw(measures, barNum),
  }
}

/** Extra room beyond the usual line-start clef + key (CLEF_PAD). */
function modifierPad(
  measures: MeasureInfo[],
  barNum: number,
  lineStart: boolean,
): number {
  const mods = beginModifiers(measures, barNum, lineStart)
  const lineKey = measureInfoAt(measures, barNum).keySignature
  let pad = 0
  for (const clef of CLEFS) {
    const full = noteStartOffset(lineStart ? clef : null, mods.key, mods.cancel, mods.time)
    const base = lineStart
      ? noteStartOffset(clef, lineKey !== 'C' ? lineKey : null, null, null)
      : noteStartOffset(null, null, null, null)
    pad = Math.max(pad, full - base)
  }
  return pad
}

/**
 * Minimum music width of each bar (px), from VexFlow's own spacing with
 * beams and tuplets applied. Measured once per piece to break lines.
 */
function measureMinWidths(score: NotatedBar[], measures: MeasureInfo[]): number[] {
  const colors = sheetColorsForPolarity('light-on-dark')
  return score.map((nb) => {
    const info = measureInfoAt(measures, nb.bar)
    const fmt = new Formatter()
    const voices: Voice[] = []
    for (const clef of CLEFS) {
      if (isFullBarRest(nb.staves[clef])) continue
      const staffVoices = nb.staves[clef].map((v) =>
        new Voice({ num_beats: info.beatsPerBar, beat_value: info.beatUnit })
          .setStrict(false)
          .addTickables(buildVoice(v, clef, info, [], colors).notes),
      )
      if (!staffVoices.length) continue
      fmt.joinVoices(staffVoices)
      voices.push(...staffVoices)
    }
    return voices.length ? fmt.preCalculateMinTotalWidth(voices) : 0
  })
}

/** A staff that rests for the whole bar prints one centred whole rest. */
function isFullBarRest(voices: NotatedVoice[]): boolean {
  return voices.length === 1 && voices[0]!.events.every((e) => e.rest)
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
  secPerQuarter: _secPerQuarter,
  measureCount,
  selection,
  onMeasurePointer,
  onMeasureScroll,
  nowSec,
  barsPerLine = 6,
  beatsPerBar: _beatsPerBar = 4,
  measures,
  polarity = 'light-on-dark',
  onSystemsChange,
  dimStaff = null,
  noteMarks,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  /** Last drawing: systems in SVG coordinates, and how to scroll them. */
  const layout = useRef<{
    systems: { start: number; top: number; bottom: number; barWidths: number[] }[]
    marginLeft: number
    pad: number
    stride: number
    baseLine: number
  } | null>(null)
  /** Current translateY offset of the drawing (px), for click mapping. */
  const offsetRef = useRef(0)
  const scrollAccum = useRef(0)
  const onMeasureScrollRef = useRef(onMeasureScroll)
  onMeasureScrollRef.current = onMeasureScroll
  const [themeEpoch, setThemeEpoch] = useState(0)

  useEffect(() => {
    const onTheme = () => setThemeEpoch((n) => n + 1)
    window.addEventListener('keys-color-profile', onTheme)
    return () => window.removeEventListener('keys-color-profile', onTheme)
  }, [])

  const BPS = Math.max(3, barsPerLine)
  void _secPerQuarter

  const staffOf = useMemo(() => staffAssigner(notes), [notes])
  const score = useMemo(
    () => notatePiece(notes, measures, measureCount, staffOf),
    [notes, measures, measureCount, staffOf],
  )
  const hands = useMemo(() => resolveHands(notes), [notes])
  // One mark per real dynamic change in the piece (not per staff line)
  const pieceDynMarks = useMemo(() => dynamicMarksForPiece(notes), [notes])

  // One observer for the component's life; redraw only when the width changes.
  const [boxWidth, setBoxWidth] = useState(0)
  useLayoutEffect(() => {
    const box = wrap.current
    if (!box) return
    const read = () => setBoxWidth(Math.floor(box.clientWidth))
    read()
    const ro = new ResizeObserver(read)
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  // Line breaking: bars pack by content (dense bars get fewer per line),
  // up to BPS; each line picks the clef each hand reads best in.
  const minWidths = useMemo(() => measureMinWidths(score, measures), [score, measures])
  const width = Math.max(640, boxWidth || 900)
  const packOpts = useMemo<PackOptions>(
    () => ({
      usable: width - MARGIN_LEFT - 8,
      maxBars: BPS,
      clefPad: CLEF_PAD,
      inset: NOTE_INSET,
      padFor: (bar, lineStart) => modifierPad(measures, bar, lineStart),
    }),
    [width, BPS, measures],
  )
  const systems = useMemo(
    () => packSystems(minWidths, measureCount, packOpts),
    [minWidths, measureCount, packOpts],
  )
  const lineClefs = useMemo(
    () => systems.map((sys) => clefsForSystem(score, sys)),
    [systems, score],
  )
  const onSystemsChangeRef = useRef(onSystemsChange)
  onSystemsChangeRef.current = onSystemsChange
  useEffect(() => {
    onSystemsChangeRef.current?.(systems)
  }, [systems])

  // Playhead → continuous line position. Only its integer part (which
  // systems are on the page) needs a redraw; the fraction is a CSS glide.
  const playInfo = measureInfoAt(measures, measure)
  const tPlay = nowSec ?? activeNotes[0]?.time ?? playInfo.startSec
  const beatFrac = Math.min(
    0.999,
    Math.max(0, (tPlay - playInfo.startSec) / Math.max(0.01, playInfo.durationSec)),
  )
  const scrollPos = lineScrollPos(systems, measure, beatFrac)
  const baseLine = Math.max(0, Math.floor(scrollPos))

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

  // Layout effects so a redraw and its matching scroll offset land in the
  // same frame (no one-frame jump when the line window advances).
  useLayoutEffect(() => {
    const el = host.current
    const box = wrap.current
    if (!el || !box) return
    // The width observer is about to report the real width; draw once then.
    if (!boxWidth && box.clientWidth) return

    const draw = () => {
      el.innerHTML = ''
      const isTrebleNote = (n: PieceNote) => staffOf(n) === 'treble'
      const isBassNote = (n: PieceNote) => staffOf(n) === 'bass'

      void _beatsPerBar

      // Systems for lines baseLine-1 … baseLine+2, laid out relative to
      // baseLine; the fractional scroll is applied as a transform.
      const lineIndices: number[] = []
      for (let i = -1; i <= 2; i++) {
        const li = baseLine + i
        if (li >= 0 && li < systems.length) lineIndices.push(li)
      }
      if (lineIndices.length === 0) lineIndices.push(0)

      const firstSys = systems[lineIndices[0]!]!
      const lastSys = systems[lineIndices[lineIndices.length - 1]!]!
      const windowLo = firstSys.start
      const windowHi = lastSys.start + lastSys.count - 1
      const windowNotes = notes.filter(
        (n) => n.measure >= windowLo && n.measure <= windowHi,
      )
      const hasTreble =
        windowNotes.some(isTrebleNote) || windowNotes.length === 0
      const hasBass = windowNotes.some(isBassNote) || notes.some(isBassNote)
      const showTreble = hasTreble || !hasBass
      const showBass = hasBass || !!hands
      const rows = (showTreble ? 1 : 0) + (showBass ? 1 : 0)
      const systemH =
        SYSTEM_PAD_TOP +
        rows * STAVE_H +
        (rows > 1 ? CLEF_GAP : 0) +
        SYSTEM_PAD_BOTTOM
      const stride = systemH + SYSTEM_GAP
      const viewH = SYSTEM_PAD_TOP + 2 * systemH + SYSTEM_GAP + SYSTEM_PAD_BOTTOM
      // Pad above so systems can slide off the top without SVG clipping
      const pad = stride
      const height = pad + viewH + stride

      const colors = sheetColorsForPolarity(polarity)
      const renderer = new Renderer(el, Renderer.Backends.SVG)
      renderer.resize(width, height)
      const ctx = renderer.getContext()
      ctx.setFillStyle(colors.note)
      ctx.setStrokeStyle(colors.staff)

      const marginLeft = MARGIN_LEFT
      const systemsMeta: { start: number; top: number; bottom: number; barWidths: number[] }[] = []

      type TieKey = string
      const placed = new Map<
        TieKey,
        { sn: StaveNote; index: number; measure: number; tieToNext: boolean }
      >()
      /** StaveNotes that already got a full same-system outbound StaveTie. */
      const fullTieFirstNotes = new Set<StaveNote>()

      const drawSystem = (li: number, y0: number) => {
        const sys = systems[li]!
        const start = sys.start
        const clefs = lineClefs[li]!
        const bars = Array.from({ length: sys.count }, (_, i) => start + i)
        // Each bar: its minimum width plus an equal share of the leftover;
        // the first bar also carries CLEF_PAD for clef + key.
        const { widths: barWidths, pads: barPads } = planBarWidths(sys, minWidths, packOpts)
        const barX = (bi: number) =>
          marginLeft + barWidths.slice(0, bi).reduce((a, w) => a + w, 0)
        systemsMeta.push({ start, top: y0, bottom: y0 + systemH, barWidths })

        bars.forEach((barNum, bi) => {
          if (barNum > measureCount) return
          const x = barX(bi)
          if (inSelection(barNum, selection)) {
            ctx.save()
            ctx.setFillStyle(hexToRgba(colors.active, 0.22))
            ctx.fillRect(x, y0, barWidths[bi]!, systemH)
            ctx.restore()
          } else if (barNum === measure) {
            ctx.save()
            ctx.setFillStyle(hexToRgba(colors.active, 0.08))
            ctx.fillRect(x, y0, barWidths[bi]!, systemH)
            ctx.restore()
          }
        })

        const trebleY = y0 + SYSTEM_PAD_TOP
        const bassY =
          trebleY + (showTreble ? STAVE_H + CLEF_GAP : 0)
        const rowTies: {
          first: StaveNote | null
          last: StaveNote | null
          fi: number
          li: number
        }[] = []
        // Draw each bar as a grand-staff unit: format treble+bass together
        // so the same beat lines up vertically across clefs.
        bars.forEach((barNum, bi) => {
          if (barNum > measureCount) return
          const x = barX(bi)
          // Floor formatter room so dense bars aren't given ~50px.
          // Non-clef bars: ~10px more left inset so barline-tied chords aren't
          // glued to the previous bar's last chord (Another Love m49→m50).
          const leftReserve =
            (bi === 0 ? NOTE_INSET + CLEF_PAD : NOTE_INSET) + barPads[bi]!

          type StaveRow = {
            /** Upper (right hand) or lower (left hand) staff. */
            clef: Clef
            stave: Stave
            layers: Built[]
          }
          const staves: StaveRow[] = []
          const barInfo = measureInfoAt(measures, barNum)
          const mods = beginModifiers(measures, barNum, bi === 0)

          /** One staff of this bar, printed in this line's clef for that hand. */
          const drawStaff = (staff: Clef, y: number) => {
            const drawnClef = clefs[staff]
            const stave = new Stave(x, y, barWidths[bi]!)
            if (bi === 0) stave.addClef(drawnClef)
            // Mid-line staves print no clef but must know it, or a key change
            // puts its accidentals where the treble clef would have them.
            else (stave as unknown as { clef: string }).clef = drawnClef
            if (mods.key) stave.addKeySignature(mods.key, mods.cancel ?? undefined)
            if (mods.time) stave.addTimeSignature(mods.time)
            // Measure number at the start of each staff line (printed-music style).
            if (bi === 0 && staff === 'treble') stave.setMeasure(start)
            stave.setEndBarType(Barline.type.SINGLE)
            stave.setStyle({ fillStyle: colors.staff, strokeStyle: colors.staff, lineWidth: 1 })
            stave.setContext(ctx).draw()
            const model = score[barNum - 1]?.staves[staff] ?? []
            let layers: Built[] = []
            if (isFullBarRest(model)) {
              const rest = new MultiMeasureRest(1, {
                number_of_measures: 1,
                show_number: false,
                use_symbols: true,
              })
              rest.setStyle({ fillStyle: colors.rest, strokeStyle: colors.rest })
              rest.setStave(stave).setContext(ctx).draw()
            } else {
              const look: VoiceLook = { dim: dimStaff === staff, marks: noteMarks }
              layers = model.map((v) =>
                buildVoice(v, drawnClef, barInfo, activeNotes, colors, look),
              )
            }
            staves.push({ clef: staff, stave, layers })
          }
          if (showTreble) drawStaff('treble', trebleY)
          if (showBass) drawStaff('bass', bassY)

          // Extra inset when the first sounding tickable is a pure tie continuation
          // (keeps equal bar widths; only shrinks formatter room).
          let leadingTieCont = false
          outer: for (const row of staves) {
            for (const built of row.layers) {
              for (let gi = 0; gi < built.sliceGroups.length; gi++) {
                const g = built.sliceGroups[gi]!
                if (!g.length) continue // rest
                leadingTieCont = isPureTieContinuation(g)
                break outer
              }
            }
          }
          const inner = Math.max(
            80,
            barWidths[bi]! - (leftReserve + (leadingTieCont ? 10 : 0)),
          )

          const voices: Voice[] = []
          const voiceStaves: Stave[] = []
          const fmt = new Formatter()
          for (const row of staves) {
            const rowVoices = row.layers.map((built) =>
              new Voice({
                num_beats: barInfo.beatsPerBar,
                beat_value: barInfo.beatUnit,
              })
                .setStrict(false)
                .addTickables(built.notes),
            )
            // Voices sharing a stave share modifier contexts (collisions,
            // accidentals); format() below lines beats up across staves.
            if (rowVoices.length) fmt.joinVoices(rowVoices)
            for (const v of rowVoices) {
              voices.push(v)
              voiceStaves.push(row.stave)
            }
          }

          if (voices.length) {
            // Beams and tuplets were created before formatting so flags are
            // suppressed and tuplet ticks count; draw them on top of voices.
            fmt.format(voices, inner)
            voices.forEach((voice, i) => {
              voice.draw(ctx, voiceStaves[i]!)
            })
            for (const row of staves) {
              for (const built of row.layers) {
                for (const beam of built.beams) {
                  beam.setStyle({ fillStyle: colors.note, strokeStyle: colors.note })
                  beam.setContext(ctx).draw()
                }
                for (const tuplet of built.tuplets) {
                  tuplet.setContext(ctx).draw()
                }
              }
            }
          }

          // Dynamics in the gap above the bass (not Annotation-on-note —
          // low bass chords with long up-stems dragged "mp" into the treble).
          const barMarks = pieceDynMarks.filter((m) => m.measure === barNum)
          for (const mark of barMarks) {
            let sn: StaveNote | undefined
            const rowsBassFirst = [...staves].sort((a, b) =>
              a.clef === 'bass' ? -1 : b.clef === 'bass' ? 1 : 0,
            )
            for (const row of rowsBassFirst) {
              for (const built of row.layers) {
                for (let gi = 0; gi < built.sliceGroups.length; gi++) {
                  const g = built.sliceGroups[gi]!
                  const fresh = g.filter((s) => !s.tieFromPrev)
                  if (
                    fresh[0] &&
                    Math.abs(fresh[0].sourceTime - mark.time) <= 0.08
                  ) {
                    sn = built.notes[gi] as StaveNote
                    break
                  }
                }
                if (sn) break
              }
              if (sn) break
            }
            if (!sn) continue
            const mx = sn.getAbsoluteX()
            // Just above the bass staff top line (not mid-gap / into treble)
            const my = showBass ? bassY - 3 : trebleY + STAVE_H - 12
            ctx.save()
            ctx.setFont('Times New Roman', 13, 'italic')
            ctx.setFillStyle(colors.dynamic)
            ctx.fillText(mark.label, mx, my)
            ctx.restore()
          }

          for (const row of staves) {
            for (const built of row.layers) {
              built.sliceGroups.forEach((g, gi) => {
                // Only real notes carry slices (spacers and rests have none)
                const sn = built.notes[gi] as StaveNote
                g.forEach((slice, ki) => {
                  const key = `${row.clef}:${slice.id}`
                  const prev = placed.get(key)
                  if (slice.tieFromPrev && prev) {
                    // Full same-system StaveTie
                    rowTies.push({
                      first: prev.sn,
                      last: sn,
                      fi: prev.index,
                      li: ki,
                    })
                    fullTieFirstNotes.add(prev.sn)
                  } else if (
                    shouldDrawPartialInbound(slice.tieFromPrev, !!prev)
                  ) {
                    // Cross-system inbound partial (partner was on prior system)
                    rowTies.push({
                      first: null,
                      last: sn,
                      fi: ki,
                      li: ki,
                    })
                  }
                  placed.set(key, {
                    sn,
                    index: ki,
                    measure: barNum,
                    tieToNext: slice.tieToNext,
                  })
                })
              })
            }
          }

        })

        // End of system: outbound partials for ties that continue onto the next line
        for (const entry of placed.values()) {
          if (
            shouldDrawPartialOutbound(
              entry.tieToNext,
              fullTieFirstNotes.has(entry.sn),
            )
          ) {
            rowTies.push({
              first: entry.sn,
              last: null,
              fi: entry.index,
              li: entry.index,
            })
          }
        }

        for (const t of rowTies) {
          try {
            const tie = new StaveTie({
              first_note: t.first,
              last_note: t.last,
              first_indices: [t.fi],
              last_indices: [t.li],
            })
            tie.setStyle({ fillStyle: colors.note, strokeStyle: colors.note })
            tie.setContext(ctx).draw()
          } catch {
            /* ignore tie draw failures */
          }
        }
      }

      // Place each system at its scrolled Y. Constant translate(-pad) only
      // reveals the viewport — scrollPos changes never remap local indices.
      for (const lineIdx of lineIndices) {
        const y0 = pad + (lineIdx - baseLine) * stride
        drawSystem(lineIdx, y0)
        // Clear after outbound partials so the next system uses inbound partials
        placed.clear()
        fullTieFirstNotes.clear()
      }

      el.style.transition = 'none'
      el.style.willChange = 'transform'
      box.style.height = `${viewH}px`
      box.style.overflow = 'hidden'

      layout.current = {
        systems: systemsMeta,
        marginLeft,
        pad,
        stride,
        baseLine,
      }
    }

    draw()
  }, [notes, measure, activeNotes, selection, measures, themeEpoch, polarity, score, staffOf, hands, pieceDynMarks, baseLine, systems, lineClefs, minWidths, packOpts, boxWidth, dimStaff, noteMarks])

  // Every render (60fps during Play): just slide the drawing.
  useLayoutEffect(() => {
    const lay = layout.current
    const el = host.current
    if (!lay || !el) return
    const offset = lay.pad + (scrollPos - lay.baseLine) * lay.stride
    offsetRef.current = offset
    el.style.transform = `translateY(${-offset}px)`
  })

  const curLine = systemIndexOf(systems, measure)
  const cur = systems[curLine]
  const next = systems[curLine + 1]

  const handleClick = (e: MouseEvent) => {
    const lay = layout.current
    const box = wrap.current
    if (!lay || !box) return
    const rect = box.getBoundingClientRect()
    const x = e.clientX - rect.left - lay.marginLeft
    const y = e.clientY - rect.top + offsetRef.current
    const sys = lay.systems.find((s) => y >= s.top && y < s.bottom)
    if (!sys) return
    const widths = sys.barWidths
    const totalW = widths.reduce((a, w) => a + w, 0)
    if (x < 0 || x > totalW) return
    let acc = 0
    let bi = widths.length - 1
    for (let i = 0; i < widths.length; i++) {
      acc += widths[i]!
      if (x < acc) {
        bi = i
        break
      }
    }
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
      className={`staff-frame${polarity === 'dark-on-light' ? ' staff-frame--paper' : ''}`}
      onClick={handleClick}
      title="Click a bar to jump · Shift-click to select · Scroll to move measures"
    >
      <div ref={host} className="w-full" />
      <p className="pb-1 text-center font-ui text-xs text-dust">
        {cur ? `Bars ${cur.start}–${cur.start + cur.count - 1}` : ''}
        {next ? ` + next ${next.start}–${next.start + next.count - 1}` : ''}
        {' · '}playing {measure}
        {selLabel ?? ''}
        {' · '}
        {hands ? 'tracks→hands' : 'pitch→clef'} · click /
        shift-click · scroll · lines glide
      </p>
    </div>
  )
}
