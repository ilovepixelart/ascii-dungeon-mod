import { describe, expect, test } from 'claude-code/testing'

import { BG } from './canvas'
import { BODY_TOP, CLOSE_BOX, CLOSE_INK, HEAD_H, LABEL_INK, LABEL_Y, WINDOW_W, boxShape, cardWithMenu, coverage, place, windowPixels } from './window'

const GOLD_INK = '#ffd34d'
const inkIn = (px: string[][], ink: string, y0: number, y1: number) => px.slice(y0, y1).some(row => row.includes(ink))

describe('the window', () => {
  test('is WINDOW_W wide and as tall as its title bar, labels and body', async () => {
    const body = Array.from({ length: 7 }, () => Array<string>(WINDOW_W).fill('#123456'))
    const c = windowPixels({ title: 'SHOP', labels: [{ text: 'A', x: 2 }] }, body)
    expect(c.px.length).toBe(BODY_TOP + 7)
    for (const row of c.px) expect(row.length).toBe(WINDOW_W)
    expect(c.px[BODY_TOP - 1]?.[0]).toBe(BG)
    expect(c.px[BODY_TOP]?.[0]).toBe('#123456')
    expect(c.px[BODY_TOP + 6]?.[WINDOW_W - 1]).toBe('#123456')
  })

  test('without labels, the body starts 3 px under the title bar, on an even row so text boxes sit on whole cells', async () => {
    const body = [Array<string>(WINDOW_W).fill('#123456')]
    const c = windowPixels({ title: 'A', labels: [] }, body)
    expect(c.px.length).toBe(HEAD_H + 3 + 1)
    expect(c.px[HEAD_H + 2]?.[0]).toBe(BG)
    expect(c.px[HEAD_H + 3]?.[0]).toBe('#123456')
    expect((HEAD_H + 3) % 2).toBe(0)
  })

  test('shows the gold only when the window says so', async () => {
    expect(inkIn(windowPixels({ title: 'A', labels: [] }, []).px, GOLD_INK, 0, HEAD_H)).toBe(false)
    expect(inkIn(windowPixels({ title: 'A', gold: 12, labels: [] }, []).px, GOLD_INK, 0, HEAD_H)).toBe(true)
  })

  test('always has its close box, and a label where it is asked for', async () => {
    const c = windowPixels({ title: 'A', labels: [{ text: 'I', x: 40 }] }, [])
    const [x, y, w, h] = CLOSE_BOX
    expect(inkIn(c.px.slice(y, y + h).map(r => r.slice(x, x + w)), CLOSE_INK, 0, h)).toBe(true)
    // 'I' is a column three pixels wide at most, starting at the label's x.
    expect(c.px.slice(LABEL_Y, LABEL_Y + 5).some(row => row.slice(40, 43).includes(LABEL_INK))).toBe(true)
    expect(c.px.slice(LABEL_Y, LABEL_Y + 5).some(row => [...row.slice(0, 40), ...row.slice(44)].includes(LABEL_INK))).toBe(false)
  })
})

describe('placing text boxes', () => {
  test('coverage weighs each pixel under a box: a cell is one pixel across and two down', async () => {
    const cost = coverage(10, [{ rect: { x: 0, y: 0, w: 4, h: 4 }, weight: 1 }])
    expect(cost(0, 0, 2, 1)).toBe(4)
    expect(cost(0, 0, 4, 2)).toBe(16)
    expect(cost(4, 0, 3, 3)).toBe(0)
    expect(cost(0, 2, 4, 3)).toBe(0)
  })

  test('a box goes where it hides nothing when there is such a place, nearest what it is about', async () => {
    const rows = 20
    const heavy = { x: 0, y: 0, w: WINDOW_W, h: 20 }
    const cost = coverage(rows, [{ rect: heavy, weight: 1 }])
    const at = place(cost, rows, [], { x: 50, y: 0, w: 4, h: 4 }, 10, 3)
    expect(cost(at.x, at.y, 10, 3)).toBe(0)
    // The first free row is cell row 10; nearest the point above it is straight below it.
    expect({ x: at.x, y: at.y }).toEqual({ x: 47, y: 10 })
  })

  test('a box never overlaps one already placed', async () => {
    const rows = 6
    const cost = coverage(rows, [])
    const first = { ...boxShape('a', [[{ text: 'x'.repeat(20) }]], '#fff'), x: 40, y: 0 }
    const at = place(cost, rows, [first], { x: 45, y: 0, w: 2, h: 2 }, first.w, first.h)
    const overlaps = at.x < first.x + first.w && first.x < at.x + first.w && at.y < first.y + first.h && first.y < at.y + first.h
    expect(overlaps).toBe(false)
  })

  test('a card and its menu never cover what the card is about, even where every place hides something', async () => {
    const rows = 20
    const everything = [{ rect: { x: 0, y: 0, w: WINDOW_W, h: rows * 2 }, weight: 1 }]
    const card = boxShape('card', [[{ text: 'x'.repeat(30) }], [{ text: 'y' }]], '#fff')
    const menu = boxShape('menu', [[{ text: 'z'.repeat(12) }]], '#fff')
    for (const near of [{ x: 0, y: 0, w: 8, h: 6 }, { x: 50, y: 14, w: 7, h: 7 }, { x: WINDOW_W - 8, y: 32, w: 8, h: 8 }]) {
      for (const b of cardWithMenu(rows, everything, near, card, menu)) {
        const covers = near.x < b.x + b.w && b.x < near.x + near.w && near.y < (b.y + b.h) * 2 && b.y * 2 < near.y + near.h
        expect(covers).toBe(false)
      }
    }
  })

  test('a box is sized to its widest line, with frame and padding', async () => {
    const b = boxShape('a', [[{ text: 'abc' }, { text: 'de' }], [{ text: 'f' }]], '#fff')
    expect(b.w).toBe(5 + 4)
    expect(b.h).toBe(2 + 2)
  })
})

test('the close box is square, its X centred: a pixel of the box all round it inside the frame', async () => {
  const c = windowPixels({ title: 'T', labels: [] }, [])
  const [x, y, w, h] = CLOSE_BOX
  expect(w).toBe(h)
  const inkAt = (dx: number, dy: number) => c.px[y + dy]![x + dx] === CLOSE_INK
  const lit: [number, number][] = []
  for (let dy = 1; dy < h - 1; dy += 1) for (let dx = 1; dx < w - 1; dx += 1) if (inkAt(dx, dy)) lit.push([dx, dy])
  const xs = lit.map(p => p[0])
  const ys = lit.map(p => p[1])
  expect([Math.min(...xs) - 1, w - 2 - Math.max(...xs), Math.min(...ys) - 1, h - 2 - Math.max(...ys)]).toEqual([1, 1, 1, 1])
})
