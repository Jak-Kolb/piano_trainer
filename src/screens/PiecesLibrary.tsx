import { useEffect, useRef, useState } from 'react'
import { importMidiFile, listPieces, deletePiece } from '../pieces/pieceStore'
import type { StoredPiece } from '../pieces/types'

interface Props {
  onBack: () => void
  onOpen: (id: string) => void
  midiStatus: string
}

export function PiecesLibrary({ onBack, onOpen, midiStatus }: Props) {
  const [pieces, setPieces] = useState<StoredPiece[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = async () => {
    setPieces(await listPieces())
  }

  useEffect(() => {
    void reload()
  }, [])

  const onImport = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const piece = await importMidiFile(file)
      await reload()
      onOpen(piece.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import MIDI')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-shell">
      <div className="topbar">
        <button type="button" onClick={onBack} className="btn btn-ghost">
          Home
        </button>
        <p className="topbar-status">{midiStatus}</p>
      </div>
      <main className="page-main page-main--pieces">
        <h1 className="page-title page-title--section">Pieces</h1>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="btn btn-primary btn-block min-h-16 text-lg"
        >
          {busy ? 'Importing…' : 'Import MIDI'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".mid,.midi,audio/midi"
          className="hidden"
          onChange={(e) => void onImport(e.target.files?.[0])}
        />
        {error && <p className="font-ui text-sm text-felt">{error}</p>}
        <ul className="space-y-3">
          {pieces.length === 0 && (
            <li className="surface-panel px-4 py-5 font-ui text-dust">
              No pieces yet — import a .mid file.
            </li>
          )}
          {pieces.map((p) => (
            <li key={p.id} className="flex gap-2">
              <button
                type="button"
                onClick={() => onOpen(p.id)}
                className="surface-card min-h-20 flex-1 px-4 py-3 text-left"
              >
                <span className="font-display text-xl text-ivory">{p.name}</span>
                <span className="mt-1 block font-ui text-sm text-dust">
                  {p.noteCount} notes · {p.measureCount} bars ·{' '}
                  {Math.round(p.durationSec)}s
                </span>
              </button>
              <button
                type="button"
                className="btn btn-ghost min-h-20 px-3"
                onClick={() => void deletePiece(p.id).then(reload)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
