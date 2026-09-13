interface Props {
  title: string
  onBack: () => void
}

export function ComingSoon({ title, onBack }: Props) {
  return (
    <div className="flex h-full flex-col bg-ink">
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 px-3 font-ui text-dust"
        >
          Back
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <h1 className="font-display text-4xl text-ivory">{title}</h1>
        <p className="font-ui text-dust">Not built yet — pick another module.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 min-h-16 bg-brass px-8 font-ui text-lg text-ink"
        >
          Modules
        </button>
      </div>
    </div>
  )
}
