const isSafari =
  typeof navigator !== 'undefined' &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

export function SafariNotice() {
  if (!isSafari) return null
  return (
    <p className="bg-felt px-4 py-2 text-center font-ui text-sm text-ivory">
      Open Keys in Chrome — Safari does not support Web MIDI.
    </p>
  )
}
