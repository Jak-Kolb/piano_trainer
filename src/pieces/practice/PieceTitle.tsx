import { useRef, useState } from 'react'

/** The piece's name at the top of the practice screen. Double-click to rename it. */
export function PieceTitle({ name, onRename }: { name: string; onRename?: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  // Enter / Escape already finished the edit: ignore the blur as the box goes away.
  const finished = useRef(false)

  if (!editing || !onRename) {
    return (
      <h1
        className="practice-title"
        title={onRename ? 'Double-click to rename' : undefined}
        onDoubleClick={() => {
          if (!onRename) return
          finished.current = false
          setDraft(name)
          setEditing(true)
        }}
      >
        {name}
      </h1>
    )
  }

  const finish = (save: boolean) => {
    if (finished.current) return
    finished.current = true
    setEditing(false)
    const next = draft.trim()
    if (save && next && next !== name) onRename(next)
  }
  return (
    <input
      className="practice-title practice-title-input"
      aria-label="Piece name"
      value={draft}
      maxLength={120}
      ref={(el) => {
        if (el && document.activeElement !== el) {
          el.focus()
          el.select()
        }
      }}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true)
        else if (e.key === 'Escape') finish(false)
      }}
      onBlur={() => finish(true)}
    />
  )
}
