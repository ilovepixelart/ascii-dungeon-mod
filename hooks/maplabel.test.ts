import { expect, test } from 'claude-code/testing'

import { mapLabelAt } from './pixels'

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
