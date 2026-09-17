const isSafari =
  typeof navigator !== 'undefined' &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

export function SafariNotice() {
  if (!isSafari) return null
  return (
    <p className="notice-banner">
      Open Keys in Chrome — Safari does not support Web MIDI.
    </p>
  )
}
