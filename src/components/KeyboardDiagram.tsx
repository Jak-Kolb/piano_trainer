import { formatNoteName, type NoteName, pitchClass } from '../theory'

const WHITE = [0, 2, 4, 5, 7, 9, 11]
const BLACK = [1, 3, 6, 8, 10]
/** Black key centers as % of white-key row width (7 whites). */
const BLACK_LEFT_PCT = [10.5, 25.5, 53.5, 68.5, 83.5]

interface Props {
  /** Keys to tint (e.g. whole scale). */
  highlight: NoteName[]
  /** Current target key — stronger highlight. */
  active?: NoteName | null
  /** Hide the text label under the keyboard. */
  hideLabels?: boolean
}

export function KeyboardDiagram({ highlight, active, hideLabels }: Props) {
  const pcs = new Set(highlight.map(pitchClass))
  const activePc = active ? pitchClass(active) : null
  const labels = highlight.map(formatNoteName).join(' · ')

  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-3">
      <div className="relative flex h-32 w-full max-w-md justify-center">
        {WHITE.map((pc) => {
          const isActive = activePc === pc
          const isHi = pcs.has(pc)
          return (
            <div
              key={`w-${pc}`}
              className={`relative mx-px h-full flex-1 rounded-b border border-dust/40 ${
                isActive ? 'bg-brass' : isHi ? 'bg-brass/40' : 'bg-ivory'
              }`}
            />
          )
        })}
        <div className="pointer-events-none absolute inset-0">
          {BLACK.map((pc, i) => {
            const isActive = activePc === pc
            const isHi = pcs.has(pc)
            return (
              <div
                key={`b-${pc}`}
                style={{
                  left: `${BLACK_LEFT_PCT[i]}%`,
                  position: 'absolute',
                  transform: 'translateX(-50%)',
                }}
                className={`h-20 w-[7%] rounded-b ${
                  isActive ? 'bg-felt' : isHi ? 'bg-felt/70' : 'bg-shadow'
                }`}
              />
            )
          })}
        </div>
      </div>
      {!hideLabels && labels && (
        <p className="font-display text-xl text-ivory">{labels}</p>
      )}
      {active && (
        <p className="font-display text-2xl text-brass">
          {formatNoteName(active)}
        </p>
      )}
    </div>
  )
}
