import { describe, expect, it } from 'vitest'
import { keyPrefersFlats, midiToVexKey } from './midiToVex'

describe('midiToVexKey enharmonics', () => {
  it('spells pc 10 as A# in D major, Bb in Bb major', () => {
    expect(midiToVexKey(70, 'D')).toBe('a#/4')
    expect(midiToVexKey(70, 'Bb')).toBe('bb/4')
  })

  it('spells pc 3 as D# in D major, Eb in F major', () => {
    expect(midiToVexKey(63, 'D')).toBe('d#/4')
    expect(midiToVexKey(63, 'F')).toBe('eb/4')
  })

  it('keyPrefersFlats', () => {
    expect(keyPrefersFlats('D')).toBe(false)
    expect(keyPrefersFlats('G')).toBe(false)
    expect(keyPrefersFlats('C')).toBe(false)
    expect(keyPrefersFlats('F')).toBe(true)
    expect(keyPrefersFlats('Bb')).toBe(true)
  })
})
