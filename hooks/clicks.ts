// A click layer: a Client over a pixel surface (the map, the dashboard strip) that posts each left click to the hooks,
// with the cell under the pointer (to the fraction, where the terminal reports it) and the surface's size in cells,
// which the hooks pass in: the region's own size is 0 until it has been laid out. It posts where the pointer is while
// no button is held too (a hover; none once it leaves), and writes the label the hooks hand it, names over a tile.
import type { ClientModule } from 'claude-code'

/** Names written over the surface from a cell down, a row each in its color. */
type Label = { x: number; y: number; lines: { text: string; color: string }[] }
type Props = { columns: number; rows: number; label?: Label | null }

// The text boxes' fill (POPOVER_BG in window.ts), so a name reads over any tile.
const LABEL_BG = '#0e0d13'

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
        children: label.lines.map(l => Text({ color: l.color, backgroundColor: LABEL_BG, bold: true, children: ` ${l.text.padEnd(Math.max(...label.lines.map(m => m.text.length)))} ` })),
      }),
    ],
  })
}

export default clicks
