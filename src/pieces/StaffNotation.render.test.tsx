// @vitest-environment jsdom
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { parseMidiArrayBuffer } from './parseMidi'
import { mountStaff, renderStaff } from './testing/renderStaff'
import { synthMidi, type SynthOptions } from './testing/synthMidi'
import { barRhythm, drawnStaves, vexLog } from './testing/vexRecorder'

vi.mock('vexflow', async (orig) =>
  (await import('./testing/vexRecorder')).recordingVexflow(await orig()),
)

async function draw(opts: SynthOptions, measure = 1) {
  const parsed = await parseMidiArrayBuffer(synthMidi(opts))
  return renderStaff(parsed, { measure })
}

/** Right hand on track 0, a held low note on track 1 so both staves exist. */
const withBass = (bars: number, barQ: number): SynthOptions['notes'] =>
  Array.from({ length: bars }, (_, i) => [i * barQ, barQ, 48, 1] as [number, number, number, number])

describe('StaffNotation meters', () => {
  it('draws 6/8 eighths as eighths', async () => {
    const staves = await draw({
      timeSigs: [[0, 6, 8]],
      notes: [
        ...[60, 62, 64, 65, 67, 69].map((m, i) => [i * 0.5, 0.5, m] as [number, number, number]),
        ...withBass(1, 3),
      ],
    })
    expect(barRhythm(1, 'treble', staves)).toEqual(['c/4:8 d/4:8 e/4:8 f/4:8 g/4:8 a/4:8'])
    const v = staves.find((s) => s.bar === 1 && s.clef === 'treble')!.voices[0]!
    expect(v.totalQ).toBe(3)
  })

  it('draws the 6/8 quarter–eighth lilt (Pirates bar 3) as q 8 q 8', async () => {
    const staves = await draw({
      timeSigs: [[0, 6, 8]],
      notes: [[0, 0.95, 62], [1, 0.47, 62], [1.5, 0.95, 62], [2.5, 0.47, 62], ...withBass(1, 3)],
    })
    expect(barRhythm(1, 'treble', staves)).toEqual(['d/4:q d/4:8 d/4:q d/4:8'])
  })

  it('draws 2/2 halves as halves', async () => {
    const staves = await draw({
      timeSigs: [[0, 2, 2]],
      notes: [[0, 2, 60], [2, 2, 64], ...withBass(1, 4)],
    })
    expect(barRhythm(1, 'treble', staves)).toEqual(['c/4:h e/4:h'])
  })

  it('draws the time signature at the start and where it changes', async () => {
    const staves = await draw({
      timeSigs: [[0, 3, 4], [6, 4, 4]],
      notes: [...withBass(2, 3), [6, 4, 48, 1], [10, 4, 48, 1], [0, 3, 60]],
    })
    const sig = (bar: number, clef: string) =>
      staves.find((s) => s.bar === bar && s.clef === clef)?.timeSig ?? null
    expect([sig(1, 'treble'), sig(1, 'bass')]).toEqual(['3/4', '3/4'])
    expect(sig(2, 'treble')).toBeNull()
    expect([sig(3, 'treble'), sig(3, 'bass')]).toEqual(['4/4', '4/4'])
    expect(sig(4, 'treble')).toBeNull()
  })
})

describe('StaffNotation keys', () => {
  it('draws a minor key signature', async () => {
    const staves = await draw({
      keySigs: [{ beat: 0, sharps: 1, minor: true }],
      notes: [[0, 4, 64], ...withBass(1, 4)],
    })
    expect(staves.find((s) => s.bar === 1 && s.clef === 'treble')?.keySig).toBe('Em')
  })

  it('draws a mid-line key change with cancelling naturals and spells for it', async () => {
    const staves = await draw({
      keySigs: [
        { beat: 0, sharps: 1 },
        { beat: 8, sharps: -1 },
      ],
      notes: [[0, 4, 66], [4, 4, 67], [8, 4, 70], [12, 4, 72], ...withBass(4, 4)],
    })
    const b3 = staves.find((s) => s.bar === 3 && s.clef === 'treble')!
    expect([b3.keySig, b3.cancelKey]).toEqual(['F', 'G'])
    expect(barRhythm(3, 'treble', staves)).toEqual(['bb/4:w'])
    expect(staves.find((s) => s.bar === 2 && s.clef === 'treble')?.keySig).toBeUndefined()
  })
})

describe('StaffNotation redraws', () => {
  it('glides with the playhead without redrawing; redraws once when the bar changes', async () => {
    // 12 bars of quarter notes, 4 bars per line
    const notes = Array.from({ length: 48 }, (_, i) => [i, 1, 60 + (i % 12)] as [number, number, number])
    const parsed = await parseMidiArrayBuffer(synthMidi({ notes: [...notes, ...withBass(12, 4)] }))
    const staff = await mountStaff(parsed, { measure: 5, nowSec: parsed.measures[4]!.startSec })
    const svgHost = staff.container.querySelector('.staff-frame > div') as HTMLElement
    expect(vexLog.renderers).toBe(1)

    // Play through bar 5 at 60 "frames": the drawing only slides.
    const transforms = new Set<string>()
    const m5 = parsed.measures[4]!
    for (let f = 0; f < 60; f++) {
      await staff.rerender({ nowSec: m5.startSec + (m5.durationSec * f) / 60 })
      transforms.add(svgHost.style.transform)
    }
    expect(vexLog.renderers).toBe(1)
    expect(transforms.size).toBeGreaterThan(30)

    // Next bar, same line window: the current-bar highlight redraws once.
    await staff.rerender({ measure: 6, nowSec: parsed.measures[5]!.startSec })
    expect(vexLog.renderers).toBe(2)
    await staff.unmount()
  })
})

describe('StaffNotation engraving details', () => {
  it('prints a whole-bar rest as one centred rest in any meter', async () => {
    const staves = await draw({
      timeSigs: [[0, 3, 4]],
      notes: [[0, 3, 60], [3, 3, 62], [3, 3, 48, 1]],
    })
    const bass1 = staves.find((s) => s.bar === 1 && s.clef === 'bass')!
    expect(bass1.voices).toEqual([])
    expect(vexLog.wholeBarRests).toBe(1)
  })

  it('beamed triplets get a plain number, no bracket', async () => {
    const t = 1 / 3
    await draw({ notes: [[0, t, 60], [t, t, 62], [2 * t, t, 64], [1, 3, 65], ...withBass(1, 4)] })
    expect(vexLog.tuplets).toEqual([{ notes: 3, num: 3, bracketed: false, ratioed: false }])
  })

  it('switches a low right hand to bass clef for the line', async () => {
    const staves = await draw({
      notes: [
        ...Array.from({ length: 8 }, (_, i) => [i, 1, i % 2 ? 62 : 50] as [number, number, number]),
        ...withBass(2, 4),
      ],
    })
    const upper = staves.find((s) => s.bar === 1 && s.clef === 'treble')!
    expect(upper.drawnClef).toBe('bass')
    expect(staves.find((s) => s.bar === 1 && s.clef === 'bass')!.drawnClef).toBe('bass')
  })

  it('tells mid-line staves their clef so key changes land on the right lines', async () => {
    const staves = await draw({
      keySigs: [{ beat: 0, sharps: 1 }, { beat: 4, sharps: -1 }],
      notes: [[0, 4, 72], [4, 4, 72], [0, 4, 48, 1], [4, 4, 48, 1]],
    })
    const bass2 = staves.find((s) => s.bar === 2 && s.clef === 'bass')!
    expect([bass2.keySig, bass2.drawnClef]).toEqual(['F', 'bass'])
  })
})

describe('StaffNotation bar clicks and drags', () => {
  it('a click goes to a bar; click-and-drag across bars selects them', async () => {
    const parsed = await parseMidiArrayBuffer(
      synthMidi({
        notes: [...[0, 4, 8, 12].map((b) => [b, 4, 60, 0] as [number, number, number, number]), ...withBass(4, 4)],
      }),
    )
    const onMeasurePointer = vi.fn()
    const onMeasureRange = vi.fn()
    const staff = await mountStaff(parsed, { onMeasurePointer, onMeasureRange })
    const frame = staff.container.querySelector('.staff-frame')!
    // The drawing slides up by this much; the frame itself sits at 0,0 in jsdom.
    const host = frame.firstElementChild as HTMLElement
    const offset = -Number(/translateY\((-?[\d.]+)px\)/.exec(host.style.transform)![1])
    const staves = drawnStaves()
    const at = (bar: number) => {
      const st = staves.find((x) => x.bar === bar && x.clef === 'treble')!
      return { clientX: st.x + 12, clientY: st.y + 20 - offset }
    }
    const fire = (type: string, bar: number) =>
      act(async () => {
        frame.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, ...at(bar) }))
      })

    await fire('pointerdown', 3)
    await fire('pointerup', 3)
    expect(onMeasurePointer).toHaveBeenCalledWith(3, false)
    expect(onMeasureRange).not.toHaveBeenCalled()

    await fire('pointerdown', 1)
    await fire('pointermove', 2)
    await fire('pointermove', 3)
    await fire('pointerup', 3)
    expect(onMeasureRange).toHaveBeenCalledWith({ start: 1, end: 3 })
    expect(onMeasurePointer).toHaveBeenCalledTimes(1)
    await staff.unmount()
  })
})
