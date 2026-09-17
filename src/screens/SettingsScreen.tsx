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
                  className={`rounded border px-3 py-3 text-left transition ${
                    selected
                      ? 'border-brass bg-shadow'
                      : 'border-dust/40 bg-shadow/60'
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
