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
import { barRhythm } from './testing/vexRecorder'

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

const durations = (rhythm: string[]) =>
  rhythm.map((v) => v.split(' ').map((n) => n.split(':').pop()).join(' '))

describe('real pieces', () => {
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

  it.skipIf(!has(FILES.jeTeLaisserai))('Je Te Laisserai: D major, 3/4', async () => {
    const parsed = await load(FILES.jeTeLaisserai)
    const staves = await renderStaff(parsed)
    const b1 = staves.find((s) => s.bar === 1 && s.clef === 'treble')
    expect([b1?.keySig, b1?.timeSig]).toEqual(['D', '3/4'])
  })
})
