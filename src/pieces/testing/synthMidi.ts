import { Midi } from '@tonejs/midi'

/** [beat, lengthBeats, midi, track?, velocity?]. Beats are quarter notes. */
export type SynthNote = [
  beat: number,
  lenBeats: number,
  midi: number,
  track?: number,
  velocity?: number,
]

export interface SynthOptions {
  bpm?: number
  /** [atBeat, numerator, denominator]; defaults to 4/4 at beat 0. */
  timeSigs?: [atBeat: number, num: number, den: number][]
  /** Key signatures as written in the file: sharps (-7..7, flats negative). */
  keySigs?: { beat: number; sharps: number; minor?: boolean }[]
  /** Sustain pedal (CC64) [downBeat, upBeat, track?]. */
  pedal?: [down: number, up: number, track?: number][]
  notes: SynthNote[]
  /** Minimum number of note tracks (default 2 so hands resolve by track). */
  tracks?: number
}

const KEY_NAMES = [
  'Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F',
  'C',
  'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
]

/**
 * Build a Type-1 MIDI file for tests.
 *
 * @tonejs/midi's encoder writes the key-signature byte as index+7 instead of
 * the signed sharps count, so key bytes are patched after encoding.
 */
export function synthMidi(opts: SynthOptions): ArrayBuffer {
  const midi = new Midi()
  const ppq = midi.header.ppq
  midi.header.setTempo(opts.bpm ?? 120)
  const timeSigs = opts.timeSigs ?? [[0, 4, 4]]
  for (const [beat, num, den] of timeSigs) {
    midi.header.timeSignatures.push({
      ticks: Math.round(beat * ppq),
      timeSignature: [num, den],
    })
  }
  const keySigs = [...(opts.keySigs ?? [])].sort((a, b) => a.beat - b.beat)
  for (const ks of keySigs) {
    midi.header.keySignatures.push({
      ticks: Math.round(ks.beat * ppq),
      key: KEY_NAMES[ks.sharps + 7]!,
      scale: ks.minor ? 'minor' : 'major',
    })
  }
  midi.header.update()

  const trackCount = Math.max(
    opts.tracks ?? 2,
    ...opts.notes.map((n) => (n[3] ?? 0) + 1),
  )
  const tracks = Array.from({ length: trackCount }, () => midi.addTrack())
  for (const [beat, len, pitch, track = 0, velocity = 0.6] of opts.notes) {
    tracks[track]!.addNote({
      midi: pitch,
      ticks: Math.round(beat * ppq),
      durationTicks: Math.max(1, Math.round(len * ppq)),
      velocity,
    })
  }
  for (const [down, up, track = 0] of opts.pedal ?? []) {
    tracks[track]!.addCC({ number: 64, value: 1, ticks: Math.round(down * ppq) })
    tracks[track]!.addCC({ number: 64, value: 0, ticks: Math.round(up * ppq) })
  }

  const bytes = midi.toArray()
  let next = 0
  for (let i = 0; i + 4 < bytes.length && next < keySigs.length; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0x59 && bytes[i + 2] === 0x02) {
      bytes[i + 3] = keySigs[next++]!.sharps & 0xff
    }
  }
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}
