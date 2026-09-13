import { formatNoteName, type NoteName, pitchClass } from '../theory'

const WHITE = [0, 2, 4, 5, 7, 9, 11]
const BLACK = [1, 3, 6, 8, 10]

interface Props {
  highlight: NoteName[]
}

export function KeyboardDiagram({ highlight }: Props) {
  const pcs = new Set(highlight.map(pitchClass))
  const labels = highlight.map(formatNoteName).join(' · ')

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      <div className="relative flex h-28 w-full justify-center">
        {WHITE.map((pc) => (
          <div
            key={`w-${pc}`}
            className={`relative mx-px h-full w-8 rounded-b border border-dust/40 ${
              pcs.has(pc) ? 'bg-brass' : 'bg-ivory'
            }`}
          />
        ))}
        <div className="pointer-events-none absolute top-0 flex w-full justify-center">
          {BLACK.map((pc, i) => {
            const offsets = [28, 60, 124, 156, 188] // rough black-key placement in px for 7 whites
            return (
              <div
                key={`b-${pc}`}
                style={{ left: offsets[i], position: 'absolute' }}
                className={`h-16 w-5 rounded-b ${pcs.has(pc) ? 'bg-felt' : 'bg-shadow'}`}
              />
            )
          })}
        </div>
      </div>
      <p className="font-display text-xl text-ivory">{labels}</p>
    </div>
  )
}
