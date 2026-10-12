// Quarter-block encoding for mocks: 2 x 2 pixels a terminal cell, two colors a cell (the two that cover it best).
// Quadrant bits: 1 top-left, 2 top-right, 4 bottom-left, 8 bottom-right; the set bits take the ink, the rest the paper.
const GLYPHS = [' ', '▘', '▝', '▀', '▖', '▌', '▞', '▛', '▗', '▚', '▐', '▜', '▄', '▙', '▟', '█']

const rgb = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16))
const dist = (a: string, b: string) => rgb(a).reduce((s, v, i) => s + (v - (rgb(b)[i] ?? 0)) ** 2, 0)

/** One cell: the glyph and its ink and paper for four pixels (top-left, top-right, bottom-left, bottom-right). */
export const quadCell = (q: readonly [string, string, string, string]) => {
  const counts = new Map<string, number>()
  for (const c of q) counts.set(c, (counts.get(c) ?? 0) + 1)
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0])
  const paper = ranked[0] ?? '#000000'
  const ink = ranked[1] ?? paper
  let bits = 0
  q.forEach((c, i) => {
    if (c !== paper && dist(c, ink) <= dist(c, paper)) bits |= 1 << i
  })
  return { glyph: GLYPHS[bits] ?? ' ', ink, paper }
}

/** ANSI lines for a pixel grid `w` by `h` (both even), each cell a quarter block. */
export const quadLines = (px: (x: number, y: number) => string, w: number, h: number) =>
  Array.from({ length: h / 2 }, (_, cy) =>
    `${Array.from({ length: w / 2 }, (_, cx) => {
      const cell = quadCell([px(2 * cx, 2 * cy), px(2 * cx + 1, 2 * cy), px(2 * cx, 2 * cy + 1), px(2 * cx + 1, 2 * cy + 1)])
      const [ir, ig, ib] = rgb(cell.ink)
      const [pr, pg, pb] = rgb(cell.paper)
      return `\x1b[38;2;${ir};${ig};${ib}m\x1b[48;2;${pr};${pg};${pb}m${cell.glyph}`
    }).join('')}\x1b[0m`,
  )
