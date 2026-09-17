/** Full-width piano; realistic key proportions, middle C always marked. */

import { useEffect, useRef } from 'react'
import { midiNoteLabel } from './nameChord'

const WHITE_PC = new Set([0, 2, 4, 5, 7, 9, 11])
const MIDDLE_C = 60

/** White-key size — tall, not stubby. */
const WHITE_W = 28
const WHITE_H = 152
const BLACK_W = 18
const BLACK_H = 96

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
  highMidi = 96,
}: Props) {
  const active = new Set(activeMidis)
  const scroller = useRef<HTMLDivElement>(null)
  const middleRef = useRef<HTMLDivElement>(null)

  const whites: number[] = []
  for (let m = lowMidi; m <= highMidi; m++) {
    if (isWhite(m)) whites.push(m)
  }
  const blacks: number[] = []
  for (let m = lowMidi; m <= highMidi; m++) {
    if (!isWhite(m)) blacks.push(m)
  }

  const whiteIndex = new Map(whites.map((m, i) => [m, i]))
  const totalW = whites.length * WHITE_W

  // Keep middle C (or first active key) in view
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const targetMidi = activeMidis[0] ?? MIDDLE_C
    const el = root.querySelector(`[data-midi="${targetMidi}"]`) as HTMLElement | null
    const anchor = el ?? middleRef.current
    if (!anchor) return
    const a = anchor.getBoundingClientRect()
    const r = root.getBoundingClientRect()
    const delta = a.left + a.width / 2 - (r.left + r.width / 2)
    root.scrollLeft += delta
  }, [activeMidis])

  return (
    <div className="w-full shrink-0 border-t border-dust/20 bg-ink px-2 py-2">
      <div
        ref={scroller}
        className="w-full overflow-x-auto overflow-y-hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div
          className="relative mx-auto"
          style={{ width: totalW, height: WHITE_H }}
        >
          <div className="absolute inset-0 flex">
            {whites.map((m) => {
              const on = active.has(m)
              const isMiddle = m === MIDDLE_C
              let bg = 'bg-ivory'
              if (isMiddle && !on) bg = 'bg-[#7EB6C9]' // always-visible middle C
              if (on) bg = 'bg-brass'
              return (
                <div
                  key={m}
                  ref={isMiddle ? middleRef : undefined}
                  data-midi={m}
                  style={{ width: WHITE_W, height: WHITE_H }}
                  className={`relative flex shrink-0 flex-col justify-end border border-dust/40 pb-1 ${bg} ${
                    isMiddle ? 'ring-2 ring-inset ring-[#3D7A8F]' : ''
                  }`}
                  title={isMiddle ? 'Middle C (C4)' : midiNoteLabel(m)}
                >
                  {(on || isMiddle) && (
                    <span
                      className={`block text-center font-ui text-[10px] font-semibold leading-none ${
                        on ? 'text-ink' : 'text-ink/80'
                      }`}
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
              const left = (wi + 1) * WHITE_W - BLACK_W / 2
              const on = active.has(m)
              return (
                <div
                  key={m}
                  data-midi={m}
                  style={{
                    left,
                    width: BLACK_W,
                    height: BLACK_H,
                  }}
                  className={`absolute top-0 flex flex-col justify-end rounded-b pb-1 ${
                    on ? 'bg-felt' : 'bg-[#1a1f2e]'
                  } ${on ? 'ring-1 ring-brass' : ''}`}
                  title={midiNoteLabel(m)}
                >
                  {on && (
                    <span className="block text-center font-ui text-[8px] font-semibold leading-none text-ivory">
                      {midiNoteLabel(m)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <p className="pt-1 text-center font-ui text-[10px] text-dust">
        Middle C is the blue key · scroll if needed
      </p>
    </div>
  )
}
