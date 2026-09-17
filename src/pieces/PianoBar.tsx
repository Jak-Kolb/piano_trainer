/** Full-width piano strip; highlights exact MIDI keys and labels them. */

import { midiNoteLabel } from './nameChord'

const WHITE_PC = new Set([0, 2, 4, 5, 7, 9, 11])

interface Props {
  activeMidis: number[]
  lowMidi?: number
  highMidi?: number
}

function isWhite(midi: number): boolean {
  return WHITE_PC.has(((midi % 12) + 12) % 12)
}

export function PianoBar({
  activeMidis,
  lowMidi = 36,
  highMidi = 84,
}: Props) {
  const active = new Set(activeMidis)
  const whites: number[] = []
  for (let m = lowMidi; m <= highMidi; m++) {
    if (isWhite(m)) whites.push(m)
  }
  const blacks: number[] = []
  for (let m = lowMidi; m <= highMidi; m++) {
    if (!isWhite(m)) blacks.push(m)
  }

  const whiteIndex = new Map(whites.map((m, i) => [m, i]))
  const nWhite = whites.length

  return (
    <div className="w-full shrink-0 bg-ink px-2 pb-1 pt-1">
      <div className="relative mx-auto h-20 w-full max-w-5xl">
        <div className="absolute inset-0 flex">
          {whites.map((m) => {
            const on = active.has(m)
            return (
              <div
                key={m}
                className={`relative flex h-full flex-1 flex-col justify-end border border-dust/30 pb-0.5 ${
                  on ? 'bg-brass' : 'bg-ivory'
                }`}
                title={midiNoteLabel(m)}
              >
                {on && (
                  <span
                    className={`block text-center font-ui leading-none ${
                      on ? 'text-ink' : 'text-dust'
                    }`}
                    style={{ fontSize: nWhite > 28 ? 8 : 10 }}
                  >
                    {midiNoteLabel(m)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <div className="pointer-events-none absolute inset-0">
          {blacks.map((m) => {
            const wi = whiteIndex.get(m - 1)
            if (wi == null) return null
            const leftPct = ((wi + 1) / nWhite) * 100
            const on = active.has(m)
            return (
              <div
                key={m}
                style={{
                  left: `${leftPct}%`,
                  width: `${(0.65 / nWhite) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
                className={`absolute top-0 flex h-[58%] flex-col justify-end rounded-b pb-0.5 ${
                  on ? 'bg-felt' : 'bg-shadow'
                }`}
              >
                {on && (
                  <span
                    className="block text-center font-ui leading-none text-ivory"
                    style={{ fontSize: 7 }}
                  >
                    {midiNoteLabel(m)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
