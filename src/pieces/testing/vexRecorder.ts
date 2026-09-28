/**
 * Test-only VexFlow spy. Use from a test file:
 *
 *   vi.mock('vexflow', async (orig) =>
 *     (await import('./testing/vexRecorder')).recordingVexflow(await orig()))
 *
 * Records what StaffNotation actually drew, grouped by bar and clef, without
 * depending on the order the component builds things in.
 */

export interface DrawnNote {
  keys: string[]
  /** VexFlow duration string as constructed, e.g. "8", "qd", "hr". */
  dur: string
  rest: boolean
  ghost: boolean
  stem: number | null
}

export interface DrawnVoice {
  notes: DrawnNote[]
  usedQ: number
  totalQ: number
}

export interface DrawnStave {
  bar: number
  /** Which staff: "treble" = upper (right hand), "bass" = lower (left hand). */
  clef: string
  /** Clef actually printed for this staff on this line. */
  drawnClef: string
  x: number
  y: number
  timeSig?: string
  keySig?: string
  cancelKey?: string
  voices: DrawnVoice[]
}

interface RawStave extends Omit<DrawnStave, 'bar' | 'clef'> {
  measure: number
}

const TICKS_PER_QUARTER = 4096

export const vexLog = {
  raw: [] as RawStave[],
  /** Staves that drew only a centred whole rest (MultiMeasureRest). */
  wholeBarRests: 0,
  renderers: 0,
  /** Tuplets as drawn (width measuring builds throwaway ones too). */
  tuplets: [] as { notes: number; num: number; bracketed: boolean; ratioed: boolean }[],
}

export function resetVexLog(): void {
  vexLog.raw = []
  vexLog.wholeBarRests = 0
  vexLog.renderers = 0
  vexLog.tuplets = []
}

type AnyCtor = new (...args: any[]) => any

export function recordingVexflow(mod: Record<string, any>): Record<string, any> {
  const byStave = new WeakMap<object, RawStave>()
  const Base = {
    Stave: mod.Stave as AnyCtor,
    StaveNote: mod.StaveNote as AnyCtor,
    GhostNote: mod.GhostNote as AnyCtor,
    Voice: mod.Voice as AnyCtor,
    Tuplet: mod.Tuplet as AnyCtor,
    Renderer: mod.Renderer as AnyCtor,
    MultiMeasureRest: mod.MultiMeasureRest as AnyCtor,
  }

  class Stave extends Base.Stave {
    __mods: Partial<RawStave> = {}
    addKeySignature(key: string, cancel?: string, ...rest: any[]) {
      this.__mods.keySig = key
      if (cancel) this.__mods.cancelKey = cancel
      return super.addKeySignature(key, cancel, ...rest)
    }
    addTimeSignature(t: string, ...rest: any[]) {
      this.__mods.timeSig = t
      return super.addTimeSignature(t, ...rest)
    }
    draw(...args: any[]) {
      const rec: RawStave = {
        ...this.__mods,
        drawnClef: this.getClef(),
        x: this.getX(),
        y: this.getY(),
        measure: this.getMeasure(),
        voices: [],
      }
      byStave.set(this, rec)
      vexLog.raw.push(rec)
      return super.draw(...args)
    }
  }

  class StaveNote extends Base.StaveNote {
    __dur: string
    __clef: string
    constructor(struct: any) {
      super(struct)
      this.__dur = struct.duration
      this.__clef = struct.clef ?? 'treble'
    }
  }

  class GhostNote extends Base.GhostNote {
    __dur: string
    constructor(struct: any) {
      super(struct)
      this.__dur = typeof struct === 'string' ? struct : struct.duration
    }
  }

  class Voice extends Base.Voice {
    draw(ctx: any, stave: any) {
      const rec = byStave.get(stave)
      if (rec) {
        rec.voices.push({
          notes: this.getTickables().map((t: any) => ({
            keys: typeof t.getKeys === 'function' ? t.getKeys() : [],
            dur: t.__dur ?? '',
            rest: typeof t.isRest === 'function' ? t.isRest() : false,
            ghost: t instanceof Base.GhostNote,
            stem:
              typeof t.getStemDirection === 'function' && t.hasStem?.()
                ? t.getStemDirection()
                : null,
            clef: t.__clef,
          })),
          usedQ: this.getTicksUsed().value() / TICKS_PER_QUARTER,
          totalQ: this.getTotalTicks().value() / TICKS_PER_QUARTER,
        })
      }
      return super.draw(ctx, stave)
    }
  }

  class Tuplet extends Base.Tuplet {
    __rec: { notes: number; num: number; bracketed: boolean; ratioed: boolean }
    constructor(notes: any[], options?: any) {
      super(notes, options)
      this.__rec = {
        notes: notes.length,
        num: options?.num_notes ?? notes.length,
        bracketed: options?.bracketed ?? true,
        ratioed: options?.ratioed ?? false,
      }
    }
    draw(...args: any[]) {
      vexLog.tuplets.push(this.__rec)
      return super.draw(...args)
    }
  }

  class MultiMeasureRest extends Base.MultiMeasureRest {
    draw(...args: any[]) {
      vexLog.wholeBarRests += 1
      return super.draw(...args)
    }
  }

  class Renderer extends Base.Renderer {
    constructor(...args: any[]) {
      super(...args)
      vexLog.renderers += 1
    }
  }

  return { ...mod, Stave, StaveNote, GhostNote, Voice, Tuplet, Renderer, MultiMeasureRest }
}

/**
 * Staves in drawing order, labeled with bar number and staff.
 * Each system's upper row carries the measure number on its first stave;
 * the row below it in the same system is the lower staff. Bars within a row
 * are numbered by column (x).
 */
export function drawnStaves(): DrawnStave[] {
  const rows: { y: number; staves: RawStave[] }[] = []
  for (const s of vexLog.raw) {
    let row = rows.find((r) => Math.abs(r.y - s.y) < 0.5)
    if (!row) {
      row = { y: s.y, staves: [] }
      rows.push(row)
    }
    row.staves.push(s)
  }
  const out: DrawnStave[] = []
  let systemStart = 1
  for (const row of rows) {
    const sorted = [...row.staves].sort((a, b) => a.x - b.x)
    const lead = sorted.find((s) => s.measure > 0)
    if (lead) systemStart = lead.measure
    const staff = lead ? 'treble' : 'bass'
    sorted.forEach((s, i) => {
      out.push({
        bar: systemStart + i,
        clef: staff,
        drawnClef: s.drawnClef,
        x: s.x,
        y: s.y,
        timeSig: s.timeSig,
        keySig: s.keySig,
        cancelKey: s.cancelKey,
        voices: s.voices,
      })
    })
  }
  return out
}

/** Durations drawn for one bar/clef, voice by voice ("c/4:8 d/4:8 ..."). */
export function barRhythm(
  bar: number,
  clef: 'treble' | 'bass',
  staves = drawnStaves(),
): string[] {
  const st = staves.find((s) => s.bar === bar && s.clef === clef)
  if (!st) return []
  return st.voices.map((v) =>
    v.notes
      .filter((n) => !n.ghost)
      .map((n) => (n.rest ? `r:${n.dur}` : `${n.keys.join('+')}:${n.dur}`))
      .join(' '),
  )
}
