import { useState } from 'react'
import {
  DEFAULT_MIC_SETTINGS,
  type MicSettings,
} from '../settings/micSettings'

interface Props {
  initial: MicSettings
  onBack: () => void
  onSave: (s: MicSettings) => void
}

export function SettingsScreen({ initial, onBack, onSave }: Props) {
  const [s, setS] = useState<MicSettings>(initial)

  const set = <K extends keyof MicSettings>(key: K, value: MicSettings[K]) =>
    setS((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-ink">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 px-3 font-ui text-dust"
        >
          Home
        </button>
        <h1 className="font-display text-xl text-ivory">Settings</h1>
        <span className="w-16" />
      </div>

      <main className="mx-auto w-full max-w-lg space-y-8 px-6 pb-12">
        <section className="space-y-4">
          <h2 className="font-display text-2xl text-ivory">Microphone</h2>
          <p className="font-ui text-sm text-dust">
            These only affect Mic input. MIDI from the Kawai ignores them.
            Higher volume / clarity = less false triggers from room noise.
          </p>

          <Slider
            label="Volume floor"
            hint="Quiet sounds below this are silence"
            min={0.01}
            max={0.12}
            step={0.005}
            value={s.minRms}
            display={s.minRms.toFixed(3)}
            onChange={(v) => set('minRms', v)}
          />
          <Slider
            label="Pitch clarity"
            hint="How clean a tone must be to count as a note"
            min={0.5}
            max={0.95}
            step={0.01}
            value={s.minClarity}
            display={s.minClarity.toFixed(2)}
            onChange={(v) => set('minClarity', v)}
          />
          <Slider
            label="Noise gate"
            hint="Multiplier on background noise — higher ignores more hiss"
            min={2}
            max={12}
            step={0.5}
            value={s.noiseGateMult}
            display={s.noiseGateMult.toFixed(1)}
            onChange={(v) => set('noiseGateMult', v)}
          />
          <Slider
            label="Attack"
            hint="How long a note must hold before it registers"
            min={1}
            max={12}
            step={1}
            value={s.attackFrames}
            display={String(s.attackFrames)}
            onChange={(v) => set('attackFrames', Math.round(v))}
          />
          <Slider
            label="Release"
            hint="Silence length before it goes back to Listening"
            min={3}
            max={30}
            step={1}
            value={s.releaseFrames}
            display={String(s.releaseFrames)}
            onChange={(v) => set('releaseFrames', Math.round(v))}
          />
          <Slider
            label="YIN threshold"
            hint="Lower = more detections; higher = stricter"
            min={0.05}
            max={0.25}
            step={0.01}
            value={s.yinThreshold}
            display={s.yinThreshold.toFixed(2)}
            onChange={(v) => set('yinThreshold', v)}
          />
        </section>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="min-h-16 bg-brass font-ui text-lg text-ink"
            onClick={() => onSave(s)}
          >
            Save
          </button>
          <button
            type="button"
            className="min-h-14 bg-shadow font-ui text-dust"
            onClick={() => setS({ ...DEFAULT_MIC_SETTINGS })}
          >
            Reset to defaults
          </button>
        </div>
      </main>
    </div>
  )
}

function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string
  hint: string
  min: number
  max: number
  step: number
  value: number
  display: string
  onChange: (v: number) => void
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-ui text-ivory">{label}</span>
        <span className="font-display text-brass">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <span className="block font-ui text-xs text-dust">{hint}</span>
    </label>
  )
}
