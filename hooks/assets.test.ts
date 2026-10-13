import { expect, test } from 'claude-code/testing'

import { shots } from './screens'
import { BESTIARY, UNIQUES } from './game'
import { ICONS } from './icons'
import { BASES } from './items/catalog'
import { MONSTER_ART, missingGlyphs, monsterArt } from './pixelart'

test('every window drawn, in every class and rarity, asks for no art or color the game lacks, nor a letter the font lacks', { timeoutMs: 20000 }, async () => {
  missingGlyphs.clear()
  const magenta = shots().filter(s => s.px.some(row => row.includes('#ff00ff'))).map(s => s.name)
  expect(magenta).toEqual([])
  expect([...missingGlyphs]).toEqual([])
})

test('every item base has its icon, and every foe its art in every theme', async () => {
  expect(BASES.filter(b => ICONS[b.key] === undefined).map(b => b.key)).toEqual([])
  const foes = [...BESTIARY.map(b => b.glyph), ...Object.values(UNIQUES).map(u => u.glyph)]
  expect(foes.filter(g => MONSTER_ART[g] === undefined)).toEqual([])
  for (const theme of ['crypt', 'flooded', 'forge'] as const) expect(foes.filter(g => monsterArt(g, theme) === undefined)).toEqual([])
})
