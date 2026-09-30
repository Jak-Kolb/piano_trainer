import type { ReactNode } from 'react'
import type { SheetPolarity } from '../../settings/colorProfile'
import type { PracticeOptions, SheetView } from './options'

interface Props {
  open: boolean
  options: PracticeOptions
  onOptions: (next: PracticeOptions) => void
  view: SheetView
  onView: (v: SheetView) => void
  polarity: SheetPolarity
  onPolarity: (p: SheetPolarity) => void
  /** Practising one hand (the other-hand switch only matters then). */
  oneHand: boolean
  hasMidi: boolean
  onClose: () => void
}

function Switch({
  label,
  hint,
  checked,
  disabled,
  onChange,
  children,
}: {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
  children?: ReactNode
}) {
  return (
    <div className={`drawer-row${disabled ? ' drawer-row--disabled' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="drawer-switch-row"
      >
        <span className="drawer-row-text">
          <span className="drawer-row-label">{label}</span>
          {hint && <span className="drawer-row-hint">{hint}</span>}
        </span>
        <span className={`switch${checked ? ' switch--on' : ''}`} aria-hidden>
          <span className="switch-knob" />
        </span>
      </button>
      {children}
    </div>
  )
}

function Stepper({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (v: number) => void
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)))
  return (
    <span className="stepper">
      <span className="stepper-label">{label}</span>
      <button type="button" className="stepper-btn" aria-label={`${label} down`} onClick={() => set(value - step)}>
        −
      </button>
      <span className="stepper-value">
        {value}
        {suffix}
      </span>
      <button type="button" className="stepper-btn" aria-label={`${label} up`} onClick={() => set(value + step)}>
        +
      </button>
    </span>
  )
}

/** The optional practice features, each a switch. Saved with the piece. */
export function PracticeDrawer({
  open,
  options,
  onOptions,
  view,
  onView,
  polarity,
  onPolarity,
  oneHand,
  hasMidi,
  onClose,
}: Props) {
  const set = <K extends keyof PracticeOptions>(key: K, value: PracticeOptions[K]) =>
    onOptions({ ...options, [key]: value })
  const needsMidi = hasMidi ? undefined : 'Needs a MIDI keyboard'

  return (
    <aside className={`drawer${open ? ' drawer--open' : ''}`} aria-hidden={!open} inert={!open}>
      <div className="drawer-head">
        <h2 className="drawer-title">Practice</h2>
        <button type="button" className="btn btn-ghost h-8" onClick={onClose}>
          Close
        </button>
      </div>

      <section className="drawer-group">
        <h3 className="drawer-group-title">Hands</h3>
        <Switch
          label="Play the other hand for me"
          hint={oneHand ? 'While you practise one hand' : 'Pick RH or LH to use this'}
          checked={options.otherHand}
          onChange={(v) => set('otherHand', v)}
        />
      </section>

      <section className="drawer-group">
        <h3 className="drawer-group-title">Feedback</h3>
        <Switch
          label="Show my keys and wrong notes"
          hint={needsMidi ?? 'Your keys light up; wrong notes turn red'}
          checked={options.showMyKeys}
          disabled={!hasMidi}
          onChange={(v) => set('showMyKeys', v)}
        />
      </section>

      <section className="drawer-group">
        <h3 className="drawer-group-title">Looping</h3>
        <Switch
          label="Repeat the range"
          hint="Start again after each pass"
          checked={options.repeatLoop}
          onChange={(v) => set('repeatLoop', v)}
        />
        <Switch
          label="Speed up after clean passes"
          hint={needsMidi ?? 'Tempo goes up after a pass with no mistakes'}
          checked={options.speedUp}
          disabled={!hasMidi}
          onChange={(v) => set('speedUp', v)}
        >
          {options.speedUp && hasMidi && (
            <div className="drawer-steppers">
              <Stepper
                label="Step"
                value={options.speedStep}
                min={1}
                max={20}
                step={1}
                suffix="%"
                onChange={(v) => set('speedStep', v)}
              />
              <Stepper
                label="Up to"
                value={options.speedTarget}
                min={40}
                max={140}
                step={5}
                suffix="%"
                onChange={(v) => set('speedTarget', v)}
              />
            </div>
          )}
        </Switch>
      </section>

      <section className="drawer-group">
        <h3 className="drawer-group-title">Play along</h3>
        <Switch
          label="Metronome"
          checked={options.metronome}
          onChange={(v) => set('metronome', v)}
        />
        <Switch
          label="Count in one bar"
          checked={options.countIn}
          onChange={(v) => set('countIn', v)}
        />
      </section>

      <section className="drawer-group">
        <h3 className="drawer-group-title">Sheet</h3>
        <div className="drawer-row drawer-choice">
          {(
            [
              ['staff', 'Sheet'],
              ['both', 'Sheet + roll'],
              ['roll', 'Roll'],
            ] as [SheetView, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`seg-btn${view === id ? ' seg-btn--on' : ''}`}
              onClick={() => onView(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <Switch
          label="Paper sheet"
          hint="Dark notes on light paper"
          checked={polarity === 'dark-on-light'}
          onChange={(v) => onPolarity(v ? 'dark-on-light' : 'light-on-dark')}
        />
      </section>

      <section className="drawer-group">
        <h3 className="drawer-group-title">Memory</h3>
        <Switch
          label="Remember settings for this piece"
          hint="Tempo, hands, range and these switches"
          checked={options.rememberSettings}
          onChange={(v) => set('rememberSettings', v)}
        />
        <Switch
          label="Track practice stats"
          hint="Time, clean runs, and where mistakes cluster"
          checked={options.trackStats}
          onChange={(v) => set('trackStats', v)}
        />
      </section>

      <p className="drawer-keys">
        Keys: ← → move by bar · Space plays, pauses or skips · Esc closes
      </p>
    </aside>
  )
}
