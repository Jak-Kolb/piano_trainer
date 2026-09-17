import type { ReactNode } from 'react'

export function DrillFrame({
  title,
  status,
  streak,
  round,
  accuracy,
  onExit,
  banner,
  children,
  keyboard,
  footer,
}: {
  title?: string
  status?: string
  streak?: number
  /** e.g. "3 / 20" */
  round?: string
  /** e.g. "80%" */
  accuracy?: string
  onExit: () => void
  banner?: ReactNode
  children: ReactNode
  /** Walk-through-quality piano (or diagram) pinned above the footer. */
  keyboard?: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="topbar">
        <button type="button" onClick={onExit} className="btn btn-ghost shrink-0">
          Exit
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate font-ui text-[11px] text-dust">
            {status ?? title ?? ''}
          </p>
          {(round || accuracy) && (
            <p className="font-ui text-xs text-dust">
              {round}
              {round && accuracy ? ' · ' : ''}
              {accuracy ? (
                <>
                  Acc <span className="text-brass">{accuracy}</span>
                </>
              ) : null}
            </p>
          )}
        </div>
        <p className="shrink-0 font-ui text-sm text-dust">
          {streak !== undefined && (
            <>
              Streak <span className="font-display text-brass">{streak}</span>
            </>
          )}
        </p>
      </div>
      {banner}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4">
        {children}
      </div>
      {keyboard}
      {footer && (
        <div className="flex flex-wrap gap-3 border-t border-dust/15 bg-[rgba(12,18,32,0.55)] p-4 pb-6">
          {footer}
        </div>
      )}
    </div>
  )
}
