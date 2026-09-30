// @vitest-environment jsdom
/**
 * Regression checks against Jak's real pieces in ~/Downloads.
 * Local-only: each case skips when its file isn't on this machine.
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { barsPerSystem, dominantBarQuarters } from './demoAudio'
import { parseMidiArrayBuffer } from './parseMidi'
import { renderStaff } from './testing/renderStaff'
import { barRhythm, vexLog, type DrawnStave } from './testing/vexRecorder'
import type { ParsedPiece } from './types'

vi.mock('vexflow', async (orig) =>
  (await import('./testing/vexRecorder')).recordingVexflow(await orig()),
)

const FILES = {
  anotherLove: 'Tom Odell - Another Love.mid',
  interstellar: 'Hans Zimmer - Interstellar.mid',
  pirates:
    'Klaus Badelt_ Hans Zimmer_arr. Seth Barraclough - Pirates of the Caribbean Theme piano.mid',
  jeTeLaisserai: 'Patrick Watson - Je Te Laisserai Des Mots.mid',
  windyHill: '羽肿 - Windy Hill.mid',
} as const

const pathOf = (name: string) => join(homedir(), 'Downloads', name)
const has = (name: string) => existsSync(pathOf(name))

async function load(name: string) {
  const bytes = Uint8Array.from(readFileSync(pathOf(name)))
  return parseMidiArrayBuffer(bytes.buffer as ArrayBuffer)
}

/** Render every line of the piece; one entry per bar and staff. */
async function renderAll(parsed: ParsedPiece): Promise<{ staves: DrawnStave[]; tuplets: number }> {
  const seen = new Map<string, DrawnStave>()
  const bars = new Set<number>()
  let tuplets = 0
  // Rendering at a bar always draws that bar's line and the next one.
  for (let m = 1; m <= parsed.measureCount; m++) {
    if (bars.has(m)) continue
    const staves = await renderStaff(parsed, { measure: m, barsPerLine: 4 })
    tuplets += vexLog.tuplets.length
    for (const st of staves) {
      bars.add(st.bar)
      const key = `${st.bar}:${st.clef}`
      if (!seen.has(key)) seen.set(key, st)
    }
  }
  return { staves: [...seen.values()], tuplets }
}

const durations = (rhythm: string[]) =>
  rhythm.map((v) => v.split(' ').map((n) => n.split(':').pop()).join(' '))

describe('real pieces', () => {
  for (const [label, file] of Object.entries(FILES)) {
    it.skipIf(!has(file))(`${label}: every voice fills its bar exactly`, async () => {
      const parsed = await load(file)
      const { staves } = await renderAll(parsed)
      const bars = new Set(staves.map((s) => s.bar))
      expect(bars.size).toBe(parsed.measureCount)
      const bad = staves.flatMap((s) =>
        s.voices
          .filter((v) => Math.abs(v.usedQ - v.totalQ) > 1e-6)
          .map((v) => `bar ${s.bar} ${s.clef}: ${v.usedQ} of ${v.totalQ}`),
      )
      expect(bad).toEqual([])
    }, 60_000)
  }

  it.skipIf(!has(FILES.interstellar))('Interstellar bar 45: sixteenth sextuplets', async () => {
    const parsed = await load(FILES.interstellar)
    const staves = await renderStaff(parsed, { measure: 45 })
    const st = staves.find((s) => s.bar === 45 && s.clef === 'treble')!
    expect(durations(barRhythm(45, 'treble', staves))[0]).toBe(Array(18).fill('16').join(' '))
    expect(st.voices[0]!.usedQ).toBe(3)
    expect(vexLog.tuplets.some((t) => t.num === 6)).toBe(true)
  })

  it.skipIf(!has(FILES.interstellar))('Interstellar bars 5–6: held octave over the eighths', async () => {
    const parsed = await load(FILES.interstellar)
    const staves = await renderStaff(parsed, { measure: 5, barsPerLine: 4 })
    expect(barRhythm(5, 'treble', staves)).toEqual(['a/3+a/4:hd', 'e/4:8 c/4:8 e/4:8 c/4:8 e/4:8 c/4:8'])
    expect(barRhythm(6, 'treble', staves)).toEqual(['b/3+b/4:hd', 'e/4:8 d/4:8 e/4:8 d/4:8 e/4:8 d/4:8'])
  })

  it.skipIf(!has(FILES.pirates))('Pirates (6/8): eighth-note values and C# leading tone', async () => {
    const parsed = await load(FILES.pirates)
    const staves = await renderStaff(parsed)
    // Intro octaves are in the right-hand track
    expect(durations(barRhythm(3, 'treble', staves))).toEqual(['q 8 q 8'])
    expect(staves.find((s) => s.bar === 1 && s.clef === 'treble')?.timeSig).toBe('6/8')
    // File says F major (music is D minor): the leading tone is C#, not Db
    expect(barRhythm(9, 'bass', staves)[0]).toContain('a/2+c#/3')
  })

  it.skipIf(!has(FILES.interstellar))('Interstellar: meter and key changes are drawn', async () => {
    const parsed = await load(FILES.interstellar)
    expect(parsed.measures[135]!.keySignature).toBe('G')
    expect(parsed.measures[147]!.keySignature).toBe('C')

    let staves = await renderStaff(parsed, { measure: 195 })
    const at = (bar: number) => staves.find((s) => s.bar === bar && s.clef === 'treble')
    expect(at(194)?.timeSig).toBeUndefined()
    expect(at(195)?.timeSig).toBe('4/4')

    staves = await renderStaff(parsed, { measure: 136 })
    expect(at(136)?.keySig).toBe('G')
    staves = await renderStaff(parsed, { measure: 148 })
    expect([at(148)?.keySig, at(148)?.cancelKey]).toEqual(['C', 'G'])
  })

  it.skipIf(!has(FILES.windyHill))('Windy Hill: the pickup bar does not set the layout', async () => {
    const parsed = await load(FILES.windyHill)
    expect(barsPerSystem(dominantBarQuarters(parsed.measures))).toBe(6)
    const staves = await renderStaff(parsed)
    const at = (bar: number) => staves.find((s) => s.bar === bar && s.clef === 'treble')
    expect(at(1)?.timeSig).toBe('4/4')
    expect(at(2)?.timeSig).toBeUndefined()
  })

  for (const file of [FILES.interstellar, FILES.windyHill]) {
    it.skipIf(!has(file))(`${file}: the sustain pedal holds notes in playback`, async () => {
      const parsed = await load(file)
      const held = parsed.notes.filter((n) => n.soundEnd! > n.time + n.duration + 0.05)
      expect(held.length).toBeGreaterThan(parsed.notes.length / 4)
    })
  }

  it.skipIf(!has(FILES.jeTeLaisserai))('Je Te Laisserai: D major, 3/4', async () => {
    const parsed = await load(FILES.jeTeLaisserai)
    const staves = await renderStaff(parsed)
    const b1 = staves.find((s) => s.bar === 1 && s.clef === 'treble')
    expect([b1?.keySig, b1?.timeSig]).toEqual(['D', '3/4'])
  })
})
