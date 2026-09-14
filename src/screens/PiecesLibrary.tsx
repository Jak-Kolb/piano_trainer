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
    <div className="flex h-full flex-col overflow-y-auto bg-ink">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 px-3 font-ui text-dust"
        >
          Home
        </button>
        <p className="truncate font-ui text-xs text-dust">{midiStatus}</p>
      </div>
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 pb-10">
        <h1 className="font-display text-4xl text-ivory">Pieces</h1>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="min-h-16 bg-brass font-ui text-lg font-medium text-ink"
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
        <ul className="space-y-2">
          {pieces.length === 0 && (
            <li className="font-ui text-dust">
              No pieces yet — import a .mid file.
            </li>
          )}
          {pieces.map((p) => (
            <li key={p.id} className="flex gap-2">
              <button
                type="button"
                onClick={() => onOpen(p.id)}
                className="min-h-20 flex-1 bg-shadow px-4 py-3 text-left"
              >
                <span className="font-display text-xl text-ivory">{p.name}</span>
                <span className="mt-1 block font-ui text-sm text-dust">
                  {p.noteCount} notes · {p.measureCount} bars ·{' '}
                  {Math.round(p.durationSec)}s
                </span>
              </button>
              <button
                type="button"
                className="min-h-20 px-3 font-ui text-dust"
                onClick={() =>
                  void deletePiece(p.id).then(reload)
                }
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
