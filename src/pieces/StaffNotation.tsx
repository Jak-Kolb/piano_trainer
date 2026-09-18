import { useEffect, useRef, useState, type MouseEvent } from 'react'
import {
  Accidental,
  Barline,
  Beam,
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
  measureInfoAt,
  sliceNotesForTies,
  slicesInMeasure,
  type NoteSlice,
} from './tieSlices'
import type { MeasureInfo, PieceNote } from './types'
import { writtenAccidental } from './keySig'
import { dynamicMarksForPiece } from './dynamics'
import {
  durationToVex,
  midiToVexKey,
  restDurationsForBeats,
  type VexDuration,
} from './midiToVex'
import {
  isPureTieContinuation,
  shouldDrawPartialInbound,
  shouldDrawPartialOutbound,
} from './staffTies'
import {
  sheetColorsForPolarity,
  type SheetPolarity,
} from '../settings/colorProfile'

/** @deprecated Prefer barsPerSystem(beatsPerBar) — kept for callers. */
export const BARS_PER_SYSTEM = 6
const STAVE_H = 100
/** Vertical room between treble and bass (dynamics, ledger clearance). */
const CLEF_GAP = 18
/** Extra space above the top staff / below the bottom staff per system. */
const SYSTEM_PAD_TOP = 16
const SYSTEM_PAD_BOTTOM = 14
const SYSTEM_GAP = 28

/**
 * Line scroll in system-units.
 * Stay frozen through the entire first visible line. Once the playhead hits
 * the first measure of the *next* line, glide that line up so it lands exactly
 * where the first line was by the end of that next line.
 */
function lineScrollPos(
  measure: number,
  beatFrac: number,
  barsPerLine: number,
): number {
  const bps = Math.max(1, barsPerLine)
  const abs = Math.max(0, measure - 1) + Math.min(0.999, Math.max(0, beatFrac))
  const lineIdx = Math.floor(abs / bps)
  const within = (abs % bps) / bps // 0 at line start → ~1 at line end
  // Line 0 (first system): no motion. Later lines: glide 0→1 across that line,
  // which stacks as (lineIdx - 1) + within so boundaries stay continuous.
  if (lineIdx <= 0) return 0
  const eased = within * within * (3 - 2 * within) // smoothstep
  return lineIdx - 1 + eased
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
  /** Beats per bar from the piece time signature (default 4) — first bar. */
  beatsPerBar?: number
  /**
   * Per-measure absolute timeline (index 0 = measure 1). Required for correct
   * layout after tempo / time-signature changes.
   */
  measures: MeasureInfo[]
  /** Light notes on dark paper, or dark notes on light paper. */
  polarity?: SheetPolarity
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


/** VexFlow only counts dots in timing when duration is e.g. "qd" / "qdr". */
function vexDurationString(dur: VexDuration, rest: boolean): string {
  const dots = dur.dots > 0 ? 'd' : ''
  return rest ? `${dur.key}${dots}r` : `${dur.key}${dots}`
}

function makeRest(
  clef: 'treble' | 'bass',
  dur: VexDuration,
  colors: ReturnType<typeof sheetColorsForPolarity>,
): StaveNote {
  const restKey = clef === 'bass' ? 'd/3' : 'b/4'
  const rest = new StaveNote({
    keys: [restKey],
    duration: vexDurationString(dur, true),
    clef,
  })
  // Visual dot (ticks already include it via "qdr" etc.)
  if (dur.dots > 0) Dot.buildAndAttach([rest], { all: true })
  rest.setStyle({ fillStyle: colors.rest, strokeStyle: colors.rest })
  return rest
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
  notes: StaveNote[]
  /** For each StaveNote, the slices that built it (same order as keys). */
  sliceGroups: NoteSlice[][]
}


/**
 * When a clef has long sustains overlapping short melody notes, put them in
 * separate VexFlow voices so a whole-note hold does not consume the bar cursor
 * and drop the eighths (Another Love mm.31–33 style).
 */
function partitionClefSlices(inBar: NoteSlice[], measureInfo: MeasureInfo): NoteSlice[][] {
  const barBeats = measureInfo.beatsPerBar
  const spq = measureInfo.durationSec / barBeats
  const longThresh = spq * Math.max(2, barBeats * 0.7) // ~whole-bar or long hold
  const longs = inBar.filter(s => s.duration >= longThresh - 1e-6)
  const shorts = inBar.filter(s => s.duration < longThresh - 1e-6)
  if (!longs.length || !shorts.length) return [inBar]
  // Only split voices if they actually overlap in time
  const overlaps = longs.some(L => shorts.some(S =>
    S.time < L.time + L.duration - 0.02 && L.time < S.time + S.duration - 0.02
  ))
  if (!overlaps) return [inBar]
  return [longs, shorts]
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
  activeNotes: PieceNote[],
  measureInfo: MeasureInfo,
  keySignature: string,
  colors: ReturnType<typeof sheetColorsForPolarity>,
): Built {
  const groups = groupSlices(inBar)
  const notes: StaveNote[] = []
  const sliceGroups: NoteSlice[][] = []
  const barBeats = Math.max(1, measureInfo.beatsPerBar)
  // Local SPQ for this bar — critical when tempo changed since the first bar.
  const spq = Math.max(0.01, measureInfo.durationSec / barBeats)
  const barStart = measureInfo.startSec
  let cursor = 0 // beats from start of bar (must match Σ glyph beats)

  const emitRests = (beats: number) => {
    if (beats < 0.24) return
    const specs = restDurationsForBeats(beats)
    let placed = 0
    for (const rd of specs) {
      notes.push(makeRest(clef, rd, colors))
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

    const keys = g.map((s) => midiToVexKey(s.midi, keySignature))
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
      fillStyle: isActive ? colors.active : colors.note,
      strokeStyle: isActive ? colors.active : colors.note,
    })
    sn.setLedgerLineStyle({
      strokeStyle: isActive ? colors.active : colors.ledger,
      lineWidth: 1.25,
    })
    notes.push(sn)
    sliceGroups.push(g)
    cursor += dur.beats
    if (cursor > barBeats + 0.001) break
  }

  if (cursor < barBeats - 0.001) emitRests(barBeats - cursor)

  // Final safety: still empty → rests covering the bar
  if (!notes.length) {
    emitRests(barBeats)
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
  secPerQuarter: _secPerQuarter,
  measureCount,
  selection,
  onMeasurePointer,
  onMeasureScroll,
  nowSec,
  keySignature = 'C',
  barsPerLine = 6,
  beatsPerBar: _beatsPerBar = 4,
  measures,
  polarity = 'light-on-dark',
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const layout = useRef<{
    systems: { start: number; top: number; bottom: number; barWidths: number[] }[]
    marginLeft: number
    scrollY: number
  } | null>(null)
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

      void _beatsPerBar

      const slices = sliceNotesForTies(notes, measures)
      // One mark per real dynamic change in the piece (not per staff line)
      const pieceDynMarks = dynamicMarksForPiece(notes)

      const playInfo = measureInfoAt(measures, measure)
      const barStart = playInfo.startSec
      const barDur = Math.max(0.01, playInfo.durationSec)
      const tPlay =
        nowSec ??
        activeNotes[0]?.time ??
        barStart
      const beatFrac = Math.min(
        0.999,
        Math.max(0, (tPlay - barStart) / barDur),
      )
      const scrollPos = lineScrollPos(measure, beatFrac, BPS)

      // Visible systems in absolute line-index space (no local remapping —
      // remapping + CSS transition caused snaps on every handoff after 1→2).
      const baseLine = Math.max(0, Math.floor(scrollPos))
      const lineIndices: number[] = []
      for (let i = -1; i <= 2; i++) {
        const li = baseLine + i
        if (li < 0) continue
        const start = li * BPS + 1
        if (start <= measureCount) lineIndices.push(li)
      }
      if (lineIndices.length === 0) lineIndices.push(0)

      const windowLo = (lineIndices[0] ?? 0) * BPS + 1
      const windowNotes = notes.filter(
        (n) =>
          n.measure >= windowLo &&
          n.measure < windowLo + BPS * 4,
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

            const marginLeft = 8
      const usable = width - marginLeft - 8
      const systemsMeta: { start: number; top: number; bottom: number; barWidths: number[] }[] = []

      // Equal *music* width per bar. First bar of each system is wider by
      // CLEF_PAD so clef + key signature don't steal space from the notes
      // (which made the first measure look squished at the end).
      const NOTE_INSET = 28
      const CLEF_PAD = 52
      const barWidthsForSystem = (start: number): number[] => {
        const n = Math.max(0, Math.min(BPS, measureCount - start + 1))
        if (n <= 0) return []
        const musicUsable = Math.max(n * 60, usable - CLEF_PAD)
        const share = musicUsable / n
        return Array.from({ length: n }, (_, i) =>
          i === 0 ? share + CLEF_PAD : share,
        )
      }

      type TieKey = string
      const placed = new Map<
        TieKey,
        { sn: StaveNote; index: number; measure: number; tieToNext: boolean }
      >()
      /** StaveNotes that already got a full same-system outbound StaveTie. */
      const fullTieFirstNotes = new Set<StaveNote>()

      const drawSystem = (start: number, y0: number) => {
        const bars = Array.from(
          { length: BPS },
          (_, i) => start + i,
        )
        const barWidths = barWidthsForSystem(start)
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
          const leftReserve = bi === 0 ? NOTE_INSET + CLEF_PAD : NOTE_INSET

          type StaveRow = {
            clef: 'treble' | 'bass'
            stave: Stave
            layers: Built[]
          }
          const staves: StaveRow[] = []
          const barInfo = measureInfoAt(measures, barNum)

          if (showTreble) {
            const stave = new Stave(x, trebleY, barWidths[bi]!)
            if (bi === 0) {
              stave.addClef('treble')
              if (keySignature && keySignature !== 'C') {
                stave.addKeySignature(keySignature)
              }
              // Measure number at the start of each staff line (printed-music style).
              stave.setMeasure(start)
            }
            stave.setEndBarType(Barline.type.SINGLE)
            stave.setStyle({ fillStyle: colors.staff, strokeStyle: colors.staff, lineWidth: 1 })
            stave.setContext(ctx).draw()
            const inBar = slicesInMeasure(slices, barNum).filter(isTrebleNote)
            const layers = partitionClefSlices(inBar, barInfo).map((part) =>
              buildVoiceNotes(
                part,
                'treble',
                activeNotes,
                barInfo,
                keySignature,
                colors,
              ),
            )
            staves.push({ clef: 'treble', stave, layers })
          }

          if (showBass) {
            const stave = new Stave(x, bassY, barWidths[bi]!)
            if (bi === 0) {
              stave.addClef('bass')
              if (keySignature && keySignature !== 'C') {
                stave.addKeySignature(keySignature)
              }
            }
            stave.setEndBarType(Barline.type.SINGLE)
            stave.setStyle({ fillStyle: colors.staff, strokeStyle: colors.staff, lineWidth: 1 })
            stave.setContext(ctx).draw()
            const inBar = slicesInMeasure(slices, barNum).filter(isBassNote)
            const layers = partitionClefSlices(inBar, barInfo).map((part) =>
              buildVoiceNotes(
                part,
                'bass',
                activeNotes,
                barInfo,
                keySignature,
                colors,
              ),
            )
            staves.push({ clef: 'bass', stave, layers })
          }

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

          const barBeats = Math.max(1, barInfo.beatsPerBar)
          const voices: Voice[] = []
          const voiceStaves: Stave[] = []
          /** StaveNotes that are pure tie continuations — exclude from beams. */
          const continuationNotes = new Set<StaveNote>()
          for (const row of staves) {
            for (const built of row.layers) {
              built.sliceGroups.forEach((g, gi) => {
                if (isPureTieContinuation(g)) {
                  continuationNotes.add(built.notes[gi]!)
                }
              })
              const voice = new Voice({
                num_beats: barBeats,
                beat_value: 4,
              }).setStrict(false)
              voice.addTickables(built.notes)
              voices.push(voice)
              voiceStaves.push(row.stave)
            }
          }

          if (voices.length) {
            // Beam consecutive 8ths/16ths/… within each beat group (VexFlow
            // defaults for the bar's time signature). Create before format so
            // flags are suppressed; draw after voices so beams sit on top.
            // Skip pure tie-continuation chords so they aren't beamed into the
            // next eighths (squashed look at barlines like Another Love m49→m50).
            const timeSig = `${barBeats}/4`
            const beamGroups = Beam.getDefaultBeamGroups(timeSig)
            const beams: Beam[] = []
            for (const voice of voices) {
              const beamable = voice
                .getTickables()
                .filter((t) => !continuationNotes.has(t as StaveNote))
              beams.push(
                ...Beam.generateBeams(beamable as StaveNote[], {
                  groups: beamGroups,
                }),
              )
            }

            const fmt = new Formatter()
            fmt.joinVoices(voices)
            fmt.format(voices, inner)
            voices.forEach((voice, i) => {
              voice.draw(ctx, voiceStaves[i]!)
            })
            for (const beam of beams) {
              beam.setStyle({ fillStyle: colors.note, strokeStyle: colors.note })
              beam.setContext(ctx).draw()
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
                    Math.abs(fresh[0].time - mark.time) <= 0.08
                  ) {
                    sn = built.notes[gi]
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
                const sn = built.notes[gi]!
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
        const start = lineIdx * BPS + 1
        const y0 = pad + (lineIdx - scrollPos) * stride
        if (y0 > height || y0 + systemH < 0) {
          // Still clear so a skipped offscreen system doesn't leak partners
          placed.clear()
          fullTieFirstNotes.clear()
          continue
        }
        drawSystem(start, y0)
        // Clear after outbound partials so the next system uses inbound partials
        placed.clear()
        fullTieFirstNotes.clear()
      }

      el.style.transform = `translateY(${-pad}px)`
      el.style.transition = 'none'
      el.style.willChange = 'auto'
      box.style.height = `${viewH}px`
      box.style.overflow = 'hidden'

      layout.current = {
        systems: systemsMeta.map((s) => ({
          ...s,
          top: s.top - pad,
          bottom: s.bottom - pad,
        })),
        marginLeft,
        scrollY: scrollPos * stride,
      }
    }

    draw()
    const ro = new ResizeObserver(() => draw())
    ro.observe(box)
    return () => ro.disconnect()
  }, [notes, measure, activeNotes, nowSec, measureCount, selection, keySignature, BPS, measures, themeEpoch, polarity])

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
