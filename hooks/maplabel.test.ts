import { expect, test } from 'claude-code/testing'

import { mapLabelAt } from './pixels'
import { lyingLabel } from './panels'
import { RARITY_COLOR, plainItem } from './items'

// A label is its text with a cell of room and a frame each side: four cells wider than its text.
const NAME = 'Refactored Leather Boots of Fast Feedback'

test('a floor item\'s label stays inside the map, a name too long for it cut to fit', async () => {
  for (const columns of [10, 40, 105]) {
    const label = mapLabelAt({ x: columns - 3, y: 6 }, NAME, { columns, rows: 20 })
    expect(label.x + label.text.length + 4).toBeLessThanOrEqual(columns)
    expect(label.x).toBeGreaterThanOrEqual(0)
  }
  expect(mapLabelAt({ x: 5, y: 6 }, NAME, { columns: 105, rows: 20 }).text).toBe(NAME)
  expect(mapLabelAt({ x: 5, y: 6 }, NAME, { columns: 40, rows: 20 }).text).toBe('Refactored Leather Boots of Fast Fe…')
})

test('a floor item\'s label sits over its tile, under it on the map\'s top row, never below the map', async () => {
  expect(mapLabelAt({ x: 5, y: 6 }, 'Ring', { columns: 60, rows: 20 }).y).toBe(5)
  expect(mapLabelAt({ x: 5, y: 0 }, 'Ring', { columns: 60, rows: 20 }).y).toBe(4)
  expect(mapLabelAt({ x: 5, y: 0 }, 'Ring', { columns: 60, rows: 4 }).y).toBeLessThanOrEqual(3)
})

test('a tile with several items lying on it names them all, in the color of the rarest; one item, its name', async () => {
  const ring = { ...plainItem({ nextId: 1 }, 'ring', 'rare'), name: 'Ring' }
  const boots = { ...plainItem({ nextId: 2 }, 'boots', 'epic'), name: 'Leather Boots' }
  const sword = { ...plainItem({ nextId: 3 }, 'sword', 'common'), name: 'Short Sword' }
  expect(lyingLabel([ring])).toEqual({ text: 'Ring', color: RARITY_COLOR.rare })
  expect(lyingLabel([ring, boots, sword])).toEqual({ text: '3 items: Ring, Leather Boots, Short Sword', color: RARITY_COLOR.epic })
})
