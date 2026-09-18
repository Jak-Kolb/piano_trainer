/**
 * Decide whether VexFlow StaveTie partials are needed at system boundaries.
 * Full same-system ties use both first_note and last_note; cross-system
 * engraving uses first_note:null (inbound) or last_note:null (outbound).
 */

/** Start of a system: note continues a tie but its partner was cleared. */
export function shouldDrawPartialInbound(
  tieFromPrev: boolean,
  partnerExists: boolean,
): boolean {
  return tieFromPrev && !partnerExists
}

/**
 * End of a system: note still ties forward and was never used as the
 * first_note of a completed full StaveTie in this system.
 */
export function shouldDrawPartialOutbound(
  tieToNext: boolean,
  completedAsFullTieFirst: boolean,
): boolean {
  return tieToNext && !completedAsFullTieFirst
}

/** Pure tie continuation: every pitch in the chord came from a prior slice. */
export function isPureTieContinuation(
  slices: { tieFromPrev: boolean }[],
): boolean {
  return slices.length > 0 && slices.every((s) => s.tieFromPrev)
}
