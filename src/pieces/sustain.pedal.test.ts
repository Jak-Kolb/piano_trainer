import { describe, expect, it, vi } from 'vitest'

vi.mock('tone', () => ({}))
const { createSustain } = await import('./pianoPlayer')

describe('built-in piano sustain', () => {
  it('holds notes whose keys end while the pedal is down (sounding ones too), and lets them go when it lifts', () => {
    const released: string[] = []
    const pedal = createSustain((n) => released.push(n))
    pedal.keyUp('C4')
    expect(released).toEqual(['C4']) // no pedal: the note ends with its key
    pedal.set(true)
    pedal.keyUp('E4')
    pedal.keyUp('G4')
    expect(released).toEqual(['C4'])
    pedal.set(false)
    expect(released).toEqual(['C4', 'E4', 'G4'])
  })
})
