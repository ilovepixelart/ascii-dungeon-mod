// A click layer: a Client that draws nothing over a pixel surface (the map, the dashboard strip) and posts each left
// click to the hooks, with the cell under the pointer (to the fraction, where the terminal reports it) and the
// surface's size in cells, which the hooks pass in: the region's own size is 0 until it has been laid out.
import type { ClientModule } from 'claude-code'

type Size = { columns: number; rows: number }

const clicks: ClientModule<Size> = (size, surface) => {
  surface.onPointer(e => {
    if (e.type !== 'down' || e.button !== 'left') return
    surface.post({ x: e.fine?.x ?? e.x + 0.5, y: e.fine?.y ?? e.y + 0.5, columns: size.columns, rows: size.rows })
  })
  return surface.elements.Box({})
}

export default clicks
