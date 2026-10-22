import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item, Rarity } from '../types'
import { BAG_UI_IDLE, bagGesture, bagOverlay, coverage } from './bagui'
import type { BagUi } from './bagui'
import { CELL } from './icons'
import { BAG_X, BAG_Y, BELT_STEP, BELT_X, BELT_Y, CLOSE_BOX, INV_H, INV_TOP, INV_W, WORN_SLOTS } from './inventory'
import { BAG_H, BAG_W, plainItem } from './items'
import { BELT_SLOT_W, SLOT } from './canvas'
import { shots } from './screens'
import { newGame } from './world'
import { apply } from './game'
/** The window's cards and menus, the labels on its art left out. */
const cards = (...args: Parameters<typeof bagOverlay>) => bagOverlay(...args).filter(b => b.role !== 'label')

const knight = (): Game => newGame(1, 'knight')
const put = (g: Game, base: string, rarity: Rarity, x: number, y: number, over: Partial<Item> = {}): Item => {
  const item = { ...plainItem(g, base, rarity), x, y, ...over }
  g.bag = [...g.bag, item]
  return item
}
/** A screen pixel as the click layer reports it: in cells, to the fraction; a cell is one pixel wide and two tall. */
const cell = (px: number, py: number) => ({ x: px + 0.5, y: (py + 0.5) / 2 })
/** The middle of a bag item, in screen pixels. */
const middle = (item: Item) => ({ x: BAG_X + item.x * CELL + Math.floor((item.w * CELL) / 2), y: INV_TOP + BAG_Y + item.y * CELL + Math.floor((item.h * CELL) / 2) })
const click = (g: Game, ui: BagUi, p: { x: number; y: number }, button: 'left' | 'right' = 'left') => bagGesture(g, ui, { type: 'release', from: cell(p.x, p.y), at: cell(p.x, p.y), button })
const dragTo = (g: Game, from: { x: number; y: number }, to: { x: number; y: number }) =>
  bagGesture(g, BAG_UI_IDLE, { type: 'release', from: cell(from.x, from.y), at: cell(to.x, to.y), button: 'left' })
const cellAt = (x: number, y: number) => ({ x: BAG_X + x * CELL + 3, y: INV_TOP + BAG_Y + y * CELL + 3 })
const menuLine = (g: Game, ui: BagUi, entry: number) => {
  const menu = cards(g, ui).find(b => b.role === 'menu')!
  return { x: menu.x + 2, y: (menu.y + 1 + entry) * 2 }
}

describe('clicks', () => {
  test('a bag item is selected; clicked again while selected, its menu opens', async () => {
    const g = knight()
    const helm = put(g, 'steelHelm', 'common', 4, 1)
    expect(click(g, BAG_UI_IDLE, middle(helm)).actions).toEqual([{ kind: 'select', id: helm.id }])
    const again = click({ ...g, cursor: helm.id }, BAG_UI_IDLE, middle(helm))
    expect(again.actions).toEqual([])
    expect(again.ui.menu).toEqual({ id: helm.id, confirm: false })
  })

  test('a right click selects the item and opens its menu at once', async () => {
    const g = knight()
    const helm = put(g, 'steelHelm', 'common', 4, 1)
    const r = click(g, BAG_UI_IDLE, middle(helm), 'right')
    expect(r.actions).toEqual([{ kind: 'select', id: helm.id }])
    expect(r.ui.menu).toEqual({ id: helm.id, confirm: false })
  })

  test('worn gear is taken off; an empty worn slot does nothing', async () => {
    const g = knight()
    const [x, y, w, h] = WORN_SLOTS.weapon
    expect(click(g, BAG_UI_IDLE, { x: x + w - 1, y: INV_TOP + y + h - 1 }).actions).toEqual([{ kind: 'unequip', slot: 'weapon' }])
    const [rx, ry] = WORN_SLOTS.ring
    expect(click(g, BAG_UI_IDLE, { x: rx, y: INV_TOP + ry }).actions).toEqual([])
  })

  test('a belt slot is used; the close box closes the inventory', async () => {
    for (let i = 0; i < 5; i += 1) expect(click(knight(), BAG_UI_IDLE, { x: BELT_X + i * BELT_STEP + 7, y: INV_TOP + BELT_Y + 7 }).actions).toEqual([{ kind: 'use', slot: i }])
    // A slot answers over all it draws, 10 by 10: its last column and its last row too.
    for (let i = 0; i < 5; i += 1) expect(click(knight(), BAG_UI_IDLE, { x: BELT_X + i * BELT_STEP + 9, y: INV_TOP + BELT_Y + 9 }).actions).toEqual([{ kind: 'use', slot: i }])
    const [cx, cy, cw, ch] = CLOSE_BOX
    expect(click(knight(), BAG_UI_IDLE, { x: cx + Math.floor(cw / 2), y: cy + Math.floor(ch / 2) }).actions).toEqual([{ kind: 'panel', panel: 'bag' }])
  })

  test('with an item selected, a click on empty space lets it go: the selection and its popovers are gone', async () => {
    const g = knight()
    const ring = put(g, 'ring', 'common', 0, 0)
    const sel = { ...g, cursor: ring.id }
    for (const p of [cellAt(5, 4), { x: BAG_X, y: INV_TOP + BAG_Y + 3 }]) expect(click(sel, BAG_UI_IDLE, p).actions).toEqual([{ kind: 'deselect' }])
    const after = apply(sel, { kind: 'deselect' })
    expect(after.cursor).toBeNull()
    expect(cards(after, BAG_UI_IDLE)).toEqual([])
  })

  test('an empty bag cell, a grid line or the margin does nothing', async () => {
    const g = knight()
    put(g, 'ring', 'common', 0, 0)
    for (const p of [cellAt(5, 4), { x: BAG_X, y: INV_TOP + BAG_Y + 3 }, { x: INV_W - 1, y: INV_TOP + 30 }]) expect(click(g, BAG_UI_IDLE, p).actions).toEqual([])
  })
})

describe('the menu', () => {
  const opened = () => {
    const g = knight()
    const helm = put(g, 'steelHelm', 'common', 4, 1)
    const sel = { ...g, cursor: helm.id }
    return { g: sel, helm, ui: click(sel, BAG_UI_IDLE, middle(helm)).ui }
  }

  test('offers Equip, then Destroy, then Lock', async () => {
    const { g, ui } = opened()
    const menu = cards(g, ui).find(b => b.role === 'menu')!
    expect(menu.lines.map(l => l.map(r => r.text).join(''))).toEqual(['e Equip', 'd Destroy', 'g Lock'])
  })

  test('Equip equips the item and closes the menu', async () => {
    const { g, ui } = opened()
    const r = click(g, ui, menuLine(g, ui, 0))
    expect(r.actions).toEqual([{ kind: 'equip' }])
    expect(r.ui.menu).toBeNull()
  })

  test('Destroy asks first; only a second click destroys', async () => {
    const { g, ui } = opened()
    const first = click(g, ui, menuLine(g, ui, 1))
    expect(first.actions).toEqual([])
    expect(first.ui.menu?.confirm).toBe(true)
    expect(cards(g, first.ui).find(b => b.role === 'menu')!.lines[1]!.map(r => r.text).join('')).toBe('d Destroy? click again')
    const second = click(g, first.ui, menuLine(g, first.ui, 1))
    expect(second.actions).toEqual([{ kind: 'destroy' }])
    expect(second.ui.menu).toBeNull()
  })

  test('Lock locks the item and closes the menu; a locked item\'s Destroy is greyed, and does nothing', async () => {
    const { g, ui } = opened()
    const r = click(g, ui, menuLine(g, ui, 2))
    expect(r.actions).toEqual([{ kind: 'lock' }])
    expect(r.ui.menu).toBeNull()
    const locked = { ...g, bag: g.bag.map(i => ({ ...i, locked: true as const })) }
    expect(cards(locked, ui).find(b => b.role === 'menu')!.lines.map(l => l.map(x => x.text).join(''))).toEqual(['e Equip', 'd Destroy  locked', 'g Unlock'])
    const tried = click(locked, ui, menuLine(locked, ui, 1))
    expect(tried.actions).toEqual([])
    expect(tried.ui.menu?.confirm).toBe(false)
  })

  test('a click anywhere else closes the menu and does nothing more', async () => {
    const { g, ui, helm } = opened()
    const other = put(g, 'ring', 'common', 0, 5)
    const r = click(g, ui, middle(other))
    expect(r.actions).toEqual([])
    expect(r.ui.menu).toBeNull()
    void helm
  })

  test('for gear the hero cannot wear, Equip is greyed with the reason and does nothing', async () => {
    const g = knight()
    const wand = put(g, 'wand', 'common', 6, 0)
    const sel = { ...g, cursor: wand.id }
    const ui = click(sel, BAG_UI_IDLE, middle(wand)).ui
    const menu = cards(sel, ui).find(b => b.role === 'menu')!
    expect(menu.lines[0]!.map(r => r.text).join('')).toBe('e Equip  Mage only')
    expect(menu.lines[0]![0]!.dim).toBe(true)
    expect(click(sel, ui, menuLine(sel, ui, 0)).actions).toEqual([])
  })
})

describe('popovers', () => {
  test('a selected item with gear worn in its slot shows both: the item and, titled Equipped, what it would replace', async () => {
    const g = knight()
    const chain = put(g, 'chain', 'rare', 2, 0, { def: 7 })
    const boxes = cards({ ...g, cursor: chain.id }, BAG_UI_IDLE)
    expect(boxes.map(b => b.role)).toEqual(['worn', 'item'])
    expect(boxes[0]!.lines[0]!.map(r => r.text).join('')).toBe('Equipped')
    expect(boxes[0]!.lines[1]!.map(r => r.text).join('')).toBe(g.gear.armor!.name)
    expect(boxes[1]!.lines[0]!.map(r => r.text).join('')).toBe(chain.name)
  })

  test('each stat is one line with its change against the worn item; a stat only the worn one has shows as a loss', async () => {
    const g = knight()
    const worn = g.gear.armor!
    const chain = put(g, 'chain', 'rare', 2, 0, { def: worn.def + 3, hp: 0 })
    const lines = cards({ ...g, cursor: chain.id }, BAG_UI_IDLE).find(b => b.role === 'item')!.lines.map(l => l.map(r => r.text).join(''))
    const gain = lines.find(l => l.startsWith(`+${worn.def + 3} def`))
    expect(gain).toMatch(/^\+\d+ def +\+3 \^$/)
    expect(worn.hp).toBeGreaterThan(0)
    const loss = lines.find(l => l.startsWith('HP '))
    expect(loss).toMatch(new RegExp(`^HP +-${worn.hp} v$`))
    // The changes line up in one column.
    expect(loss!.indexOf('-')).toBe(gain!.lastIndexOf('+'))
  })

  test('wherever the item lies, the two never overlap and both stay inside the screen', async () => {
    const shapes: [string, Rarity, Partial<Item>][] = [
      ['chain', 'legendary', { name: 'Sturdy Chain Shirt of the Unbroken Build', power: 'greenBlock' }],
      ['steelHelm', 'rare', {}],
      ['wand', 'epic', { name: 'Wand of Many Many Stack Traces' }],
      ['ring', 'legendary', { name: 'Band of the Endless Loop', power: 'loopHeal' }],
      ['boots', 'common', {}],
    ]
    for (const [base, rarity, over] of shapes) {
      const probe = plainItem(knight(), base, rarity)
      for (let y = 0; y + probe.h <= 6; y += 1) for (let x = 0; x + probe.w <= 8; x += 1) {
        for (const longWorn of [false, true]) {
        const g = knight()
        const item = put(g, base, rarity, x, y, over)
        // A worn legendary with a long name and a power makes the widest Equipped box.
        if (longWorn) g.gear = { ...g.gear, [item.slot]: { ...plainItem(g, base, 'legendary'), name: 'Everlasting Relic of the Thousand Green Builds', power: 'loopHeal' } }
        const boxes = cards({ ...g, cursor: item.id }, BAG_UI_IDLE)
        for (const b of boxes) expect(b.x >= 0 && b.x + b.w <= INV_W && b.y >= 0 && b.y + b.h <= (INV_TOP + INV_H) / 2 ? 'inside' : `${base} at ${x},${y}: ${b.role} at ${b.x}+${b.w}, ${b.y}+${b.h}`).toBe('inside')
        const [a, b] = boxes
        const apart = a === undefined || b === undefined || !(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
        expect(apart ? 'apart' : `${base} at ${x},${y}: popovers overlap`).toBe('apart')
        }
      }
    }
  })

  /** Screen pixels of `item`'s rectangle in the bag, and how many of them a box (in cells, two pixels a row) covers. */
  const bagRect = (i: Item) => ({ x: BAG_X + i.x * CELL, y: INV_TOP + BAG_Y + i.y * CELL, w: i.w * CELL, h: i.h * CELL })
  const covered = (r: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => {
    const w = Math.max(0, Math.min(r.x + r.w, b.x + b.w) - Math.max(r.x, b.x))
    const h = Math.max(0, Math.min(r.y + r.h, (b.y + b.h) * 2) - Math.max(r.y, b.y * 2))
    return w * h
  }
  /** A crowded bag as in play: amulets and rings in most cells, a gap here and there, and an amulet worn. */
  const crowded = () => {
    const g = knight()
    for (let y = 0; y < 6; y += 1) for (let x = 0; x < 8; x += 1) if ((x * 3 + y * 5) % 7 !== 0) put(g, x % 2 === 0 ? 'amulet' : 'ring', 'uncommon', x, y, { name: 'Charm of Green Builds' })
    g.gear = { ...g.gear, amulet: { ...plainItem(g, 'amulet', 'legendary'), name: 'Rubber Duck of Insight' }, ring: { ...plainItem(g, 'ring', 'rare'), name: 'Sharp Band' } }
    return g
  }

  test('in a crowded bag the selected item and what it is compared with are never covered', async () => {
    const g = crowded()
    for (const item of g.bag) {
      const boxes = cards({ ...g, cursor: item.id }, BAG_UI_IDLE)
      const [wx, wy, ww, wh] = WORN_SLOTS[item.slot]
      for (const b of boxes) {
        expect(covered(bagRect(item), b) === 0 ? 'clear' : `${item.x},${item.y}: the ${b.role} box covers the item`).toBe('clear')
        expect(covered({ x: wx, y: INV_TOP + wy, w: ww, h: wh }, b) === 0 ? 'clear' : `${item.x},${item.y}: the ${b.role} box covers the worn ${item.slot}`).toBe('clear')
      }
    }
  })

  test('a card or menu covers no slot, filled or empty, nor the bag\'s grid nor a chosen item\'s brackets: in every kit', async () => {
    const grid = { x: BAG_X, y: INV_TOP + BAG_Y, w: BAG_W * CELL + 1, h: BAG_H * CELL + 1 }
    const slots = Object.values(WORN_SLOTS).map(([x, y, w, h]) => ({ x, y: INV_TOP + y, w, h }))
    const belt = [0, 1, 2, 3, 4].map(i => ({ x: BELT_X + i * BELT_STEP, y: INV_TOP + BELT_Y, w: BELT_SLOT_W, h: SLOT }))
    let seen = 0
    for (const s of shots().filter(x => x.name.startsWith('inventory-'))) {
      for (const b of s.boxes.filter(x => x.role === 'worn' || x.role === 'item' || x.role === 'menu')) {
        seen += 1
        for (const r of [grid, ...slots, ...belt]) expect([s.name, b.role, covered(r, b)]).toEqual([s.name, b.role, 0])
      }
    }
    expect(seen).toBeGreaterThan(20)
  })

  test('where the screen has room, the popovers cover no item at all', async () => {
    const g = knight()
    const ring = put(g, 'ring', 'rare', 6, 1)
    put(g, 'amulet', 'uncommon', 7, 1)
    put(g, 'amulet', 'uncommon', 6, 2)
    g.gear = { ...g.gear, ring: { ...plainItem(g, 'ring', 'epic'), name: 'Band of Many Long Names' } }
    const boxes = cards({ ...g, cursor: ring.id }, BAG_UI_IDLE)
    expect(boxes.length).toBe(2)
    for (const b of boxes) {
      for (const i of g.bag) expect(covered(bagRect(i), b)).toBe(0)
      for (const slot of Object.keys(g.gear) as (keyof typeof WORN_SLOTS)[]) {
        const [wx, wy, ww, wh] = WORN_SLOTS[slot]
        expect(covered({ x: wx, y: INV_TOP + wy, w: ww, h: wh }, b) === 0 ? 'clear' : `${b.role} covers the worn ${slot}`).toBe('clear')
      }
    }
  })

  test('hiding one pixel of an item being compared costs more than hiding every other item on the screen', async () => {
    const g = knight()
    for (let y = 0; y < 6; y += 1) for (let x = 0; x < 8; x += 1) put(g, 'ring', 'common', x, y)
    const kept = bagRect(g.bag[0]!)
    const cost = coverage(g, [kept])
    // The kept ring's first pixel row, one cell wide; against the whole screen under the kept ring and its brackets'
    // 2 px.
    const one = cost(kept.x, Math.floor(kept.y / 2), 1, 1)
    const below = Math.floor((kept.y + kept.h + 2) / 2) + 1
    const rest = cost(0, below, INV_W, (INV_TOP + INV_H) / 2 - below)
    expect(rest).toBeGreaterThan(0)
    expect(one).toBeGreaterThan(rest)
  })

  test('a click on a popover lands on the box, not on the item it covers', async () => {
    const g = knight()
    const chain = put(g, 'chain', 'rare', 2, 0)
    for (let x = 4; x < 8; x += 1) for (let y = 0; y < 6; y += 1) put(g, 'ring', 'common', x, y)
    const sel = { ...g, cursor: chain.id }
    const pop = cards(sel, BAG_UI_IDLE).find(b => b.role === 'item')!
    const ringUnder = (q: { x: number; y: number }) => g.bag.find(i => i.base === 'ring' && i.x === Math.floor((q.x - BAG_X) / CELL) && i.y === Math.floor((q.y + 1 - INV_TOP - BAG_Y) / CELL))
    // A cell of the popover, over a ring where the box had to cover one.
    const inside = Array.from({ length: (pop.w - 2) * (pop.h - 2) }, (_, k) => ({ x: pop.x + 1 + (k % (pop.w - 2)), y: (pop.y + 1 + Math.floor(k / (pop.w - 2))) * 2 }))
    const p = inside.find(q => ringUnder(q) !== undefined) ?? inside[0]!
    const under = ringUnder(p)
    if (under !== undefined) expect(click(g, BAG_UI_IDLE, p).actions).toEqual([{ kind: 'select', id: under.id }])
    expect(click(sel, BAG_UI_IDLE, p).actions).toEqual([])
  })

  test('nothing selected, or an item being dragged: no popovers', async () => {
    const g = knight()
    const helm = put(g, 'steelHelm', 'common', 4, 0)
    expect(cards(g, BAG_UI_IDLE)).toEqual([])
    const dragging: BagUi = { menu: null, drag: { source: { kind: 'bag', id: helm.id }, at: cellAt(1, 1), grab: { x: 3, y: 3 } } }
    expect(cards({ ...g, cursor: helm.id }, dragging)).toEqual([])
  })
})

describe('dragging', () => {
  const setup = () => {
    const g = knight()
    const helm = put(g, 'steelHelm', 'common', 4, 0)
    put(g, 'chain', 'common', 0, 0)
    return { g, helm }
  }

  test('while held, the drag follows the pointer and keeps where the item was grabbed', async () => {
    const { g, helm } = setup()
    const from = middle(helm)
    const r = bagGesture(g, BAG_UI_IDLE, { type: 'drag', from: cell(from.x, from.y), at: cell(30, 50) })
    expect(r.ui.drag?.source).toEqual({ kind: 'bag', id: helm.id })
    expect(r.ui.drag?.at).toEqual({ x: 30, y: 50 })
    expect(r.ui.drag?.grab).toEqual({ x: from.x - (BAG_X + 4 * CELL + 1), y: from.y - (INV_TOP + BAG_Y + 1) })
    expect(r.actions).toEqual([])
  })

  test('released on free cells, the item is placed there', async () => {
    const { g, helm } = setup()
    expect(dragTo(g, middle(helm), { x: middle(helm).x + CELL, y: middle(helm).y + 3 * CELL }).actions).toEqual([{ kind: 'place', id: helm.id, x: 5, y: 3 }])
  })

  test('released where it does not fit, or outside the bag, nothing happens', async () => {
    const { g, helm } = setup()
    expect(dragTo(g, middle(helm), { x: middle(helm).x - 3 * CELL, y: middle(helm).y }).actions).toEqual([])
    expect(dragTo(g, middle(helm), { x: 1, y: 1 }).actions).toEqual([])
  })

  test('released on its worn slot, the item is equipped; on another slot, nothing', async () => {
    const { g, helm } = setup()
    const [hx, hy] = WORN_SLOTS.helm
    expect(dragTo(g, middle(helm), { x: hx + 4, y: INV_TOP + hy + 4 }).actions).toEqual([{ kind: 'select', id: helm.id }, { kind: 'equip' }])
    const [bx, by] = WORN_SLOTS.boots
    expect(dragTo(g, middle(helm), { x: bx + 4, y: INV_TOP + by + 4 }).actions).toEqual([])
  })

  test('worn gear dragged onto free bag cells is taken off into that spot', async () => {
    const { g } = setup()
    const [x, y] = WORN_SLOTS.weapon
    const worn = g.gear.weapon!
    const r = dragTo(g, { x: x + 3, y: INV_TOP + y + 3 }, cellAt(6, 2))
    expect(r.actions).toEqual([{ kind: 'unequip', slot: 'weapon' }, { kind: 'place', id: worn.id, x: 6, y: 2 }])
  })

  test('a release ends the drag', async () => {
    const { g, helm } = setup()
    expect(dragTo(g, middle(helm), cellAt(5, 3)).ui.drag).toBeNull()
  })
})
