import { describe, expect, it } from 'vitest'
import {
  fingeringFor,
  majorArpeggio,
  majorScale,
  SCALE_KEY_OPTIONS,
  twoOctaveArpeggioNotes,
  twoOctaveScaleNotes,
} from './index'

const HANDS = ['right', 'left'] as const
const BLACK = new Set([1, 3, 6, 8, 10])

/** Transcribed from the published charts cited in fingerings.ts. */
const CHARTS = {
  scale: {
    right: {
      'C major': [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5],
      'G major': [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5],
      'D major': [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5],
      'A major': [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5],
      'E major': [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5],
      'F major': [1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 4],
    },
    left: {
      'C major': [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1],
      'G major': [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1],
      'D major': [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1],
      'A major': [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1],
      'E major': [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1],
      'F major': [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1],
    },
  },
  arpeggio: {
    right: {
      'C major': [1, 2, 3, 1, 2, 3, 5],
      'G major': [1, 2, 3, 1, 2, 3, 5],
      'D major': [1, 2, 3, 1, 2, 3, 5],
      'A major': [1, 2, 3, 1, 2, 3, 5],
      'E major': [1, 2, 3, 1, 2, 3, 5],
      'F major': [1, 2, 3, 1, 2, 3, 5],
    },
    left: {
      'C major': [5, 4, 2, 1, 4, 2, 1],
      'G major': [5, 4, 2, 1, 4, 2, 1],
      'D major': [5, 3, 2, 1, 3, 2, 1],
      'A major': [5, 3, 2, 1, 3, 2, 1],
      'E major': [5, 3, 2, 1, 3, 2, 1],
      'F major': [5, 4, 2, 1, 4, 2, 1],
    },
  },
} as const

describe('fingering data', () => {
  it.each(SCALE_KEY_OPTIONS)('%s: two-octave scale and arpeggio match the charts, both hands', (key) => {
    for (const kind of ['scale', 'arpeggio'] as const) {
      for (const hand of HANDS) {
        const f = fingeringFor(key, hand, kind)
        expect(f?.verified, `${kind} ${hand}`).toBe(true)
        expect(f?.twoOctaves, `${kind} ${hand}`).toEqual(CHARTS[kind][hand][key as keyof typeof CHARTS.scale.right])
      }
    }
  })

  it.each(SCALE_KEY_OPTIONS)('%s: one finger per note, and the thumb never lands on a black key', (key) => {
    for (const hand of HANDS) {
      const cases = [
        [fingeringFor(key, hand, 'scale')?.twoOctaves, twoOctaveScaleNotes(key, hand)],
        [fingeringFor(key, hand, 'arpeggio')?.twoOctaves, twoOctaveArpeggioNotes(key, hand)],
      ] as const
      for (const [fingers, notes] of cases) {
        expect(fingers?.length).toBe(notes.length)
        notes.forEach((n, i) => {
          if (fingers?.[i] === 1) expect(BLACK.has(n.midi % 12), `${key} ${hand} note ${i}`).toBe(false)
        })
      }
      expect(fingeringFor(key, hand, 'scale')?.ascending.length).toBe(majorScale(key).length)
      expect(fingeringFor(key, hand, 'arpeggio')?.ascending.length).toBe(majorArpeggio(key).length)
    }
  })

  it('one-octave arpeggios end on 5 at the top (RH) and start on 5 at the bottom (LH)', () => {
    expect(fingeringFor('C major', 'right', 'arpeggio')?.ascending).toEqual([1, 2, 3, 5])
    expect(fingeringFor('C major', 'left', 'arpeggio')?.ascending).toEqual([5, 4, 2, 1])
    expect(fingeringFor('E major', 'left', 'arpeggio')?.ascending).toEqual([5, 3, 2, 1])
  })
})
