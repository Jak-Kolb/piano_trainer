import { useEffect, useState } from 'react'
import {
  loadSoundOutput,
  saveSoundOutput,
  watchPianoOutput,
  type SoundOutput,
} from '../pieces/pianoOut'
import {
  COLOR_PROFILES,
  type ColorProfileId,
} from '../settings/colorProfile'

interface Props {
  colorProfile: ColorProfileId
  onBack: () => void
  onColorProfile: (id: ColorProfileId) => void
}

export function SettingsScreen({
  colorProfile,
  onBack,
  onColorProfile,
}: Props) {
  const [sound, setSound] = useState<SoundOutput>(loadSoundOutput)
  const [piano, setPiano] = useState<string | null>(null)
  useEffect(() => watchPianoOutput(setPiano), [])
  const soundOptions: { id: SoundOutput; label: string; blurb: string }[] = [
    { id: 'computer', label: 'This computer', blurb: 'Built-in grand piano sound' },
    {
      id: 'piano',
      label: 'My piano',
      blurb: piano
        ? `Plays on ${piano} over USB`
        : 'No piano connected: sound stays on this computer until one is',
    },
  ]

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-ink">
      <div className="topbar">
        <button type="button" onClick={onBack} className="btn btn-ghost">
          Home
        </button>
        <h1 className="page-title">Settings</h1>
        <span className="w-16" />
      </div>

      <main className="page-main page-main--settings space-y-8">
        <section className="space-y-3">
          <h2 className="font-display text-lg text-ivory">Play sound through</h2>
          <p className="font-ui text-sm text-dust">
            Listen, the other hand in play-along, and “Hear it”. The metronome stays on this computer.
          </p>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Play sound through">
            {soundOptions.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={sound === o.id}
                onClick={() => {
                  setSound(o.id)
                  saveSoundOutput(o.id)
                }}
                className={`surface-card px-3 py-3 text-left ${sound === o.id ? 'ring-2 ring-brass' : ''}`}
              >
                <p className="font-ui text-sm text-ivory">{o.label}</p>
                <p className="font-ui text-xs text-dust">{o.blurb}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg text-ivory">Color profile</h2>
          <p className="font-ui text-sm text-dust">
            Swaps the whole stand look — UI and sheet music.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {COLOR_PROFILES.map((p) => {
              const selected = p.id === colorProfile
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onColorProfile(p.id)}
                  className={`surface-card px-3 py-3 text-left ${
                    selected ? 'ring-2 ring-brass' : ''
                  }`}
                >
                  <div className="mb-2 flex gap-1">
                    {[
                      p.vars['--color-ink'],
                      p.vars['--color-ivory'],
                      p.vars['--color-brass'],
                      p.vars['--color-felt'],
                    ].map((c, i) => (
                      <span
                        key={i}
                        className="h-4 w-4 rounded-sm border border-dust/30"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <p className="font-ui text-sm text-ivory">{p.label}</p>
                  <p className="font-ui text-xs text-dust">{p.blurb}</p>
                </button>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
