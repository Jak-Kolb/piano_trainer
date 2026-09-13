import type { ReactNode } from 'react'

export function DrillFrame({
  title,
  status,
  streak,
  onExit,
  banner,
  children,
  footer,
}: {
  title?: string
  status?: string
  streak?: number
  onExit: () => void
  banner?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex h-full flex-col bg-ink">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onExit}
          className="min-h-12 shrink-0 px-3 font-ui text-dust"
        >
          Exit
        </button>
        <p className="truncate font-ui text-xs text-dust">{status ?? title ?? ''}</p>
        <p className="shrink-0 font-ui text-sm text-dust">
          {streak !== undefined && (
            <>
              Streak <span className="font-display text-brass">{streak}</span>
            </>
          )}
        </p>
      </div>
      {banner}
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        {children}
      </div>
      {footer && <div className="flex gap-3 p-4 pb-8">{footer}</div>}
    </div>
  )
}
