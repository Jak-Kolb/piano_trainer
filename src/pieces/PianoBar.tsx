/** Full-width piano strip; highlights exact MIDI keys. */

const WHITE_PC = new Set([0, 2, 4, 5, 7, 9, 11])

interface Props {
  /** MIDI numbers to highlight (current step / demo). */
  activeMidis: number[]
  /** Optional range; defaults to C2–B5. */
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

  // Map black key to position between surrounding whites
  const whiteIndex = new Map(whites.map((m, i) => [m, i]))
  const nWhite = whites.length

  return (
    <div className="w-full shrink-0 border-t border-dust/20 bg-ink px-2 pb-2 pt-1">
      <div className="relative mx-auto h-16 w-full max-w-5xl">
        <div className="absolute inset-0 flex">
          {whites.map((m) => {
            const on = active.has(m)
            return (
              <div
                key={m}
                className={`relative h-full flex-1 border border-dust/30 ${
                  on ? 'bg-brass' : 'bg-ivory'
                }`}
                title={`MIDI ${m}`}
              />
            )
          })}
        </div>
        <div className="pointer-events-none absolute inset-0">
          {blacks.map((m) => {
            // Place over the gap after the white key just below this black
            const below = m - 1
            while (below >= lowMidi && !isWhite(below)) {
              /* walk down — shouldn't happen */
              break
            }
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
                className={`absolute top-0 h-[58%] rounded-b ${
                  on ? 'bg-felt' : 'bg-shadow'
                }`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
