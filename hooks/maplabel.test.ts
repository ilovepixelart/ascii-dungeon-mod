import { expect, test } from 'claude-code/testing'

import { mapLabelAt } from './pixels'
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
  expect(lyingLabel([ring])).toEqual({ lines: [{ text: 'Ring', color: RARITY_COLOR.rare }], color: RARITY_COLOR.rare })
  expect(lyingLabel([ring, boots, sword])).toEqual({
    lines: [{ text: 'Leather Boots', color: RARITY_COLOR.epic }, { text: 'Ring', color: RARITY_COLOR.rare }, { text: 'Short Sword', color: RARITY_COLOR.common }],
    color: RARITY_COLOR.epic,
  })
})

test('past five items, four are named and the rest counted', async () => {
  const seven = Array.from({ length: 7 }, (_, i) => ({ ...plainItem({ nextId: 10 + i }, 'ring'), name: `Ring ${i + 1}` }))
  expect(lyingLabel(seven).lines).toEqual([...['Ring 1', 'Ring 2', 'Ring 3', 'Ring 4'].map(text => ({ text, color: RARITY_COLOR.common })), { text: '+3 more' }])
})
