/**
 * Test-only: mount StaffNotation in jsdom so a vexRecorder spy can capture
 * what was drawn. Import this after mocking 'vexflow' (see vexRecorder.ts).
 */
import { act, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { StaffNotation } from '../StaffNotation'
import type { ParsedPiece } from '../types'
import { drawnStaves, resetVexLog, type DrawnStave } from './vexRecorder'

let shimmed = false
function installDomShims() {
  if (shimmed) return
  shimmed = true
  const g = globalThis as Record<string, unknown>
  g.IS_REACT_ACT_ENVIRONMENT = true
  if (!g.ResizeObserver) {
    g.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  const proto = window.SVGElement.prototype as unknown as Record<string, unknown>
  if (!proto.getBBox) {
    proto.getBBox = () => ({ x: 0, y: 0, width: 8, height: 10 })
  }
}

type Props = ComponentProps<typeof StaffNotation>

/** Render the lines around `measure` (default: from bar 1) and return staves. */
export async function renderStaff(
  parsed: ParsedPiece,
  overrides: Partial<Props> = {},
): Promise<DrawnStave[]> {
  installDomShims()
  resetVexLog()
  const div = document.createElement('div')
  Object.defineProperty(div, 'clientWidth', { value: 1200 })
  document.body.appendChild(div)
  const root = createRoot(div)
  const props: Props = {
    notes: parsed.notes,
    measure: 1,
    activeNotes: [],
    secPerQuarter: parsed.secPerQuarter,
    measureCount: parsed.measureCount,
    selection: null,
    onMeasurePointer: () => {},
    barsPerLine: 4,
    beatsPerBar: parsed.beatsPerBar,
    measures: parsed.measures,
    ...overrides,
  }
  await act(async () => {
    root.render(<StaffNotation {...props} />)
  })
  const staves = drawnStaves()
  await act(async () => root.unmount())
  div.remove()
  return staves
}
