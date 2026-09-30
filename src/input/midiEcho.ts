/**
 * Notes the app sends to your piano can come straight back on its USB
 * output as if you'd played them. Outgoing note-ons are noted here so the
 * MIDI input can drop those echoes.
 */

/** An incoming note this close to one just sent (same key) is its echo. */
const ECHO_MS = 80

const sent = new Map<number, number>()

/** A note-on went out to the piano, sounding at `at` (performance.now() ms). */
export function noteSent(midi: number, at: number): void {
  sent.set(midi, at)
}

export function isEcho(midi: number, at: number): boolean {
  const t = sent.get(midi)
  return t !== undefined && Math.abs(at - t) < ECHO_MS
}
