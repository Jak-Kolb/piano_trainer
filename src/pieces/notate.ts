/**
 * MIDI notes → engraved score model (pure; no VexFlow).
 *
 * Positions are integer ticks with TPQ per quarter note, so sixteenths (3),
 * eighth-note triplets (4) and sixteenth sextuplets (2) are all exact.
 *
 * Pipeline per staff:
 *  1. Pick a grid per beat (straight 16ths, or triplets when the onsets
 *     clearly sit on thirds) and quantize onsets/releases to it.
 *  2. Written length = up to the next onset: small release gaps and small
 *     legato overlaps are absorbed; a note held well past the next onset is
 *     a sustained note.
 *  3. Sustained notes go in a second voice (max two voices per staff).
 *  4. Cut each voice at barlines and tuplet beats, fill gaps with rests, and
 *     spell values, ties and accidentals per bar.
 */
import { accidentalForMeasure } from './keySig'
import { barQuarters, isCompound } from './meter'
import { midiToVexKey } from './midiToVex'
import { resolveHands } from './parseMidi'
import { measureInfoAt } from './tieSlices'
import type { MeasureInfo, PieceNote } from './types'

export const TPQ = 12
const DUPLE_STEP = 3

export type Clef = 'treble' | 'bass'
export const CLEFS: readonly Clef[] = ['treble', 'bass']

export interface NotatedNote {
  midi: number
  /** VexFlow key, e.g. "c#/4". */
  key: string
  accidental: '#' | 'b' | 'bb' | 'n' | null
  tieFromPrev: boolean
  tieToNext: boolean
  /** Stable id of the source MIDI note (pairs tie segments). */
  id: string
  /** Onset (seconds) of the source note, for step highlighting / dynamics. */
  sourceTime: number
  velocity: number
}

export interface TupletRef {
  id: string
  numNotes: 3 | 6
  notesOccupied: 2 | 4
}

export interface NotatedEvent {
  /** Start within the bar, ticks. */
  start: number
  /** Sounding length, ticks (after tuplet scaling). */
  ticks: number
  /** Written VexFlow value before tuplet scaling: "w" | "h" | "q" | "8" | "16". */
  value: string
  dots: number
  rest: boolean
  /** Invisible spacer rest (a second voice's silence). */
  hidden: boolean
  /** Sorted low → high. Empty for rests. */
  notes: NotatedNote[]
  tuplet: TupletRef | null
}

export interface NotatedVoice {
  events: NotatedEvent[]
  stem: 'up' | 'down' | 'auto'
}

export interface NotatedBar {
  bar: number
  staves: Record<Clef, NotatedVoice[]>
}

/** Which staff a note goes on: by hand track when there are two, else by pitch. */
export function staffAssigner(notes: PieceNote[]): (n: PieceNote) => Clef {
  const hands = resolveHands(notes)
  return (n) => {
    if (hands && n.track === hands.lh) return 'bass'
    if (hands && n.track === hands.rh) return 'treble'
    return n.midi < 60 ? 'bass' : 'treble'
  }
}

export function noteId(n: PieceNote): string {
  return `${n.track}:${n.midi}:${n.time.toFixed(4)}`
}

// ---------------------------------------------------------------------------
// Bar geometry

interface Geometry {
  count: number
  info: (bar: number) => MeasureInfo
  /** Global tick of bar start; index bar-1, plus a sentinel at [count]. */
  starts: number[]
  lens: number[]
  locate: (sec: number) => { bar: number; q: number }
  /** First beat boundary at or after `tick` (eighths in x/8 bars). */
  beatAfter: (tick: number) => number
}

function geometry(measures: MeasureInfo[], barCount: number): Geometry {
  const count = Math.max(1, barCount)
  const infos = Array.from({ length: count }, (_, i) =>
    measureInfoAt(measures, i + 1),
  )
  const starts: number[] = []
  const lens: number[] = []
  let acc = 0
  for (const m of infos) {
    starts.push(acc)
    const len = Math.max(DUPLE_STEP, Math.round(barQuarters(m) * TPQ))
    lens.push(len)
    acc += len
  }
  starts.push(acc)
  const info = (bar: number) => infos[Math.min(count, Math.max(1, bar)) - 1]!
  const locate = (sec: number) => {
    let lo = 1
    let hi = count
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (infos[mid - 1]!.startSec <= sec + 1e-9) lo = mid
      else hi = mid - 1
    }
    const m = infos[lo - 1]!
    const spq = m.durationSec / Math.max(0.25, barQuarters(m))
    return { bar: lo, q: (sec - m.startSec) / Math.max(1e-6, spq) }
  }
  const beatAfter = (tick: number) => {
    let lo = 1
    let hi = count
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid - 1]! <= tick) lo = mid
      else hi = mid - 1
    }
    const bs = starts[lo - 1]!
    const unit = beatAnalysed(infos[lo - 1]!) ? TPQ : TPQ / 2
    return Math.min(starts[lo]!, bs + Math.ceil((tick - bs) / unit) * unit)
  }
  return { count, info, starts, lens, locate, beatAfter }
}

/** Beat-analysed bars (x/4, x/2) can hold triplets; x/8 bars stay duple. */
const beatAnalysed = (m: MeasureInfo) => (m.beatUnit || 4) <= 4

/** Beat (quarter) a time falls in, allowing notes a hair early. */
function beatOf(g: Geometry, sec: number): { bar: number; k: number; x: number } {
  let { bar, q } = g.locate(sec)
  let k = Math.floor(q + 1 / 12)
  if (k * TPQ >= g.lens[bar - 1]! && bar < g.count) {
    q -= g.lens[bar - 1]! / TPQ
    bar += 1
    k = Math.floor(q + 1 / 12)
  }
  return { bar, k, x: q - k }
}

/** Grid step (ticks) that best fits these in-beat offsets (quarters). */
export function chooseStep(xs: number[]): number {
  const err = (step: number) =>
    xs.reduce((a, x) => {
      const t = x * TPQ
      return a + Math.abs(t - Math.round(t / step) * step)
    }, 0) / TPQ
  const duple = err(DUPLE_STEP)
  if (duple < 1e-6) return DUPLE_STEP
  const triplet = err(4)
  const sextuplet = err(2)
  const best =
    triplet <= sextuplet + 0.01 * xs.length
      ? { step: 4, e: triplet }
      : { step: 2, e: sextuplet }
  // Triplets need clear evidence over straight sixteenths.
  return best.e + 0.03 * xs.length < duple ? best.step : DUPLE_STEP
}

// ---------------------------------------------------------------------------
// Written values

type Value = [ticks: number, value: string, dots: number]

const DUPLE_VALUES: Value[] = [
  [48, 'w', 0],
  [36, 'h', 1],
  [24, 'h', 0],
  [18, 'q', 1],
  [12, 'q', 0],
  [9, '8', 1],
  [6, '8', 0],
  [3, '16', 0],
]

/** Written values inside a tuplet beat (sounding ticks after 2/3 scaling). */
const TUPLET_VALUES: Record<number, Value[]> = {
  4: [
    [8, 'q', 0],
    [4, '8', 0],
  ],
  2: [
    [8, 'q', 0],
    [6, '8', 1],
    [4, '8', 0],
    [2, '16', 0],
  ],
}

interface Piece {
  start: number
  ticks: number
  value: string
  dots: number
}

/** Split a duple span into printable values that respect the beat. */
function duplePieces(
  start: number,
  len: number,
  rest: boolean,
  compound: boolean,
): Piece[] {
  const out: Piece[] = []
  let s = start
  let left = len
  const fits = (v: number) => {
    if (v > left) return false
    if (compound) {
      if (v >= 18) return s % 18 === 0
      return Math.floor(s / 18) === Math.floor((s + v - 1) / 18)
    }
    if (rest) {
      if (v >= 12) return s % 12 === 0 && (v !== 48 || s === 0)
      return Math.floor(s / 12) === Math.floor((s + v - 1) / 12)
    }
    if (v === 48) return s === 0
    if (v >= 24) return s % 12 === 0
    if (v >= 12) return s % 6 === 0
    return s % 3 === 0
  }
  while (left > 0) {
    const row = DUPLE_VALUES.find(([v]) => fits(v))
    // Off-grid leftovers (shouldn't happen) fall back to a sixteenth.
    const [v, value, dots] = row ?? [Math.min(left, 3), '16', 0]
    out.push({ start: s, ticks: v, value, dots })
    s += v
    left -= v
  }
  return out
}

function tupletPieces(start: number, len: number, step: number): Piece[] {
  const table = TUPLET_VALUES[step]!
  const out: Piece[] = []
  let s = start
  let left = len
  while (left > 0) {
    const [v, value, dots] = table.find(([t]) => t <= left) ?? [left, '16', 0]
    out.push({ start: s, ticks: v, value, dots })
    s += v
    left -= v
  }
  return out
}

// ---------------------------------------------------------------------------
// Main

interface Placed {
  n: PieceNote
  id: string
  on: number
  off: number
  step: number
}

interface Chord {
  on: number
  end: number
  notes: Placed[]
}

interface VoiceLine {
  chords: Chord[]
  busyUntil: number
  lastPitch: number | null
}

const MAX_VOICES = 2

const meanPitch = (ps: Placed[]) =>
  ps.reduce((a, p) => a + p.n.midi, 0) / Math.max(1, ps.length)

function lowerBound(arr: number[], x: number): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid]! < x) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Written end for each note (see file comment, step 2). */
function writtenEnds(
  placed: Placed[],
  beatAfter: (tick: number) => number,
): number[] {
  const ons = [...new Set(placed.map((p) => p.on))].sort((a, b) => a - b)
  const byPitch = new Map<number, number[]>()
  for (const p of placed) {
    const list = byPitch.get(p.n.midi) ?? []
    list.push(p.on)
    byPitch.set(p.n.midi, list)
  }
  for (const list of byPitch.values()) list.sort((a, b) => a - b)

  return placed.map((p) => {
    let e = Math.max(p.off, p.on + p.step)
    const same = byPitch.get(p.n.midi)!
    const reattack = same[lowerBound(same, p.on + 1)]
    if (reattack !== undefined) e = Math.min(e, reattack)
    const next = ons[lowerBound(ons, p.on + 1)]
    // Before a rest (or the end), a release just shy of the beat means the beat.
    const snapToBeat = () => {
      const b = beatAfter(e)
      if (b > e && (next === undefined || b <= next) && (b - e) * 2 < b - p.on) e = b
    }
    if (next === undefined) {
      snapToBeat()
      return e
    }
    const ioi = next - p.on
    if (e <= next) {
      if ((next - e) * 2 < ioi) e = next
      else snapToBeat()
    } else if ((e - next) * 2 < ioi) {
      e = next
    } else {
      // Sustained: snap a ragged release onto a nearby onset (or the next
      // beat when nothing follows), preferring one on a beat so a note let
      // go just before the bar line still reaches it.
      const i = lowerBound(ons, e)
      const near = [ons[i - 1], ons[i] ?? beatAfter(e)].filter(
        (o): o is number => o !== undefined && o > p.on && Math.abs(o - e) <= DUPLE_STEP,
      )
      const snap = near.find((o) => beatAfter(o) === o) ?? near[0]
      if (snap !== undefined) e = snap
    }
    return e
  })
}

/**
 * Assign chords to at most two voices: continue the voice that was just
 * playing (a single line stays one voice); pitch decides between voices
 * that both just finished.
 */
function assignVoices(chords: Chord[]): VoiceLine[] {
  const voices: VoiceLine[] = Array.from({ length: MAX_VOICES }, () => ({
    chords: [],
    busyUntil: -Infinity,
    lastPitch: null,
  }))
  for (const chord of chords) {
    let free = voices.filter((v) => v.busyUntil <= chord.on)
    if (!free.length) {
      // Cut short the most recently started note to make room.
      const v = voices.reduce((a, b) =>
        a.chords.at(-1)!.on >= b.chords.at(-1)!.on ? a : b,
      )
      const last = v.chords.at(-1)!
      if (last.on < chord.on) {
        last.end = chord.on
        v.busyUntil = chord.on
      } else {
        // Same onset, third distinct length: merge at the shorter length.
        last.notes.push(...chord.notes)
        last.end = Math.min(last.end, chord.end)
        v.busyUntil = last.end
        continue
      }
      free = [v]
    }
    const pitch = meanPitch(chord.notes)
    const idle = (v: VoiceLine) => chord.on - v.busyUntil
    const cost = (v: VoiceLine) =>
      v.lastPitch === null ? 12 : Math.abs(v.lastPitch - pitch)
    const pick = free.reduce((a, b) => {
      if (idle(a) !== idle(b)) return idle(b) < idle(a) ? b : a
      return cost(b) < cost(a) ? b : a
    })
    pick.chords.push(chord)
    pick.busyUntil = chord.end
    pick.lastPitch = pitch
  }
  return voices
}

interface Segment {
  start: number
  end: number
  chord: Chord | null
  tieFromPrev: boolean
  tieToNext: boolean
}

/** One voice's content inside a bar (bar-relative ticks), gaps as rests. */
function barSegments(line: VoiceLine, bs: number, be: number): Segment[] {
  const out: Segment[] = []
  let cursor = bs
  for (const c of line.chords) {
    if (c.end <= bs || c.on >= be) continue
    const s = Math.max(c.on, bs)
    const e = Math.min(c.end, be)
    if (s > cursor) {
      out.push({ start: cursor - bs, end: s - bs, chord: null, tieFromPrev: false, tieToNext: false })
    }
    out.push({
      start: s - bs,
      end: e - bs,
      chord: c,
      tieFromPrev: c.on < bs,
      tieToNext: c.end > be,
    })
    cursor = e
  }
  if (cursor < be) {
    out.push({ start: cursor - bs, end: be - bs, chord: null, tieFromPrev: false, tieToNext: false })
  }
  return out
}

export function notatePiece(
  notes: PieceNote[],
  measures: MeasureInfo[],
  barCount: number,
  staffOf: (n: PieceNote) => Clef = staffAssigner(notes),
): NotatedBar[] {
  const g = geometry(measures, barCount)

  // 1. Grid per staff-beat from onsets.
  const onsetsByBeat = new Map<string, number[]>()
  const beatKey = (clef: Clef, bar: number, k: number) => `${clef}:${bar}:${k}`
  for (const n of notes) {
    const { bar, k, x } = beatOf(g, n.time)
    if (!beatAnalysed(g.info(bar))) continue
    const key = beatKey(staffOf(n), bar, k)
    const list = onsetsByBeat.get(key) ?? []
    list.push(x)
    onsetsByBeat.set(key, list)
  }
  const steps = new Map<string, number>()
  for (const [key, xs] of onsetsByBeat) steps.set(key, chooseStep(xs))

  const quantize = (clef: Clef, sec: number): { tick: number; step: number } => {
    const { bar, k, x } = beatOf(g, sec)
    let tick: number
    let step = DUPLE_STEP
    if (beatAnalysed(g.info(bar))) {
      step = steps.get(beatKey(clef, bar, k)) ?? DUPLE_STEP
      tick = k * TPQ + Math.round((x * TPQ) / step) * step
    } else {
      tick = Math.round(((k + x) * TPQ) / step) * step
    }
    return { tick: g.starts[bar - 1]! + Math.max(0, tick), step }
  }

  const total = g.starts[g.count]!
  const byStaff: Record<Clef, Placed[]> = { treble: [], bass: [] }
  for (const n of notes) {
    const clef = staffOf(n)
    const on = quantize(clef, n.time)
    const off = quantize(clef, n.time + n.duration)
    if (on.tick >= total) continue
    byStaff[clef].push({
      n,
      id: noteId(n),
      on: on.tick,
      off: Math.min(total, off.tick),
      step: on.step,
    })
  }

  // 2–3. Written lengths → chords → voices.
  const lines: Record<Clef, VoiceLine[]> = { treble: [], bass: [] }
  for (const clef of CLEFS) {
    // Same pitch struck twice on one tick (doubled tracks): keep the longer.
    const uniq = new Map<string, Placed>()
    for (const p of byStaff[clef]) {
      const key = `${p.on}:${p.n.midi}`
      const prev = uniq.get(key)
      if (!prev || p.off > prev.off) uniq.set(key, p)
    }
    const placed = [...uniq.values()].sort((a, b) => a.on - b.on || a.n.midi - b.n.midi)
    const ends = writtenEnds(placed, g.beatAfter)
    const chordMap = new Map<string, Chord>()
    placed.forEach((p, i) => {
      const end = Math.min(total, ends[i]!)
      if (end <= p.on) return
      const key = `${p.on}:${end}`
      const chord = chordMap.get(key) ?? { on: p.on, end, notes: [] }
      chord.notes.push(p)
      chordMap.set(key, chord)
    })
    const chords = [...chordMap.values()].sort(
      (a, b) => a.on - b.on || b.end - a.end,
    )
    lines[clef] = assignVoices(chords)
  }

  // 4. Per bar output.
  const bars: NotatedBar[] = []
  for (let bar = 1; bar <= g.count; bar++) {
    const info = g.info(bar)
    const bs = g.starts[bar - 1]!
    const be = g.starts[bar]!
    const len = be - bs
    const compound = isCompound(info)
    const staves = { treble: [], bass: [] } as Record<Clef, NotatedVoice[]>

    for (const clef of CLEFS) {
      const perVoice = lines[clef]
        .map((line, vi) => ({ vi, segs: barSegments(line, bs, be) }))
        .filter((v) => v.segs.some((s) => s.chord))
      const two = perVoice.length > 1
      const noteCount = (segs: Segment[]) => segs.filter((s) => s.chord).length
      const primary = two
        ? perVoice.reduce((a, b) => (noteCount(b.segs) > noteCount(a.segs) ? b : a)).vi
        : -1
      const avg = (segs: Segment[]) => {
        const ps = segs.flatMap((s) => s.chord?.notes ?? [])
        return meanPitch(ps)
      }
      const upper = two
        ? perVoice.reduce((a, b) => (avg(b.segs) > avg(a.segs) ? b : a)).vi
        : -1

      const voices: NotatedVoice[] = (
        perVoice.length ? perVoice : [{ vi: 0, segs: [{ start: 0, end: len, chord: null, tieFromPrev: false, tieToNext: false }] }]
      ).map(({ vi, segs }) => {
        const tupletBeats = new Map<number, number>()
        if (beatAnalysed(info)) {
          for (const s of segs) {
            for (const b of [s.start, s.end]) {
              if (b % DUPLE_STEP === 0) continue
              const k = Math.floor(b / TPQ)
              const step = steps.get(beatKey(clef, bar, k))
              tupletBeats.set(k, step === 2 || step === 4 ? step : 2)
            }
          }
        }
        const events: NotatedEvent[] = []
        for (const seg of segs) {
          // Split at tuplet-beat boundaries so each cell stands alone.
          const cuts = [seg.start]
          for (let k = Math.floor(seg.start / TPQ) + 1; k * TPQ < seg.end; k++) {
            if (tupletBeats.has(k) || tupletBeats.has(k - 1)) cuts.push(k * TPQ)
          }
          cuts.push(seg.end)
          const pieces: (Piece & { tuplet: TupletRef | null })[] = []
          for (let i = 0; i + 1 < cuts.length; i++) {
            const a = cuts[i]!
            const b = cuts[i + 1]!
            const k = Math.floor(a / TPQ)
            const tStep = tupletBeats.get(k)
            if (tStep && b <= (k + 1) * TPQ) {
              const tuplet: TupletRef = {
                id: `${clef}-${bar}-${vi}-${k}`,
                numNotes: tStep === 4 ? 3 : 6,
                notesOccupied: tStep === 4 ? 2 : 4,
              }
              for (const p of tupletPieces(a, b - a, tStep)) pieces.push({ ...p, tuplet })
            } else {
              for (const p of duplePieces(a, b - a, !seg.chord, compound)) {
                pieces.push({ ...p, tuplet: null })
              }
            }
          }
          pieces.forEach((p, i) => {
            const first = i === 0
            const lastPiece = i === pieces.length - 1
            const ps = seg.chord ? [...seg.chord.notes].sort((a, b) => a.n.midi - b.n.midi) : []
            events.push({
              start: p.start,
              ticks: p.ticks,
              value: p.value,
              dots: p.dots,
              rest: !seg.chord,
              hidden: !seg.chord && two && vi !== primary,
              tuplet: p.tuplet,
              notes: ps.map((q) => ({
                midi: q.n.midi,
                key: midiToVexKey(q.n.midi, info.keySignature),
                accidental: null,
                tieFromPrev: first ? seg.tieFromPrev : true,
                tieToNext: lastPiece ? seg.tieToNext : true,
                id: q.id,
                sourceTime: q.n.time,
                velocity: q.n.velocity,
              })),
            })
          })
        }
        const stem: NotatedVoice['stem'] = two ? (vi === upper ? 'up' : 'down') : 'auto'
        return { events, stem }
      })

      // Accidentals persist through the bar across both voices, in time order.
      const seen = new Map<string, string>()
      const timeline = voices
        .flatMap((v, vi) => v.events.map((e) => ({ e, vi })))
        .sort((a, b) => a.e.start - b.e.start || a.vi - b.vi)
      for (const { e } of timeline) {
        for (const note of e.notes) {
          if (note.tieFromPrev) continue
          const [pitch, oct] = note.key.split('/')
          note.accidental = accidentalForMeasure(pitch!, oct!, info.keySignature, seen)
        }
      }
      staves[clef] = voices
    }
    bars.push({ bar, staves })
  }
  return bars
}
