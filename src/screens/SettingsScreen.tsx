import { useEffect, useState } from 'react'
import { createMicSource } from '../input'
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
  const [previewStatus, setPreviewStatus] = useState('Starting mic preview…')
  const [previewNote, setPreviewNote] = useState<string | null>(null)
  const [rms, setRms] = useState(0)
  const [gate, setGate] = useState(0)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const set = <K extends keyof MicSettings>(key: K, value: MicSettings[K]) =>
    setS((prev) => ({ ...prev, [key]: value }))

  // Live mic preview using the *draft* slider values (debounced recreate)
  useEffect(() => {
    let cancelled = false
    let src: ReturnType<typeof createMicSource> | null = null
    let raf = 0
    const timer = window.setTimeout(() => {
      src = createMicSource(s)
      void src
        .start()
        .then(() => {
          if (cancelled) {
            src?.dispose()
            return
          }
          setPreviewError(null)
          const tick = () => {
            if (cancelled || !src) return
            const m = src.getMeter()
            if (m) {
              setPreviewStatus(m.status)
              setPreviewNote(m.note)
              setRms(m.rms)
              setGate(m.gate)
            }
            raf = requestAnimationFrame(tick)
          }
          raf = requestAnimationFrame(tick)
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setPreviewError(
              e instanceof Error ? e.message : 'Mic preview unavailable',
            )
            setPreviewStatus('Mic unavailable')
          }
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (raf) cancelAnimationFrame(raf)
      src?.dispose()
    }
  }, [s])

  const meterMax = Math.max(0.15, gate * 2, rms * 1.2)
  const rmsPct = Math.min(100, (rms / meterMax) * 100)
  const gatePct = Math.min(100, (gate / meterMax) * 100)

  return (
    <div className="page-shell">
      <div className="topbar">
        <button type="button" onClick={onBack} className="btn btn-ghost">
          Home
        </button>
        <h1 className="page-title text-xl">Settings</h1>
        <span className="w-16" />
      </div>

      <main className="page-main page-main--settings space-y-8">
        <section className="surface-panel space-y-3 px-4 py-4">
          <p className="font-ui text-sm text-dust">Live preview</p>
          <p
            className={`font-display text-3xl ${
              previewNote ? 'text-brass' : 'text-ivory'
            }`}
          >
            {previewNote ? `Hearing ${previewNote}` : previewStatus}
          </p>
          <div className="meter-track">
            <div
              className="meter-fill"
              style={{ width: `${rmsPct}%` }}
            />
            <div
              className="meter-gate"
              style={{ left: `${gatePct}%` }}
              title="Gate"
            />
          </div>
          <p className="font-ui text-xs text-dust">
            Bar = mic level · red mark = gate (must rise above to count)
          </p>
          {previewError && (
            <p className="font-ui text-sm text-felt">{previewError}</p>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="page-title text-2xl">Microphone</h2>
          <p className="font-ui text-sm text-dust">
            These only affect Mic input. MIDI from the Kawai ignores them.
            Play a note while you move the sliders — the preview uses the draft
            values before you Save.
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
            className="btn btn-primary btn-block min-h-16 text-lg"
            onClick={() => onSave(s)}
          >
            Save
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-block min-h-14"
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
