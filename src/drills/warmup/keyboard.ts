/** Keyboard input for the warmup runners (MIDI; self-report has no keys). */
import { useEffect, useRef, useState } from 'react'
import type { InputSource } from '../../input'

/** What one section (or drill round) adds up to. */
export interface RunResult {
  /** e.g. "8 of 10 first try" */
  line: string
  /** 0–1, for the summary's colour. */
  score: number
}

/** Grade from the keyboard; otherwise the runners show self-report buttons. */
export const hasKeyboard = (input: InputSource) => input.hasDevice()

/**
 * Keys held now. `onPress` fires for each fresh key press and `onHeld`
 * whenever the set of held keys changes, so runners grade on events.
 */
export function useKeyboard(
  input: InputSource,
  handlers: { onPress?: (midi: number) => void; onHeld?: (held: number[]) => void } = {},
): number[] {
  const [held, setHeld] = useState<number[]>(() => input.getHeldMidiNotes())
  const latest = useRef(handlers)
  latest.current = handlers
  useEffect(() => {
    const offChange = input.onChange(() => {
      const now = input.getHeldMidiNotes()
      setHeld(now)
      latest.current.onHeld?.(now)
    })
    const offNote = input.onNote((e) => {
      if (e.on) latest.current.onPress?.(e.midi)
    })
    return () => {
      offChange()
      offNote()
    }
  }, [input])
  return held
}
