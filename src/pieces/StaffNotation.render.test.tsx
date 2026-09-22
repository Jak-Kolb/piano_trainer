// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { parseMidiArrayBuffer } from './parseMidi'
import { renderStaff } from './testing/renderStaff'
import { synthMidi, type SynthOptions } from './testing/synthMidi'
import { barRhythm } from './testing/vexRecorder'

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
