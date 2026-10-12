// The bag: a grid of cells, items placed by their footprint.
import type { Game, Item } from '../../types'

export const BAG_W = 8
export const BAG_H = 6

const covers = (item: Item, x: number, y: number) =>
  x >= item.x && x < item.x + item.w && y >= item.y && y < item.y + item.h

export const itemAt = (bag: readonly Item[], x: number, y: number) => bag.find(item => covers(item, x, y))

const isFree = (bag: readonly Item[], x: number, y: number, w: number, h: number) => {
  for (let dx = 0; dx < w; dx += 1) {
    for (let dy = 0; dy < h; dy += 1) if (itemAt(bag, x + dx, y + dy) !== undefined) return false
  }
  return true
}

/** First free top-left cell for a w by h item, scanning column by column. */
export const fit = (bag: readonly Item[], w: number, h: number) => {
  for (let x = 0; x + w <= BAG_W; x += 1) {
    for (let y = 0; y + h <= BAG_H; y += 1) if (isFree(bag, x, y, w, h)) return { x, y }
  }
  return null
}

/** Puts `item` in the bag; false when no space holds it. */
export const stash = (g: Game, item: Item) => {
  const spot = fit(g.bag, item.w, item.h)
  if (spot === null) return false
  g.bag = [...g.bag, { ...item, ...spot }]
  g.cursor ??= item.id
  return true
}

/** Repacks the bag, largest items first; whatever no longer fits is returned, not dropped. */
export const repack = (items: readonly Item[]): { bag: Item[]; left: Item[] } => {
  const bySize = [...items].sort((a, b) => b.w * b.h - a.w * a.h || a.slot.localeCompare(b.slot) || a.id - b.id)
  return bySize.reduce<{ bag: Item[]; left: Item[] }>(
    (acc, item) => {
      const spot = fit(acc.bag, item.w, item.h)
      return spot === null ? { ...acc, left: [...acc.left, item] } : { ...acc, bag: [...acc.bag, { ...item, ...spot }] }
    },
    { bag: [], left: [] },
  )
}

export const arrange = (g: Game): string => {
  g.bag = repack(g.bag).bag
  return 'You arrange your bag.'
}

const order = (bag: readonly Item[]) => [...bag].sort((a, b) => a.x - b.x || a.y - b.y)

export const take = (g: Game, id: number) => {
  const ordered = order(g.bag)
  const at = ordered.findIndex(item => item.id === id)
  g.bag = g.bag.filter(item => item.id !== id)
  if (g.cursor === id) g.cursor = (ordered[at + 1] ?? ordered[at - 1])?.id ?? null
}

export const selected = (g: Game) => g.bag.find(item => item.id === g.cursor)

/** Whether a w by h item fits with its top-left at x, y, inside the bag and over no item but `self`. */
export const fitsAt = (bag: readonly Item[], w: number, h: number, x: number, y: number, self?: number) =>
  x >= 0 && y >= 0 && x + w <= BAG_W && y + h <= BAG_H && isFree(bag.filter(i => i.id !== self), x, y, w, h)

/** Moves a bag item so its top-left is at x, y; it may overlap only itself. */
export const place = (g: Game, id: number, x: number, y: number): string | undefined => {
  const item = g.bag.find(i => i.id === id)
  if (item === undefined) return undefined
  if (!fitsAt(g.bag, item.w, item.h, x, y, id)) return "It doesn't fit there."
  g.bag = g.bag.map(i => (i.id === id ? { ...i, x, y } : i))
  return undefined
}

/** Destroys the selected item for good. */
export const destroy = (g: Game): string | undefined => {
  const item = selected(g)
  if (item === undefined) return undefined
  if (item.locked === true) return `The ${item.name} is locked: unlock it to destroy it.`
  take(g, item.id)
  return `You destroy the ${item.name}.`
}

export const cycle = (g: Game) => {
  const ordered = order(g.bag)
  const at = ordered.findIndex(item => item.id === g.cursor)
  g.cursor = ordered[(at + 1) % Math.max(1, ordered.length)]?.id ?? null
}
