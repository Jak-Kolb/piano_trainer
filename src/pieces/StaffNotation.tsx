import { useEffect, useRef } from 'react'
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow'
import type { PieceNote } from './types'
import { durationToVex, midiToVexKey, notesInMeasure } from './midiToVex'

interface Props {
  notes: PieceNote[]
  /** Measure to draw (1-based). */
  measure: number
  /** MIDI numbers in the current walk-through step — highlighted. */
  activeMidis: number[]
  secPerQuarter: number
  width?: number
}

/**
 * Renders one measure as treble and/or bass staves from MIDI-derived notes.
 * Enharmonics are approximate (MIDI has no spelling) — good enough to follow along.
 */
export function StaffNotation({
  notes,
  measure,
  activeMidis,
  secPerQuarter,
  width = 720,
}: Props) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    el.innerHTML = ''

    const inBar = notesInMeasure(notes, measure)
    if (!inBar.length) {
      el.innerHTML =
        '<p class="font-ui text-dust text-center py-8">Empty bar</p>'
      return
    }

    const trebleNotes = inBar.filter((n) => n.midi >= 60)
    const bassNotes = inBar.filter((n) => n.midi < 60)
    const showTreble = trebleNotes.length > 0 || bassNotes.length === 0
    const showBass = bassNotes.length > 0
    const staveCount = (showTreble ? 1 : 0) + (showBass ? 1 : 0)
    const height = 40 + staveCount * 110

    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(width, height)
    const ctx = renderer.getContext()
    ctx.setFillStyle('#EDE4D3')
    ctx.setStrokeStyle('#5C6478')

    const active = new Set(activeMidis)
    let y = 20

    const drawStave = (clef: 'treble' | 'bass', staveNotes: PieceNote[]) => {
      if (!staveNotes.length && clef === 'bass') return
      const pool = staveNotes.length ? staveNotes : inBar
      const stave = new Stave(20, y, width - 40)
      stave.addClef(clef)
      stave.setStyle({ fillStyle: '#EDE4D3', strokeStyle: '#5C6478' })
      stave.setContext(ctx).draw()

      // Chord-group notes that share nearly the same start time
      const groups: PieceNote[][] = []
      let cur: PieceNote[] = []
      let anchor = -1
      for (const n of [...pool].sort((a, b) => a.time - b.time || a.midi - b.midi)) {
        if (anchor < 0 || n.time - anchor > 0.05) {
          if (cur.length) groups.push(cur)
          cur = [n]
          anchor = n.time
        } else {
          cur.push(n)
        }
      }
      if (cur.length) groups.push(cur)

      const vfNotes: StaveNote[] = groups.map((g) => {
        const keys = g.map((n) => midiToVexKey(n.midi))
        const dur = durationToVex(
          Math.max(...g.map((n) => n.duration)),
          secPerQuarter,
        )
        const sn = new StaveNote({
          keys,
          duration: dur,
          clef,
        })
        // Accidentals from key string
        keys.forEach((k, i) => {
          const pitch = k.split('/')[0]!
          if (pitch.includes('#')) sn.addModifier(new Accidental('#'), i)
          if (pitch.includes('b')) sn.addModifier(new Accidental('b'), i)
        })
        const isActive = g.some((n) => active.has(n.midi))
        if (isActive) {
          sn.setStyle({
            fillStyle: '#C08B3E',
            strokeStyle: '#C08B3E',
          })
        } else {
          sn.setStyle({
            fillStyle: '#EDE4D3',
            strokeStyle: '#EDE4D3',
          })
        }
        return sn
      })

      if (vfNotes.length) {
        const voice = new Voice({
          num_beats: 4,
          beat_value: 4,
        }).setStrict(false)
        voice.addTickables(vfNotes)
        new Formatter().joinVoices([voice]).format([voice], width - 80)
        voice.draw(ctx, stave)
      }
      y += 110
    }

    if (showTreble) drawStave('treble', trebleNotes)
    if (showBass) drawStave('bass', bassNotes)
  }, [notes, measure, activeMidis, secPerQuarter, width])

  return (
    <div className="w-full overflow-x-auto rounded bg-shadow px-2 py-2">
      <div ref={host} className="mx-auto" style={{ minHeight: 160 }} />
      <p className="pb-2 text-center font-ui text-xs text-dust">
        Bar {measure} · staff from MIDI (spellings approximate)
      </p>
    </div>
  )
}
