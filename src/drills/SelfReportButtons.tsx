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
          className="btn btn-secondary min-h-16 flex-1 text-lg"
        >
          Show me
        </button>
      )}
      <button
        type="button"
        onClick={onHit}
        className="btn btn-primary min-h-16 flex-1 text-lg font-medium"
      >
        Hit
      </button>
      <button
        type="button"
        onClick={onMiss}
        className="btn btn-danger min-h-16 flex-1 text-lg font-medium"
      >
        Miss
      </button>
    </>
  )
}
