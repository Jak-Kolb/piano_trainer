import { useEffect, useRef } from 'react'
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
import { durationToVex, midiToVexKey, notesInMeasure } from './midiToVex'

const BARS_PER_SYSTEM = 4

interface Props {
  notes: PieceNote[]
  /** Current walk-through measure (1-based) — system scrolls to include this. */
  measure: number
  activeMidis: number[]
  secPerQuarter: number
  /** Last measure available in the loop/piece. */
  measureCount: number
  width?: number
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

function toStaveNotes(
  groups: PieceNote[][],
  clef: 'treble' | 'bass',
  secPerQuarter: number,
  active: Set<number>,
): StaveNote[] {
  return groups.map((g) => {
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
    const isActive = g.some((n) => active.has(n.midi))
    sn.setStyle({
      fillStyle: isActive ? '#C08B3E' : '#EDE4D3',
      strokeStyle: isActive ? '#C08B3E' : '#EDE4D3',
    })
    return sn
  })
}

/**
 * Multi-bar system like reading music: 4 measures per line, notes spaced
 * by rhythm (not stretched to fill one bar).
 */
export function StaffNotation({
  notes,
  measure,
  activeMidis,
  secPerQuarter,
  measureCount,
  width = 900,
}: Props) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    el.innerHTML = ''

    const start =
      Math.floor((Math.max(1, measure) - 1) / BARS_PER_SYSTEM) * BARS_PER_SYSTEM +
      1
    const bars = Array.from({ length: BARS_PER_SYSTEM }, (_, i) => start + i).filter(
      (m) => m <= measureCount,
    )
    if (!bars.length) {
      el.innerHTML =
        '<p class="font-ui text-dust text-center py-8">Empty</p>'
      return
    }

    const systemNotes = notes.filter(
      (n) => n.measure >= bars[0]! && n.measure <= bars[bars.length - 1]!,
    )
    const hasTreble = systemNotes.some((n) => n.midi >= 60) || systemNotes.length === 0
    const hasBass = systemNotes.some((n) => n.midi < 60)
    const staveRows = (hasTreble ? 1 : 0) + (hasBass ? 1 : 0)
    const height = 30 + staveRows * 120

    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(width, height)
    const ctx = renderer.getContext()
    ctx.setFillStyle('#EDE4D3')
    ctx.setStrokeStyle('#5C6478')

    const active = new Set(activeMidis)
    const marginLeft = 16
    const usable = width - marginLeft - 16
    const barW = usable / bars.length

    const drawRow = (clef: 'treble' | 'bass', y: number, midiPred: (m: number) => boolean) => {
      let x = marginLeft
      bars.forEach((barNum, bi) => {
        const stave = new Stave(x, y, barW)
        if (bi === 0) stave.addClef(clef)
        if (bi === bars.length - 1) {
          stave.setEndBarType(Barline.type.SINGLE)
        }
        // Highlight current bar lightly via thicker left barline feel — use annotation in caption
        stave.setStyle({ fillStyle: '#EDE4D3', strokeStyle: '#5C6478' })
        stave.setContext(ctx).draw()

        const inBar = notesInMeasure(notes, barNum).filter((n) => midiPred(n.midi))
        // If this clef has nothing in the bar but the other might, leave rests empty (simple)
        const groups = groupOnsets(inBar)
        if (groups.length) {
          const vfNotes = toStaveNotes(groups, clef, secPerQuarter, active)
          const voice = new Voice({ num_beats: 4, beat_value: 4 }).setStrict(false)
          voice.addTickables(vfNotes)
          // Tight format width = bar interior so notes sit close like real music
          const inner = Math.max(40, barW - (bi === 0 ? 36 : 16))
          new Formatter().joinVoices([voice]).format([voice], inner)
          voice.draw(ctx, stave)
        }

        // Current-bar marker
        if (barNum === measure) {
          ctx.setStrokeStyle('#C08B3E')
          ctx.setLineWidth(2)
          ctx.beginPath()
          ctx.moveTo(x + 2, y + 10)
          ctx.lineTo(x + 2, y + 90)
          ctx.stroke()
          ctx.setLineWidth(1)
          ctx.setStrokeStyle('#5C6478')
        }

        x += barW
      })
    }

    let y = 10
    if (hasTreble) {
      drawRow('treble', y, (m) => m >= 60)
      y += 120
    }
    if (hasBass) {
      drawRow('bass', y, (m) => m < 60)
    }
  }, [notes, measure, activeMidis, secPerQuarter, measureCount, width])

  const start =
    Math.floor((Math.max(1, measure) - 1) / BARS_PER_SYSTEM) * BARS_PER_SYSTEM + 1
  const end = Math.min(measureCount, start + BARS_PER_SYSTEM - 1)

  return (
    <div className="w-full overflow-x-auto rounded bg-shadow px-2 py-2">
      <div ref={host} className="mx-auto" style={{ minHeight: 180 }} />
      <p className="pb-2 text-center font-ui text-xs text-dust">
        Bars {start}–{end} · current {measure} · MIDI spellings approximate
      </p>
    </div>
  )
}
