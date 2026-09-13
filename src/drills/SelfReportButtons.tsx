export function SelfReportButtons({
  onShow,
  onHit,
  onMiss,
  showOnlyGrade,
}: {
  onShow?: () => void
  onHit: () => void
  onMiss: () => void
  showOnlyGrade?: boolean
}) {
  return (
    <>
      {!showOnlyGrade && onShow && (
        <button
          type="button"
          onClick={onShow}
          className="min-h-16 flex-1 bg-shadow font-ui text-lg text-ivory"
        >
          Show me
        </button>
      )}
      <button
        type="button"
        onClick={onHit}
        className="min-h-16 flex-1 bg-brass font-ui text-lg font-medium text-ink"
      >
        Hit
      </button>
      <button
        type="button"
        onClick={onMiss}
        className="min-h-16 flex-1 bg-felt font-ui text-lg font-medium text-ivory"
      >
        Miss
      </button>
    </>
  )
}
