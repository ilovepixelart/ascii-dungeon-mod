// A click layer: a Client over a pixel surface (the map, the dashboard strip) that posts each left click to the hooks,
// with the cell under the pointer (to the fraction, where the terminal reports it) and the surface's size in cells,
// which the hooks pass in: the region's own size is 0 until it has been laid out. It posts where the pointer is while
// no button is held too (a hover; none once it leaves), and writes the label the hooks hand it, names over a tile.
import type { ClientModule } from 'claude-code'

/** Names written over the surface from a cell down, a row each in its color, each cell on its ground (the map under it,
 * darkened, the row the pointer is on lit), which the hooks work out. */
type Label = { x: number; y: number; lines: { text: string; color: string }[]; grounds?: string[][] }
type Props = { columns: number; rows: number; label?: Label | null }

// The text boxes' fill (POPOVER_BG in window.ts): a cell's ground when the hooks give none.
const LABEL_BG = '#0e0d13'

/** A row's text in runs of one ground: each cell on its own, cells that share one written together. */
const runsOf = (text: string, grounds: readonly string[] | undefined) =>
  [...text].reduce<{ text: string; bg: string }[]>((runs, ch, i) => {
    const bg = grounds?.[i] ?? LABEL_BG
    const last = runs.at(-1)
    if (last?.bg === bg) last.text += ch
    else runs.push({ text: ch, bg })
    return runs
  }, [])

const clicks: ClientModule<Props> = (props, surface) => {
  const { Box, Text } = surface.elements
  surface.onPointer(e => {
    const at = { x: e.fine?.x ?? e.x + 0.5, y: e.fine?.y ?? e.y + 0.5, columns: props.columns, rows: props.rows }
    if (e.type === 'down' && e.button === 'left') surface.post(at)
    else if (e.type === 'move' && e.button === undefined) surface.post({ type: 'hover', ...at })
    else if (e.type === 'leave') surface.post({ type: 'hover' })
  })
  const label = props.label ?? null
  if (label === null) return Box({})
  return Box({
    width: props.columns,
    height: props.rows,
    children: [
      Box({
        position: 'absolute',
        top: label.y,
        left: label.x,
        flexDirection: 'column',
        // The rows padded to the widest, so the label is one block over the map.
        children: label.lines.map((l, r) => {
          const text = ` ${l.text.padEnd(Math.max(...label.lines.map(m => m.text.length)))} `
          return Text({ children: runsOf(text, label.grounds?.[r]).map(run => Text({ color: l.color, backgroundColor: run.bg, bold: true, children: run.text })) })
        }),
      }),
    ],
  })
}

export default clicks
