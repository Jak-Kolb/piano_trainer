import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { parseMidiArrayBuffer } from './parseMidi'
import type { PieceState } from './practice/options'
import type { PracticeSession } from './practice/stats'
import type { StoredPiece } from './types'

interface KeysDB extends DBSchema {
  pieces: {
    key: string
    value: StoredPiece
  }
}

/**
 * Practice data lives in its own database so the pieces database keeps
 * its original version (older builds of the app can still open it).
 */
interface PracticeDB extends DBSchema {
  /** Per-piece settings (tempo, hands, range, switches). */
  pieceState: {
    key: string
    value: PieceState
  }
  /** Practice history. */
  sessions: {
    key: number
    value: PracticeSession
    indexes: { byPiece: string }
  }
}

let dbPromise: Promise<IDBPDatabase<KeysDB>> | null = null
let practicePromise: Promise<IDBPDatabase<PracticeDB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<KeysDB>('keys-pieces', 1, {
      upgrade(database) {
        database.createObjectStore('pieces', { keyPath: 'id' })
      },
    })
  }
  return dbPromise
}

function practiceDb() {
  if (!practicePromise) {
    practicePromise = openDB<PracticeDB>('keys-practice', 1, {
      upgrade(database) {
        database.createObjectStore('pieceState', { keyPath: 'pieceId' })
        const sessions = database.createObjectStore('sessions', {
          keyPath: 'id',
          autoIncrement: true,
        })
        sessions.createIndex('byPiece', 'pieceId')
      },
    })
  }
  return practicePromise
}

export async function listPieces(): Promise<StoredPiece[]> {
  const all = await (await db()).getAll('pieces')
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getPiece(id: string): Promise<StoredPiece | undefined> {
  return (await db()).get('pieces', id)
}

/** Delete a piece with its settings and practice history. */
export async function deletePiece(id: string): Promise<void> {
  await (await db()).delete('pieces', id)
  const p = await practiceDb()
  const tx = p.transaction(['pieceState', 'sessions'], 'readwrite')
  await tx.objectStore('pieceState').delete(id)
  const byPiece = tx.objectStore('sessions').index('byPiece')
  for (let c = await byPiece.openCursor(id); c; c = await c.continue()) {
    await c.delete()
  }
  await tx.done
}

export async function importMidiFile(file: File): Promise<StoredPiece> {
  const midiBytes = await file.arrayBuffer()
  const parsed = await parseMidiArrayBuffer(midiBytes)
  const name = file.name.replace(/\.midi?$/i, '') || 'Untitled'
  const piece: StoredPiece = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    midiBytes,
    durationSec: parsed.durationSec,
    noteCount: parsed.notes.length,
    measureCount: parsed.measureCount,
    hasTwoHands: parsed.hasTwoHands,
  }
  await (await db()).put('pieces', piece)
  return piece
}

export async function getPieceState(pieceId: string): Promise<PieceState | undefined> {
  return (await practiceDb()).get('pieceState', pieceId)
}

export async function savePieceState(state: PieceState): Promise<void> {
  await (await practiceDb()).put('pieceState', state)
}

/** Sessions for one piece, or every piece when omitted. */
export async function listSessions(pieceId?: string): Promise<PracticeSession[]> {
  const p = await practiceDb()
  return pieceId ? p.getAllFromIndex('sessions', 'byPiece', pieceId) : p.getAll('sessions')
}

/** Insert or update a session; returns its id. */
export async function saveSession(session: PracticeSession): Promise<number> {
  return (await practiceDb()).put('sessions', session)
}
