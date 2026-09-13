import { describe, expect, it } from 'vitest'
import { hzToMidi, midiToPitchClass, yinPitch } from './yin'

describe('yin helpers', () => {
  it('maps A4 to midi 69', () => {
    expect(Math.round(hzToMidi(440))).toBe(69)
  })

  it('pitch class of midi 60 is C', () => {
    expect(midiToPitchClass(60)).toBe(0)
  })

  it('detects a synthetic sine near A4', () => {
    const sr = 44100
    const hz = 440
    const n = 2048
    const buf = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      buf[i] = Math.sin((2 * Math.PI * hz * i) / sr)
    }
    const detected = yinPitch(buf, sr)
    expect(detected).not.toBeNull()
    expect(detected!).toBeGreaterThan(430)
    expect(detected!).toBeLessThan(450)
  })
})
