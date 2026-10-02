/** Software MIDI ports (macOS's IAC Driver, network sessions…): not a piano on a cable. */
export function isVirtualPort(name: string | null | undefined): boolean {
  return /\b(IAC|Network|Session|Virtual|Through)\b/i.test(name ?? '')
}
