/**
 * Sheet layout (pure): which bars share a staff line, how wide each bar is,
 * which clef each staff uses per line, and where the playhead scrolls to.
 */
import type { Clef, NotatedBar } from './notate'

export interface SystemPlan {
  /** First bar (1-based). */
  start: number
  count: number
}

export interface PackOptions {
  /** Drawable width for one line (px). */
  usable: number
  /** Most bars per line (from the meter). */
  maxBars: number
  /** Extra width of a line's first bar for clef + key. */
  clefPad: number
  /** Formatter inset per bar (left padding before the first note). */
  inset: number
  /** Extra room for time/key signatures printed at a bar's start. */
  padFor: (bar: number, lineStart: boolean) => number
}

/**
 * Greedy line breaking: add bars while their minimum widths fit, up to
 * maxBars. Dense bars (sextuplets, long runs) get fewer bars per line
 * instead of spilling past their barlines.
 */
export function packSystems(
  minWidths: number[],
  barCount: number,
  opts: PackOptions,
): SystemPlan[] {
  const systems: SystemPlan[] = []
  const need = (bar: number, lineStart: boolean) =>
    (minWidths[bar - 1] ?? 0) +
    opts.inset +
    opts.padFor(bar, lineStart) +
    (lineStart ? opts.clefPad : 0)
  let bar = 1
  while (bar <= barCount) {
    let used = need(bar, true)
    let count = 1
    while (
      count < opts.maxBars &&
      bar + count <= barCount &&
      used + need(bar + count, false) <= opts.usable
    ) {
      used += need(bar + count, false)
      count++
    }
    systems.push({ start: bar, count })
    bar += count
  }
  return systems
}

/**
 * Bar widths for one line: each bar gets its minimum plus an equal share of
 * the leftover, so evenly filled bars come out equal and dense ones wider.
 */
export function barWidths(
  sys: SystemPlan,
  minWidths: number[],
  opts: PackOptions,
): { widths: number[]; pads: number[] } {
  const pads: number[] = []
  const base: number[] = []
  for (let i = 0; i < sys.count; i++) {
    const bar = sys.start + i
    const pad = opts.padFor(bar, i === 0)
    pads.push(pad)
    base.push((minWidths[bar - 1] ?? 0) + opts.inset + pad + (i === 0 ? opts.clefPad : 0))
  }
  const slack = Math.max(0, opts.usable - base.reduce((a, w) => a + w, 0))
  return { widths: base.map((w) => w + slack / sys.count), pads }
}

export function systemIndexOf(systems: SystemPlan[], measure: number): number {
  let lo = 0
  let hi = systems.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (systems[mid]!.start <= measure) lo = mid
    else hi = mid - 1
  }
  return Math.max(0, lo)
}

/**
 * Line scroll in system-units.
 * Stay frozen through the entire first visible line. Once the playhead hits
 * the first measure of the *next* line, glide that line up so it lands exactly
 * where the first line was by the end of that next line.
 */
export function lineScrollPos(
  systems: SystemPlan[],
  measure: number,
  beatFrac: number,
): number {
  if (!systems.length) return 0
  const lineIdx = systemIndexOf(systems, measure)
  const sys = systems[lineIdx]!
  const within = Math.min(
    0.999,
    (Math.max(0, measure - sys.start) + Math.min(0.999, Math.max(0, beatFrac))) /
      sys.count,
  )
  // Line 0 (first system): no motion. Later lines: glide 0→1 across that line,
  // which stacks as (lineIdx - 1) + within so boundaries stay continuous.
  if (lineIdx <= 0) return 0
  const eased = within * within * (3 - 2 * within) // smoothstep
  return lineIdx - 1 + eased
}

/** Diatonic step of a MIDI note (C4 = 35), spelling black keys as sharps. */
const LETTER_OF_PC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
function diatonic(midi: number): number {
  return Math.floor(midi / 12) * 7 + LETTER_OF_PC[((midi % 12) + 12) % 12]!
}

/** Staff range (bottom line, top line) as diatonic steps. */
const STAFF_RANGE: Record<Clef, [number, number]> = {
  treble: [diatonic(64), diatonic(77)], // E4 … F5
  bass: [diatonic(43), diatonic(57)], // G2 … A3
}

export function ledgerLines(midi: number, clef: Clef): number {
  const d = diatonic(midi)
  const [bottom, top] = STAFF_RANGE[clef]
  if (d < bottom) return Math.floor((bottom - d) / 2)
  if (d > top) return Math.floor((d - top) / 2)
  return 0
}

/**
 * Clef each staff prints on one line. A hand that sits well outside its
 * usual clef for the whole line (low right-hand octaves, a high left hand)
 * switches clef instead of stacking ledger lines, as printed piano music
 * does: when the line averages a ledger line per note and the other clef
 * would need less than half as many.
 */
export function clefsForSystem(
  score: NotatedBar[],
  sys: SystemPlan,
): Record<Clef, Clef> {
  const pick = (staff: Clef, other: Clef): Clef => {
    let count = 0
    let here = 0
    let there = 0
    for (let b = sys.start; b < sys.start + sys.count; b++) {
      for (const v of score[b - 1]?.staves[staff] ?? []) {
        for (const e of v.events) {
          for (const n of e.notes) {
            count++
            here += ledgerLines(n.midi, staff)
            there += ledgerLines(n.midi, other)
          }
        }
      }
    }
    return count > 0 && here >= count && there * 2 < here ? other : staff
  }
  return { treble: pick('treble', 'bass'), bass: pick('bass', 'treble') }
}
