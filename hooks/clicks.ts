// A click layer: a Client over a pixel surface (the map, the dashboard strip) that posts each left click to the hooks,
// with the cell under the pointer (to the fraction, where the terminal reports it) and the surface's size in cells,
// which the hooks pass in: the region's own size is 0 until it has been laid out. It posts where the pointer is while
// no button is held too (a hover; none once it leaves), and writes the blocks the hooks hand it: names over a tile, a
// chosen one's card.
import type { ClientModule } from 'claude-code'

/** A run of a block's row, styled. */
type Run = { text: string; color?: string; bold?: boolean; dim?: boolean }
/** Text written over the surface from a cell down: rows of runs, each row padded a cell each side to the widest, one
 * block; each cell on its ground (the map under it, darkened; a lit row lighter), which the hooks work out. The names
 * over a tile are one, the chosen one's card another. */
type Block = { x: number; y: number; rows: Run[][]; grounds?: string[][] }
type Props = { columns: number; rows: number; blocks?: Block[] }

// The text boxes' fill (POPOVER_BG in window.ts): a cell's ground when the hooks give none.
const LABEL_BG = '#0e0d13'

const width = (row: readonly Run[]) => row.reduce((n, r) => n + r.text.length, 0)

/** A row's cells in runs of one style and ground: cells that share both written together. */
const cellsOf = (row: readonly Run[], wide: number, grounds: readonly string[] | undefined) => {
  const styled = [{ text: ' ' }, ...row, { text: ' '.repeat(wide - width(row) + 1) }] as Run[]
  const cells = styled.flatMap(r => [...r.text].map(ch => ({ ch, r })))
  return cells.reduce<(Run & { bg: string })[]>((runs, { ch, r }, i) => {
    const bg = grounds?.[i] ?? LABEL_BG
    const last = runs.at(-1)
    if (last !== undefined && last.bg === bg && last.color === r.color && last.bold === r.bold && last.dim === r.dim) last.text += ch
    else runs.push({ text: ch, color: r.color, bold: r.bold, dim: r.dim, bg })
    return runs
  }, [])
}

const clicks: ClientModule<Props> = (props, surface) => {
  const { Box, Text } = surface.elements
  surface.onPointer(e => {
    const at = { x: e.fine?.x ?? e.x + 0.5, y: e.fine?.y ?? e.y + 0.5, columns: props.columns, rows: props.rows }
    if (e.type === 'down' && e.button === 'left') surface.post(at)
    else if (e.type === 'move' && e.button === undefined) surface.post({ type: 'hover', ...at })
    else if (e.type === 'leave') surface.post({ type: 'hover' })
  })
  const blocks = props.blocks ?? []
  if (blocks.length === 0) return Box({})
  return Box({
    width: props.columns,
    height: props.rows,
    children: blocks.map(block => {
      const wide = Math.max(...block.rows.map(width))
      return Box({
        position: 'absolute',
        top: block.y,
        left: block.x,
        flexDirection: 'column',
        children: block.rows.map((row, r) => Text({ children: cellsOf(row, wide, block.grounds?.[r]).map(run => Text({ color: run.color, backgroundColor: run.bg, bold: run.bold ?? true, dimColor: run.dim, children: run.text })) })),
      })
    }),
  })
}

export default clicks
