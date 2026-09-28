import { useEffect, useState, type ReactNode } from 'react'
import type { InputSource } from '../input'
import { parseMidiArrayBuffer } from '../pieces/parseMidi'
import { getPiece, getPieceState } from '../pieces/pieceStore'
import { loadLastOptions, withDefaults, type PieceState } from '../pieces/practice/options'
import { PracticeScreen } from '../pieces/PracticeScreen'
import type { ParsedPiece, StoredPiece } from '../pieces/types'

interface Props {
  pieceId: string
  input: InputSource
  onBack: () => void
}

/** Where to start: this piece's saved settings, else your last-used switches. */
function startingState(pieceId: string, saved: PieceState | undefined): PieceState {
  const fresh: PieceState = {
    pieceId,
    mode: 'learn',
    tempoPercent: 100,
    hands: 'both',
    range: null,
    lastBar: 1,
    view: 'staff',
    options: loadLastOptions(),
    updatedAt: new Date().toISOString(),
  }
  if (!saved) return fresh
  const options = withDefaults(saved.options)
  // Remembering off: only the switches carry over.
  if (!options.rememberSettings) return { ...fresh, options }
  return { ...fresh, ...saved, options }
}

export function PiecePage({ pieceId, input, onBack }: Props) {
  const [stored, setStored] = useState<StoredPiece | null>(null)
  const [parsed, setParsed] = useState<ParsedPiece | null>(null)
  const [initial, setInitial] = useState<PieceState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const p = await getPiece(pieceId)
        if (!p) throw new Error('Piece not found')
        const [parsedPiece, saved] = await Promise.all([
          parseMidiArrayBuffer(p.midiBytes),
          getPieceState(pieceId).catch(() => undefined),
        ])
        if (cancelled) return
        const start = startingState(pieceId, saved)
        // Saved range or bar may not fit if the file changed
        if (start.range && start.range.end > parsedPiece.measureCount) start.range = null
        start.lastBar = Math.min(parsedPiece.measureCount, Math.max(1, start.lastBar))
        setStored(p)
        setParsed(parsedPiece)
        setInitial(start)
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load piece')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pieceId])

  if (error) {
    return (
      <Shell onBack={onBack} title="Piece">
        <p className="font-ui text-felt">{error}</p>
      </Shell>
    )
  }

  if (!stored || !parsed || !initial) {
    return (
      <Shell onBack={onBack} title="Piece">
        <p className="font-ui text-dust">Loading…</p>
      </Shell>
    )
  }

  return (
    <PracticeScreen
      pieceId={pieceId}
      parsed={parsed}
      title={stored.name}
      input={input}
      initial={initial}
      onExit={onBack}
    />
  )
}

function Shell({
  onBack,
  title,
  children,
}: {
  onBack: () => void
  title: string
  children: ReactNode
}) {
  return (
    <div className="page-shell">
      <div className="topbar">
        <button type="button" onClick={onBack} className="btn btn-ghost">
          Back
        </button>
        <span />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <h1 className="page-title page-title--section">{title}</h1>
        {children}
      </div>
    </div>
  )
}
