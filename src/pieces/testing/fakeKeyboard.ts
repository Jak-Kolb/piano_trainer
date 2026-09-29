import { act } from 'react'
import type { InputSource, NoteEvent } from '../../input'

/** A MIDI keyboard for tests: press / release / tap keys. */
export function fakeKeyboard() {
  const held = new Set<number>()
  const changes = new Set<() => void>()
  const notes = new Set<(e: NoteEvent) => void>()
  const src: InputSource = {
    id: 'midi',
    label: 'MIDI',
    getStatus: () => 'Kawai USB MIDI',
    getHeldPitchClasses: () => [...new Set([...held].map((m) => m % 12))],
    getHeldMidiNotes: () => [...held],
    getMeter: () => null,
    supportsAutomaticGrade: () => true,
    hasDevice: () => true,
    start: async () => {},
    onChange(l) {
      changes.add(l)
      return () => changes.delete(l)
    },
    onNote(l) {
      notes.add(l)
      return () => notes.delete(l)
    },
    dispose() {},
  }
  const send = (midi: number, on: boolean) =>
    act(() => {
      if (on) held.add(midi)
      else held.delete(midi)
      for (const l of notes) l({ midi, on, velocity: on ? 0.7 : 0, time: performance.now() })
      for (const l of changes) l()
    })
  return {
    src,
    press: (m: number) => send(m, true),
    release: (m: number) => send(m, false),
    /** Press keys one after another, then let them all go. */
    tap: async (...ms: number[]) => {
      for (const m of ms) await send(m, true)
      for (const m of ms) await send(m, false)
    },
  }
}
