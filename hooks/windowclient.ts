// A window's click layer: draws the text boxes the hooks lay out over its pixels, and reports whole gestures.
// A press is held here, so a release always carries where it started: posts are one a frame, and a later one in the
// same frame replaces an undelivered one, which a lone 'down' could not survive.
import type { ClientModule } from 'claude-code'

type Run = { text: string; color?: string; bold?: boolean; dim?: boolean }
type Box = { x: number; y: number; w: number; h: number; border: string; lines: Run[][] }
type Props = { columns: number; rows: number; boxes: Box[] }
type Held = { from: { x: number; y: number }; button: 'left' | 'middle' | 'right' } | null

// The frame and fill are pixels under this layer (POPOVER_BG in window.ts); this writes the text inside the frame.
const BOX_BG = '#0e0d13'

const windowLayer: ClientModule<Props, Held> = (props, surface) => {
  const { Box, Text } = surface.elements
  surface.onPointer(e => {
    const at = { x: e.fine?.x ?? e.x + 0.5, y: e.fine?.y ?? e.y + 0.5 }
    const held = surface.state ?? null
    if (e.type === 'down' && e.button !== undefined) surface.setState({ from: at, button: e.button })
    else if (e.type === 'move' && held !== null && e.button !== undefined) surface.post({ type: 'drag', from: held.from, at })
    else if (e.type === 'up' && held !== null) {
      surface.post({ type: 'release', from: held.from, at, button: held.button })
      surface.setState(null)
    }
  })
  return Box({
    width: props.columns,
    height: props.rows,
    children: props.boxes.map(b =>
      Box({
        position: 'absolute',
        top: b.y + 1,
        left: b.x + 1,
        width: b.w - 2,
        height: b.h - 2,
        flexDirection: 'column',
        backgroundColor: BOX_BG,
        paddingX: 1,
        children: b.lines.map(line => Text({ wrap: 'truncate-end', children: line.map(r => Text({ color: r.color, bold: r.bold, dimColor: r.dim, children: r.text })) })),
      }),
    ),
  })
}

export default windowLayer
