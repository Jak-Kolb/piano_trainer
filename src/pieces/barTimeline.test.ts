import { describe, expect, it } from 'vitest'
import { planBarEvents } from './barTimeline'

describe('planBarEvents', () => {
  it('puts a rest before notes that start mid-bar', () => {
    const events = planBarEvents([{ onset: 2, beats: 2 }])
    expect(events[0]).toEqual({ kind: 'rest', beats: 2 })
    expect(events[1]?.kind).toBe('note')
  })

  it('puts a rest between notes when there is a gap', () => {
    const events = planBarEvents([
      { onset: 0, beats: 1 },
      { onset: 2, beats: 1 },
    ])
    expect(events.map((e) => e.kind)).toEqual([
      'note',
      'rest',
      'note',
      'rest',
    ])
    expect(events[1]).toEqual({ kind: 'rest', beats: 1 })
  })

  it('does not dump all rests only at the end when music starts late', () => {
    const events = planBarEvents([{ onset: 1, beats: 1 }])
    expect(events[0]?.kind).toBe('rest')
    expect(events[0]).toMatchObject({ beats: 1 })
    expect(events.at(-1)?.kind).toBe('rest')
  })
})
