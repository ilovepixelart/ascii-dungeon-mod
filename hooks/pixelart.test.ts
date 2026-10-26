import { describe, expect, test } from 'claude-code/testing'

import { CRACK, CRACK_INK, HERO_LAYERS, MONSTER_ART, NPC_ART, PAL, PX, TERRAIN, THING_ART, isCracked, TOWN_BIG_ART, TOWN_DECOR_ART, TOWN_THING_ART, TREE_ALT, heroArt, torch } from './pixelart'

const item = {} as never
const CAST: [string, readonly string[]][] = [
  ['hero', heroArt({ gear: { weapon: item } })],
  ['helmed', heroArt({ gear: { weapon: item, helm: item } })],
  ['unarmed', heroArt({ gear: {} })],
  ['mage', heroArt({ gear: { weapon: item, helm: item, armor: item, offhand: item }, cls: 'mage' })],
  ['rogue', heroArt({ gear: { weapon: item, helm: item, armor: item, offhand: item }, cls: 'rogue' })],
  ...Object.entries(MONSTER_ART),
  ...Object.entries(THING_ART),
  ...Object.entries(NPC_ART),
  ...Object.entries(TOWN_THING_ART),
  ...Object.entries(TOWN_DECOR_ART),
]
const mask = (art: readonly string[]) => art.join('').replace(/[^.]/g, '#')
/** How many pixels two silhouettes must differ by: the share of a sprite the 12x12 review settled on (10 of 144). */
const DISTINCT = Math.round((PX * PX * 10) / 144)
/** The least a pickup covers, by the same measure (45 of 144). */
const PICKUP_MIN = Math.round((PX * PX * 45) / 144)

describe('pixel art', () => {
  test('every sprite is PX by PX and paints only palette colors', async () => {
    for (const [name, art] of CAST) {
      expect(art.length === PX ? name : `${name}: ${art.length} rows`).toBe(name)
      for (const row of art) {
        expect(row.length === PX ? name : `${name}: row '${row}'`).toBe(name)
        for (const key of row) expect(key === '.' || PAL[key] !== undefined ? name : `${name}: no color ${key}`).toBe(name)
      }
    }
  })

  test('no two monsters share a silhouette: each differs in at least DISTINCT pixels', async () => {
    const monsters = Object.entries(MONSTER_ART)
    for (const [a, artA] of monsters) {
      for (const [b, artB] of monsters) {
        if (a >= b) continue
        const differ = [...mask(artA)].filter((c, i) => c !== mask(artB)[i]).length
        expect(differ >= DISTINCT ? 'ok' : `${a} vs ${b}: ${differ}`).toBe('ok')
      }
    }
  })

  test('no floor item shares a silhouette with another item or with a monster; the chests share theirs with each other', async () => {
    const all = [...Object.entries(MONSTER_ART), ...Object.entries(THING_ART)]
    // Every kind of chest, closed and opened, is drawn on one silhouette so it reads as a chest; its make shows in its colors.
    const CHESTS = new Set(['C', 'H', 'G', 'c', 'h', 'j'])
    for (const [a, artA] of Object.entries(THING_ART)) {
      for (const [b, artB] of all) {
        if (a === b || (CHESTS.has(a) && CHESTS.has(b))) continue
        const differ = [...mask(artA)].filter((c, i) => c !== mask(artB)[i]).length
        expect(differ >= DISTINCT ? 'ok' : `${a} vs ${b}: ${differ}`).toBe('ok')
      }
    }
  })

  test('no one in town shares a silhouette with the hero, another townsfolk or a town thing', async () => {
    const town = [['hero', heroArt({ gear: { weapon: item } })] as const, ...Object.entries(NPC_ART), ...Object.entries(TOWN_THING_ART)]
    for (const [a, artA] of town) {
      for (const [b, artB] of town) {
        if (a >= b) continue
        const differ = [...mask(artA)].filter((c, i) => c !== mask(artB)[i]).length
        expect(differ >= DISTINCT ? 'ok' : `${a} vs ${b}: ${differ}`).toBe('ok')
      }
    }
  })

  test('the town\'s big pieces are two tiles each way and paint only palette colors; the second tree green swaps only leaves', async () => {
    for (const [name, art] of Object.entries(TOWN_BIG_ART)) {
      expect(art.length === 2 * PX ? name : `${name}: ${art.length} rows`).toBe(name)
      for (const row of art) {
        expect(row.length === 2 * PX ? name : `${name}: row '${row}'`).toBe(name)
        for (const key of row) expect(key === '.' || PAL[key] !== undefined ? name : `${name}: no color ${key}`).toBe(name)
      }
    }
    const leaves = new Set(TOWN_BIG_ART.tree.join('').replace(/[^lLg]/g, ''))
    expect(Object.keys(TREE_ALT).every(k => leaves.has(k))).toBe(true)
  })

  test('every pickup covers at least PICKUP_MIN pixels, so it reads at a glance', async () => {
    for (const name of ['$', '!']) {
      const art = THING_ART[name] ?? []
      const covered = mask(art).replace(/\./g, '').length
      expect(covered >= PICKUP_MIN ? 'ok' : `${name}: ${covered} pixels`).toBe('ok')
    }
  })

  test('each hero shows a piece of gear only while its slot holds something, drawn from that slot\'s layer', async () => {
    const LAYER = { armor: 'armor', helm: 'gear', weapon: 'weapon', offhand: 'offhand' } as const
    for (const cls of ['knight', 'mage', 'rogue'] as const) {
      const bare = heroArt({ gear: {}, cls })
      for (const [slot, layer] of Object.entries(LAYER) as [keyof typeof LAYER, (typeof LAYER)[keyof typeof LAYER]][]) {
        const worn = heroArt({ gear: { [slot]: item }, cls })
        const changed = worn.flatMap((row, y) => [...row].flatMap((k, x) => (k !== bare[y]![x] ? [{ x, y }] : [])))
        expect(changed.length > 0 ? `${cls} ${slot}` : `${cls} ${slot} draws nothing`).toBe(`${cls} ${slot}`)
        // Every changed pixel is the slot's layer; a helm also hides the bare head, which only changes the head's rows.
        const own = HERO_LAYERS[cls][layer]
        for (const p of changed) expect(own[p.y]![p.x] !== '.' || (slot === 'helm' && HERO_LAYERS[cls].bare[p.y]![p.x] !== '.') ? 'own' : `${cls} ${slot} changed ${p.x},${p.y}`).toBe('own')
      }
    }
  })

  test('torchlight is full at the torch, never grows with distance, and keeps a floor', async () => {
    expect(torch(0)).toBe(1)
    for (let d = 0; d < 10; d += 0.5) expect(torch(d + 0.5)).toBeLessThanOrEqual(torch(d))
    expect(torch(50)).toBe(0.15)
  })
})

describe('floor variety', () => {
  const tiles = Array.from({ length: 4000 }, (_, i) => ({ tx: i % 64, ty: Math.floor(i / 64) }))
  const slab = (tx: number, ty: number) => Array.from({ length: 64 }, (_, i) => TERRAIN.floor(tx * 8 + (i % 8), ty * 8 + Math.floor(i / 8)))

  test('about one floor tile in twenty is a cracked slab: a dark line across its middle', async () => {
    const cracked = tiles.filter(t => isCracked(t.tx, t.ty))
    expect(cracked.length / tiles.length).toBeGreaterThan(0.03)
    expect(cracked.length / tiles.length).toBeLessThan(0.07)
    const t = cracked[0]!
    const px = slab(t.tx, t.ty)
    for (const [x, y] of CRACK) expect(px[y * 8 + x]).toBe(CRACK_INK)
    // A plain slab has no crack: its middle (inside its lit and shaded edges) never takes the crack's ink.
    const plain = tiles.find(u => !isCracked(u.tx, u.ty))!
    expect(slab(plain.tx, plain.ty).filter((p, i) => i % 8 > 0 && i % 8 < 7 && i >= 8 && i < 56 && p === CRACK_INK)).toEqual([])
  })
})

describe('the town\'s art', () => {
  test('has no dark outline round it: no K pixel of a town sprite borders the ground beside it', async () => {
    const outer: string[] = []
    for (const [name, table] of Object.entries({ NPC_ART, TOWN_THING_ART, TOWN_DECOR_ART, TOWN_BIG_ART })) {
      for (const [key, rows] of Object.entries(table as Record<string, readonly string[]>)) rows.forEach((row, y) => [...row].forEach((k, x) => {
        const isBeside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => [undefined, '.'].includes(rows[y + dy!]?.[x + dx!]))
        if (k === 'K' && isBeside) outer.push(`${name}.${key} ${x},${y}`)
      }))
    }
    expect(outer).toEqual([])
  })
})
