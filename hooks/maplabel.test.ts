import { expect, test } from 'claude-code/testing'

import { labelGrounds, labelRowAt, mapLabelAt } from './pixels'
import { lyingLabel } from './panels'
import { RARITY_COLOR, plainItem } from './items'

// A label is its text with a cell of room and a frame each side: four cells wider than its text.
const NAME = 'Refactored Leather Boots of Fast Feedback'

test('a floor item\'s label stays inside the map, a name too long for it cut to fit', async () => {
  for (const columns of [10, 40, 105]) {
    const label = mapLabelAt({ x: columns - 3, y: 6 }, [NAME], { columns, rows: 20 })
    expect(label.x + label.lines[0]!.length + 4).toBeLessThanOrEqual(columns)
    expect(label.x).toBeGreaterThanOrEqual(0)
  }
  expect(mapLabelAt({ x: 5, y: 6 }, [NAME], { columns: 105, rows: 20 }).lines).toEqual([NAME])
  expect(mapLabelAt({ x: 5, y: 6 }, [NAME], { columns: 40, rows: 20 }).lines).toEqual(['Refactored Leather Boots of Fast Fe…'])
})

test('a floor item\'s label sits over its tile, under it on the map\'s top row, never below the map', async () => {
  expect(mapLabelAt({ x: 5, y: 6 }, ['Ring'], { columns: 60, rows: 20 }).y).toBe(5)
  expect(mapLabelAt({ x: 5, y: 0 }, ['Ring'], { columns: 60, rows: 20 }).y).toBe(4)
  expect(mapLabelAt({ x: 5, y: 0 }, ['Ring'], { columns: 60, rows: 4 }).y).toBeLessThanOrEqual(3)
})

test('several names stack over the tile, the last row just above it; with no room above, under it; inside the map', async () => {
  const three = ['Ring', 'Leather Boots', 'Short Sword']
  // The tile's top at row 6: rows 3, 4 and 5.
  expect(mapLabelAt({ x: 5, y: 6 }, three, { columns: 60, rows: 20 }).y).toBe(3)
  // At row 1 there are not three rows above: under the tile, four rows down.
  expect(mapLabelAt({ x: 5, y: 1 }, three, { columns: 60, rows: 20 }).y).toBe(5)
  const low = mapLabelAt({ x: 5, y: 1 }, three, { columns: 60, rows: 6 })
  expect(low.y + low.lines.length).toBeLessThanOrEqual(6)
})

test('a tile with several items names each on its own row in its tier\'s color, the rarest first; one item, its name', async () => {
  const ring = { ...plainItem({ nextId: 1 }, 'ring', 'rare'), name: 'Ring' }
  const boots = { ...plainItem({ nextId: 2 }, 'boots', 'epic'), name: 'Leather Boots' }
  const sword = { ...plainItem({ nextId: 3 }, 'sword', 'common'), name: 'Short Sword' }
  expect(lyingLabel([ring])).toEqual({ lines: [{ text: 'Ring', color: RARITY_COLOR.rare, id: 1 }], color: RARITY_COLOR.rare })
  expect(lyingLabel([ring, boots, sword])).toEqual({
    lines: [{ text: 'Leather Boots', color: RARITY_COLOR.epic, id: 2 }, { text: 'Ring', color: RARITY_COLOR.rare, id: 1 }, { text: 'Short Sword', color: RARITY_COLOR.common, id: 3 }],
    color: RARITY_COLOR.epic,
  })
})

test('past five items, four a page and a row that says which and turns it, round to the first past the last', async () => {
  const seven = Array.from({ length: 7 }, (_, i) => ({ ...plainItem({ nextId: 10 + i }, 'ring'), name: `Ring ${i + 1}` }))
  const ring = (i: number) => ({ text: `Ring ${i}`, color: RARITY_COLOR.common, id: 9 + i })
  expect(lyingLabel(seven).lines).toEqual([ring(1), ring(2), ring(3), ring(4), { text: '< 1-4 of 7 >', turnsPage: true }])
  expect(lyingLabel(seven, 1).lines).toEqual([ring(5), ring(6), ring(7), { text: '< 5-7 of 7 >', turnsPage: true }])
  expect(lyingLabel(seven, 2).lines).toEqual(lyingLabel(seven, 0).lines)
})

test('what beats what is worn comes first, marked; then the rarest', async () => {
  const [a, b, c] = (['common', 'epic', 'rare'] as const).map((rarity, i) => ({ ...plainItem({ nextId: 20 + i }, 'ring', rarity), name: `Ring ${rarity}` }))
  const lines = lyingLabel([a!, b!, c!], 0, i => i.id === a!.id).lines
  expect(lines.map(l => [l.text, l.isUp ?? false])).toEqual([['Ring common', true], ['Ring epic', false], ['Ring rare', false]])
})

test('a label\'s ground is the map under each cell, its two pixels averaged and darkened; the row the pointer is on lit', async () => {
  // One row of one letter: three cells, the first a red pixel over a blue one, the rest black.
  const frame = new Uint32Array(6)
  frame[0] = 0xff0000
  frame[3] = 0x0000ff
  const label = { x: 0, y: 0, lines: ['X'] }
  // The mean, 127.5 red and blue, at 40%: 51, on the 17-step grid #330033; lit a quarter toward white, 102 and 68.
  expect(labelGrounds(frame, 3, label)).toEqual([['#330033', '#000000', '#000000']])
  expect(labelGrounds(frame, 3, label, 0)[0]![0]).toBe('#664466')
})

test('the label\'s row under a cell: inside its block, padding and all; off it, none', async () => {
  const label = { x: 4, y: 2, lines: ['Ring', 'Long Boots'] }
  // 10 letters and a cell each side: columns 4 to 15, rows 2 and 3.
  expect([labelRowAt(label, { x: 4, y: 2 }), labelRowAt(label, { x: 15, y: 3 }), labelRowAt(label, { x: 16, y: 3 }), labelRowAt(label, { x: 5, y: 4 })]).toEqual([0, 1, undefined, undefined])
})
