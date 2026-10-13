import type { Foe, Game, HeroClass } from '../types'

/** Pixels per tile edge: a tile is PX columns by PX / 2 rows of half-block cells, square on screen. */
export const PX = 8

/** The colors sprites are drawn in, one key per pixel; '.' is transparent. */
export const PAL: Readonly<Record<string, string>> = {
  K: '#1a1420', // outline
  k: '#000000', // eyes, visor slit
  w: '#d5d9df', // steel
  W: '#8a919c', // steel shade
  s: '#f0c8a0', // skin
  b: '#3a6fc4', // tunic
  B: '#2a4d8f', // tunic shade
  y: '#ffd34d', // gold, hilt, eyes
  n: '#8a5a2b', // leather
  N: '#5b3a1f', // dark leather
  g: '#6abe30', // goblin
  G: '#3f7d2a', // goblin shade, orc
  r: '#d9443a', // red
  R: '#8a1f1f', // dark red
  o: '#e8e2d0', // bone
  O: '#a8a090', // bone shade
  P: '#4a3070', // wraith robe
  p: '#8c6cc8', // wraith robe light
  c: '#7fe3ff', // glow
  e: '#9a9a9a', // grey
  E: '#5a5a5a', // dark grey
  f: '#ff9a6a', // tail, kobold scales
  t: '#7a9a6a', // troll skin
  m: '#556b4a', // troll body
  M: '#3a4a33', // troll shade
  u: '#c87f4a', // rust
  v: '#ff6ad5', // potion
  Y: '#b8860b', // gold shade
  Z: '#ffffff', // sparkle
  h: '#ece6da', // white cloth
  H: '#b4ac9e', // white cloth shade
  a: '#7a3e8f', // merchant robe
  A: '#52286a', // merchant robe shade
  l: '#3f7d2a', // leaves
  L: '#2a5a1f', // leaves shade
  i: '#ffb43a', // flame
  I: '#ff6a1a', // flame core
  q: '#5a5f6b', // steel deep shadow
  S: '#d09c78', // skin shade
  j: '#b0602e', // kobold scales shade
  d: '#7a1a1a', // dragon red deep
  x: '#3a2450', // wraith robe deep
  C: '#5a8ae0', // tunic light
  D: '#b07a44', // leather light
  F: '#a88ae0', // robe light
}

/** The plain body every hero wears under their gear: shirt and trousers. */
const HERO_BASE: readonly string[] = [
  '........',
  '........',
  '........',
  '........',
  '.KhhhhK.',
  '.shhhhs.',
  '..nnnN..',
  '..n..N..',
]

type HeroLayers = Readonly<Record<'armor' | 'bare' | 'gear' | 'weapon' | 'offhand', readonly string[]>>

/** Each class in layers: armor, the head bare and in its headgear, the weapon in the right hand, the off-hand piece in the left. */
export const HERO_LAYERS: Readonly<Record<HeroClass, HeroLayers>> = {
  knight: {
    armor: [
      '........',
      '........',
      '........',
      '........',
      '.KbbbbK.',
      '..bbyB..',
      '..BBBB..',
      '........',
    ],
    bare: [
      '........',
      '..nnnnN.',
      '..nsssN.',
      '..skskS.',
      '...sSs..',
      '........',
      '........',
      '........',
    ],
    gear: [
      '....rR..',
      '..KwwwK.',
      '..WkkkW.',
      '..skskS.',
      '...sSs..',
      '........',
      '........',
      '........',
    ],
    weapon: [
      '........',
      '........',
      '.......w',
      '.......w',
      '.......s',
      '........',
      '........',
      '........',
    ],
    offhand: [
      '........',
      '........',
      '........',
      '........',
      'rK......',
      'RK......',
      '........',
      '........',
    ],
  },
  mage: {
    armor: [
      '........',
      '........',
      '........',
      '........',
      '.KPPPPK.',
      '.sPPcPs.',
      '.KPPPPK.',
      '..PPPP..',
    ],
    bare: [
      '........',
      '..OOOOO.',
      '.OsssssO',
      '.Oskskso',
      '..sssS..',
      '........',
      '........',
      '........',
    ],
    gear: [
      '....PK..',
      '...PpPK.',
      '..PPPPPK',
      '..skskS.',
      '...sSs..',
      '........',
      '........',
      '........',
    ],
    weapon: [
      '........',
      '.......c',
      '.......n',
      '.......n',
      '.......n',
      '......sn',
      '.......n',
      '.......n',
    ],
    offhand: [
      '........',
      '........',
      '........',
      '........',
      '........',
      'Kn......',
      'yn......',
      '........',
    ],
  },
  rogue: {
    armor: [
      '........',
      '........',
      '........',
      '........',
      '.KNnnNK.',
      '.sNNyNs.',
      '..NnnN..',
      '..E..E..',
    ],
    bare: [
      '........',
      '..EEEEE.',
      '..EsssE.',
      '..skskS.',
      '...sSs..',
      '........',
      '........',
      '........',
    ],
    gear: [
      '...EEE..',
      '..EEEEE.',
      '.EEsssEE',
      '.EskskSE',
      '..EsSsE.',
      '........',
      '........',
      '........',
    ],
    weapon: [
      '........',
      '........',
      '........',
      '.......w',
      '.......w',
      '......s.',
      '........',
      '........',
    ],
    offhand: [
      '........',
      '........',
      '........',
      'w.......',
      'w.......',
      '........',
      '........',
      '........',
    ],
  },
}

/** Stacks layers into one sprite: a later layer's colors over an earlier one's, '.' leaving what is under it. */
export const stackLayers = (layers: readonly (readonly string[])[]): string[] =>
  Array.from({ length: PX }, (_, y) => Array.from({ length: PX }, (_, x) => {
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      const k = layers[i]?.[y]?.[x]
      if (k !== undefined && k !== '.') return k
    }
    return '.'
  }).join(''))

/** Each look stacked once: by class and which of the four slots hold something. */
const heroLooks = new Map<string, readonly string[]>()

/** The hero as geared: the plain body, then each layer whose slot holds something; the bare head while no helm is worn. */
export const heroArt = (g: Pick<Game, 'gear'> & Partial<Pick<Game, 'cls'>>): readonly string[] => {
  const cls = g.cls ?? 'knight'
  const key = `${cls}:${['armor', 'helm', 'weapon', 'offhand'].map(s => (g.gear[s as keyof typeof g.gear] !== undefined ? 1 : 0)).join('')}`
  const known = heroLooks.get(key)
  if (known !== undefined) return known
  const l = HERO_LAYERS[cls]
  const look = stackLayers([
    HERO_BASE,
    ...(g.gear.armor !== undefined ? [l.armor] : []),
    g.gear.helm !== undefined ? l.gear : l.bare,
    ...(g.gear.weapon !== undefined ? [l.weapon] : []),
    ...(g.gear.offhand !== undefined ? [l.offhand] : []),
  ])
  heroLooks.set(key, look)
  return look
}

export const MONSTER_ART: Readonly<Record<string, readonly string[]>> = {
  r: [
    '........',
    '........',
    '........',
    '.ff.....',
    'KeeKKKK.',
    'ekeeeeeK',
    '.KeEEEKf',
    '..f..f.f',
  ],
  g: [
    '........',
    'g.KKKK.g',
    'gKggggKg',
    '.KyggyK.',
    '..KGGK..',
    '.KnnnnKe',
    '.gKnnKge',
    '..g..g..',
  ],
  k: [
    '......w.',
    '..KffKe.',
    '.Kfkffe.',
    '..KjfKe.',
    '.KnnnfK.',
    'f.nNnj..',
    'ff.f.f..',
    '...j.j..',
  ],
  o: [
    '.o.KK.o.',
    '.KGGGGK.',
    '.GrGGrG.',
    '.KoGGoK.',
    'WKnnnnKW',
    'GKnyynKG',
    '.KGG.GG.',
    '.NN..NN.',
  ],
  s: [
    '..KKKK..',
    '.KooooK.',
    '.KkooKkK',
    '..KoOK..',
    '.KoKoKK.',
    'oKoooOKW',
    '..KoOK.W',
    '.Ko..oK.',
  ],
  T: [
    '..KKK...',
    '.KtkttK.',
    '.KtoomK.',
    'KttmmmKn',
    'tKmmmmKn',
    'tKmmmMKn',
    '.KmM.MKK',
    '.MM..MM.',
  ],
  W: [
    '..KKKK..',
    '.KPPPPK.',
    '.KcPPcK.',
    'pPPpppPp',
    '.KPpppPK',
    '..KPpPK.',
    '...KxK..',
    '....K...',
  ],
  D: [
    'r......r',
    'rr.KKK.r',
    '.rRrkrRr',
    '..KryrK.',
    '.KryyrRK',
    'KrryyrRK',
    '.Kr.rRK.',
    '.r...r..',
  ],
}

/** A theme's take on a monster: its art with some palette keys swapped, key for key. The crypt keeps the originals. */
export const MONSTER_VARIANT: Readonly<Record<'flooded' | 'fungal' | 'frozen' | 'forge', Readonly<Record<string, Readonly<Record<string, string>>>>>> = {
  flooded: {
    r: { e: 't', E: 'm' },
    g: { g: 't', G: 'm', n: 'C' },
    k: { j: 'C', n: 'm', N: 'M' },
    o: { G: 'm', n: 'C', r: 'c' },
    s: { o: 'c', O: 'C' },
    T: { t: 'l', m: 'L', n: 'C' },
    W: { P: 'B', p: 'C', x: 'B' },
    D: { r: 'C', R: 'B', y: 'c' },
  },
  fungal: {
    r: { e: 'p', E: 'P', f: 'v' },
    g: { g: 'p', G: 'P', n: 'x' },
    k: { f: 'v', j: 'P', n: 'x', N: 'x' },
    o: { G: 'p', n: 'P', r: 'v' },
    s: { o: 'h', O: 'g', W: 'v' },
    T: { t: 'v', m: 'p', M: 'P' },
    W: { P: 'G', p: 'g', x: 'M', c: 'v' },
    D: { r: 'p', R: 'P', y: 'v' },
  },
  frozen: {
    r: { e: 'w', E: 'W', f: 'c' },
    g: { g: 'C', G: 'B', n: 'W' },
    k: { f: 'c', j: 'C', n: 'W', N: 'q' },
    o: { G: 'C', n: 'W', r: 'c' },
    s: { o: 'w', O: 'C', W: 'c' },
    T: { t: 'w', m: 'C', M: 'B', n: 'W' },
    W: { P: 'C', p: 'Z', x: 'B', c: 'w' },
    D: { r: 'c', R: 'C', y: 'Z' },
  },
  forge: {
    r: { e: 'u', E: 'R', f: 'i' },
    g: { g: 'I', G: 'd' },
    k: { j: 'd', n: 'R' },
    o: { G: 'q', n: 'E' },
    s: { o: 'e', O: 'E', W: 'i' },
    T: { t: 'f', m: 'u', M: 'R', o: 'i' },
    W: { P: 'R', p: 'I', x: 'd', c: 'i' },
    D: { r: 'i', R: 'I' },
  },
}

/** The named foes, each drawn as its own, its silhouette its own: Old Bones cloaked with a bone club, Mother Mire under
 * her moss, the Rotking under his toadstool cap, Rimehide in his ice mantle, Emberjaw horned with its jaw aglow. */
export const UNIQUE_ART: Readonly<Record<'bones' | 'mire' | 'rot' | 'rime' | 'ember', readonly string[]>> = {
  bones: ['..KKKK.o', '.KooooKo', '.KkooKko', 'PPKoOKPo', 'PKoKoKPW', 'PPoooOP.', '.PKoOKP.', '.Ko..oK.'],
  mire: ['..lLlL..', '.lLlLlL.', 'lLKkKkLl', 'lKtoomKl', 'LKmmmmKL', 'lKmMmMKl', 'L.KmMK.L', '.MM..MM.'],
  // The Rotking: a kobold under a toadstool cap, spores drifting off it.
  rot: ['.vPPPPv.', 'vPvPPvPv', '..KxxK..', '.Kvkvve.', '..KxxKe.', '.KxPxvK.', 'v.xPx...', '...P.P.v'],
  // Rimehide: an orc in a mantle of ice, icicle tusks, a frost axe.
  rime: ['.c.KK.c.', '.KCCCCKZ', '.CcCCcCZ', '.KZCCZKZ', 'cKWWWWKc', 'CKWccWKC', '.KCC.CC.', '.BB..BB.'],
  ember: ['I.I..I.I', '.II..II.', 'iRiKKiRi', 'iRiyykRi', '.KiIIiK.', '..KiyiK.', '.Ki..iK.', '.i....i.'],
}

/** The big bosses, 16 by 16, twice a foe each way: the Bone King crowned with his greatsword, the Drowned Queen in her
 * seaweed gown with her trident, the Hive Mother's swollen body, the Frost Lich robed with his staff, the Furnace Wyrm
 * reared with its molten belly. */
export const BOSS_ART: Readonly<Record<'king' | 'queen' | 'hive' | 'lich' | 'wyrm', readonly string[]>> = {
  king: [
    '....y..y..y.....',
    '....yyyyyyy.....',
    '...KoooooooK....',
    '..KooooooooOK...',
    '..KokkKooKkkK..w',
    '..KoooOKKOooK.wW',
    '...KoKoKoKoK.wW.',
    '.RRRKoooooKRRwW.',
    'RRRKoKoOoKoKRnR.',
    'RRKoKoOOOoKoKRR.',
    'RRKoKoOOOoKoKRR.',
    'RR.KKoOOOoKK.RR.',
    '.R..KoKKKoK..R..',
    '...KoK...KoK....',
    '..KoK.....KoK...',
    '.KOOK.....KOOK..',
  ],
  queen: [
    '....c.Z.Z.c.....',
    '....ccccccc.....',
    '...BBbbbbbBB....',
    '..BbBhhhhhBbB...',
    '..BbhkhhkhhbB..y',
    '.BbBhhhShhhBbB.y',
    '.Bb.BhhhhhB.bByy',
    'Bb..ggCCCgg..bBy',
    'B..gCCcCCCCg..Gy',
    '..gCCcCCcCCCg.y.',
    '..gGCCCCCCCGg.y.',
    '.gGgCCcCCCCgGgy.',
    '.gGCCCCCcCCCGg..',
    'gGgCCCCCCCCCgGg.',
    'gGCCCcCCCCcCCGg.',
    '.GGGGGGGGGGGGGG.',
  ],
  hive: [
    '.....v....v.....',
    '..pp..vKKv..pp..',
    '.pZpp.KvvK.ppZp.',
    '.ppppKvkkvKpppp.',
    '..pp.KvvvvK.pp..',
    '....KPPPPPPK....',
    '..KKPpPvPpPPKK..',
    '.K.KPPvPPvPPK.K.',
    'K..KpPPPPPPpK..K',
    '..KPPvPPPPvPPK..',
    '.K.KPPPvvPPPK.K.',
    'K..KPpPPPPpPK..K',
    '...KPPPvPPPPK...',
    '....KPPPPPPK....',
    '.....KPPPPK.....',
    '......KKKK......',
  ],
  lich: [
    '....c..c..c.....',
    '....ccZcZcc.....',
    '...KwwwwwwwK...Z',
    '...KwkcwwckK..cc',
    '...KwwwWWwwK..cc',
    '....KwKWKwK...n.',
    '..CCBBBBBBBCC.n.',
    '.CBBCBBBBBCBBCn.',
    'CBBBCBBBBBCBBBwn',
    'CBB.CBBCBBC.BBwn',
    'wB..CBBCBBC..B.n',
    '....CBBCBBC....n',
    '...CBBBCBBBC...n',
    '..CBBBBCBBBBC..n',
    '.CBBBBBCBBBBBC.n',
    '.BBBBBBBBBBBBBB.',
  ],
  wyrm: [
    '...I.I..........',
    '..IiKKiI........',
    '.KRRRRRRK.......',
    'KRRkRRRRRK..i...',
    'KRRRRRRRRRK.Ii..',
    '.KRRyyRRRRRKIi..',
    '..KyiyyRRRRRK...',
    '..IiIiyKRRRRRK..',
    '.iIIi..KRRyyRRK.',
    '..i...KRRyiiyRRK',
    '......KRRyiiyRRK',
    '.....KRRRyiiyRK.',
    '...KKRRRRyyyRK..',
    '..KRRRRRRRRRK...',
    '.KRRRRK.KRRRRK..',
    'KRRRK.....KRRRK.',
  ],
}

const variantArt = new Map<string, readonly string[]>()

/** A monster's art as the theme draws it: the theme's variant where it has one, else the original. */
export const monsterArt = (glyph: string, theme: string): readonly string[] | undefined => {
  const base = MONSTER_ART[glyph]
  const swap = (MONSTER_VARIANT as Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, string>>>>>>)[theme]?.[glyph]
  if (base === undefined || swap === undefined) return base
  const key = `${theme}:${glyph}`
  const known = variantArt.get(key)
  if (known !== undefined) return known
  const rows = base.map(row => [...row].map(k => swap[k] ?? k).join(''))
  variantArt.set(key, rows)
  return rows
}

export const UNKNOWN_ART: readonly string[] = [
  '..eeee..',
  '.e....e.',
  '......e.',
  '....ee..',
  '...e....',
  '........',
  '...e....',
  '........',
]

/** A foe's art on a theme's depth: a big boss or a named foe its own, else its kind as the theme draws it. */
export const foeArtOf = (foe: Pick<Foe, 'glyph' | 'unique' | 'big'>, theme: string): readonly string[] =>
  (foe.big !== undefined ? BOSS_ART[foe.big] : foe.unique !== undefined ? UNIQUE_ART[foe.unique] : monsterArt(foe.glyph, theme)) ?? UNKNOWN_ART

/** Things lying on the floor, drawn small so the floor shows around them. */
export const THING_ART: Readonly<Record<string, readonly string[]>> = {
  // The flooded halls' spring and its reeds; the forge's old anvil (the town's) and its embers.
  S: ['........', '..WWWW..', '.WbcbbW.', 'WbbcbcbW', 'WcbBbbcW', 'WbcbcBbW', '.WbBcbW.', '..WWWW..'],
  Q: ['........', '.G...G..', '.g..Gg..', '.gG.g..G', 'Gg.gg.Gg', '.gGg.gg.', '.Gg.gG..', '..gGGg..'],
  N: ['........', '........', '........', 'KKKKKKK.', 'KwwwwWWK', '.KKWWKK.', '..KEEK..', '.KEEEEK.'],
  F: ['........', '........', '...i....', '..iIi...', '.iIyIi..', '.rIIIrR.', 'KRrRrRK.', '.KKKKK..'],
  // The themed rooms: an altar, a brazier, a shelf of books, a lectern.
  A: [
    '........',
    '...yy...',
    '..KKKK..',
    '.KwwwwK.',
    '.KWWWWK.',
    '..KWWK..',
    '.KWWWWK.',
    'KKKKKKKK',
  ],
  B: [
    '...i....',
    '..iIi...',
    '.iIyIi..',
    'KKKKKKK.',
    '.KEEEK..',
    '..KEK...',
    '..KEK...',
    '.KKKKK..',
  ],
  L: [
    'KKKKKKKK',
    'KrbgnRbK',
    'KKKKKKKK',
    'KbnrgbrK',
    'KKKKKKKK',
    'KgrbnrgK',
    'KKKKKKKK',
    '........',
  ],
  R: [
    '........',
    '.KKKKKK.',
    '.KhhhhK.',
    '..KnnK..',
    '...KK...',
    '...nn...',
    '..KnnK..',
    '.KKKKKK.',
  ],
  // Chests: wooden, iron-bound, gilded; and any chest once opened.
  C: [
    '........',
    '........',
    '.KKKKKK.',
    'KDDDDDDK',
    'KnnnnnnK',
    'KWWyWWWK',
    'KnNnnNnK',
    'KKKKKKKK',
  ],
  H: [
    '........',
    '........',
    'KKKKKKKK',
    'KwWWWWwK',
    'KWNNNNWK',
    'KWWyyWWK',
    'KwNNNNwK',
    '.KK..KK.',
  ],
  G: [
    '........',
    '..KKKK..',
    '.KyZyyK.',
    'KYyyyyYK',
    'KnnyynnK',
    'KYyyyyYK',
    'KYyyyyYK',
    'KKKKKKKK',
  ],
  c: [
    '........',
    '.KKKKKK.',
    'KDDDDDDK',
    'KKKKKKKK',
    'KkkkkkkK',
    'KWWWWWWK',
    'KnNnnNnK',
    'KKKKKKKK',
  ],
  '$': [
    '........',
    '........',
    '...KK...',
    '..KyZK..',
    '.KyyyYK.',
    'KyZyyyYK',
    'KyyyYYYK',
    '.KKKKKK.',
  ],
  '!': [
    '........',
    '...KK...',
    '...nn...',
    '..KwwK..',
    '.KvZvvK.',
    '.KvvvRK.',
    '.KvvRRK.',
    '..KKKK..',
  ],
  '^': [
    '........',
    '........',
    '........',
    '........',
    'w..w..w.',
    'KwKKwKKw',
    'KEEEEEEK',
    'KKKKKKKK',
  ],
}

/** The crack across a cracked slab, by tile-local pixel: a short jagged line through its middle. */
export const CRACK: readonly (readonly [number, number])[] = [[2, 1], [3, 2], [3, 3], [4, 4], [5, 5], [5, 6]]
export const CRACK_INK = '#40362c'
/** About one floor slab in twenty is cracked: variety from a rare variant, not from more noise. */
export const isCracked = (tx: number, ty: number) => pixelHash(tx * 31 + 7, ty * 17 + 3) < 0.05

const pixelHash = (x: number, y: number) => {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177)
  h ^= h >>> 13
  return ((Math.imul(h, 1103515245) >>> 0) % 100) / 100
}

const MORTAR = '#1c1a20'

/** Ground textures by world pixel, so neighbouring tiles join without seams. */
export const TERRAIN: Readonly<Record<'floor' | 'passage' | 'wall' | 'door' | 'stairs', (x: number, y: number) => string>> = {
  floor: (x, y) => {
    const lx = x % PX
    const ly = y % PX
    const tx = Math.floor(x / PX)
    const ty = Math.floor(y / PX)
    if (lx === PX - 1 || ly === PX - 1) return '#40362c'
    if (lx === 0 || ly === 0) return '#6a5c49'
    if (isCracked(tx, ty) && CRACK.some(([cx, cy]) => cx === lx && cy === ly)) return CRACK_INK
    const stone = pixelHash(tx * 7, ty * 13)
    const base = stone < 0.33 ? '#574b3c' : stone < 0.66 ? '#5c5040' : '#615443'
    return pixelHash(x, y) < 0.08 ? '#51463a' : base
  },
  passage: (x, y) => {
    const n = pixelHash(x, y)
    return n < 0.12 ? '#2a241e' : n > 0.92 ? '#4a4034' : '#3a3228'
  },
  wall: (x, y) => {
    const course = Math.floor(y / 4)
    const offset = course % 2 === 0 ? 0 : 4
    if (y % 4 === 3 || (x + offset) % PX === PX - 1) return MORTAR
    if (y % 4 === 0) return '#8a8078'
    return '#6f665e'
  },
  door: (x, y) => {
    const lx = x % PX
    const ly = y % PX
    if (lx === 0 || lx === PX - 1 || ly === 0) return MORTAR
    if (ly === 2 || ly === 5) return '#3a3a40'
    if (lx === 5 && ly === 4) return '#ffd34d'
    return lx % 3 === 0 ? '#4a2f18' : '#6b4424'
  },
  stairs: (x, y) => {
    const lx = x % PX
    const ly = y % PX
    const step = Math.floor(ly / 2)
    const inset = step + 1
    if (lx < inset || lx >= PX - inset) return step === 0 ? '#3a3129' : '#1c1814'
    if (ly % 2 === 0) return ['#b0a08a', '#8a7c68', '#665a4a', '#463e34'][step] ?? '#463e34'
    return ['#7a6e60', '#5a5044', '#3e362c', '#241f1a'][step] ?? '#241f1a'
  },
}

/** The townsfolk, by role: those with work, and those who live there. */
export const NPC_ART: Readonly<Record<'merchant' | 'smith' | 'healer' | 'elder' | 'mystic' | 'guard' | 'villager' | 'dog', readonly string[]>> = {
  merchant: [
    '..nnnnN.',
    '.NNNNNNN',
    '..skskS.',
    '...sSs..',
    '.KAaaaAK',
    '.saAyaAs',
    '..AaaaA.',
    '..N..N..',
  ],
  smith: [
    'WW......',
    '.nKsss..',
    'nSksks..',
    'nsNNNN..',
    '.Knnnns.',
    '.Knnnns.',
    '..nNNn..',
    '..E..E..',
  ],
  healer: [
    '..hhhh.y',
    '.hhrrhhn',
    '.hskskhn',
    '..hsShhn',
    '.hhrrhhn',
    '.hrrrrhn',
    '.hHrrHhn',
    '..HH.HH.',
  ],
  elder: [
    '..OOOOO.',
    '..skskS.',
    '..ooooo.',
    '...ooo..',
    '.KnnonK.',
    '.snnnnKn',
    '..nnnN.n',
    '..N..N.n',
  ],
  mystic: [
    '...bbb..',
    '..bbbbB.',
    '..bkskB.',
    '..bbsbB.',
    '.bbKcKbB',
    '.sbcZcbs',
    '..bKcKB.',
    '..BBBBB.',
  ],
  guard: [
    '..WWW..w',
    '.WwwwW.w',
    '..skskSn',
    '.KrrrrKn',
    '.srryrsn',
    '..rrrR.n',
    '..eeee.n',
    '..E..E..',
  ],
  villager: [
    '........',
    '..nnnnN.',
    '..skskS.',
    '...sSs..',
    '..KgggK.',
    '..sgggs.',
    '...hhh..',
    '...n.n..',
  ],
  dog: [
    '........',
    '........',
    '........',
    '......nn',
    'n....nkn',
    'nnnnnnnN',
    '.nN.nN..',
    '.N...N..',
  ],
}

/** Things that stand in the town. */
export const TOWN_THING_ART: Readonly<Record<'stash' | 'portal', readonly string[]>> = {
  stash: [
    '........',
    '........',
    '.KKKKKK.',
    'KnnnnnnK',
    'KyyyyyyK',
    'KnnyYnnK',
    'KNNNNNNK',
    'KKKKKKKK',
  ],
  portal: [
    '..KKKK..',
    '.KbccbK.',
    'KbcbbcbK',
    'KcbZZbcK',
    'KcbZZbcK',
    'KbcbbcbK',
    '.KbccbK.',
    '..KKKK..',
  ],
}

/** The town's ground and buildings by world pixel, lit by day: grass and road, the shops' walls, roofs and counters, the smith's stone and forge floor, flower beds, the fountain's water, and the forest floor under the tree line. */
export const TOWN_TERRAIN: Readonly<Record<'grass' | 'road' | 'wall' | 'roof' | 'awning' | 'counter' | 'forest' | 'slate' | 'stone' | 'teal' | 'forge' | 'flowers' | 'water', (x: number, y: number) => string>> = {
  grass: (x, y) => {
    const n = pixelHash(x, y)
    if (n < 0.05) return '#7fbf4a'
    if (n > 0.93) return '#3f7a2a'
    return pixelHash(Math.floor(x / 3), Math.floor(y / 3)) < 0.5 ? '#5a9a38' : '#539232'
  },
  road: (x, y) => {
    const row = Math.floor(y / 4)
    const offset = row % 2 === 0 ? 0 : 3
    if (y % 4 === 3 || (x + offset) % 6 === 5) return '#8e8474'
    const n = pixelHash(Math.floor((x + offset) / 6), row)
    return n < 0.33 ? '#a89c86' : n < 0.66 ? '#ada18b' : '#a29680'
  },
  wall: (x, y) => {
    const lx = x % PX
    if (lx === 0 || lx === PX - 1) return '#4a2f18'
    if (y % PX === PX / 2) return '#4a2f18'
    return pixelHash(x, y) < 0.1 ? '#d8ccb4' : '#e4d8c0'
  },
  roof: (x, y) => {
    if (y % 3 === 2) return '#5a1f1a'
    return (x + Math.floor(y / 3) * 2) % 4 === 0 ? '#7a2a22' : '#9a3a2c'
  },
  awning: (x, y) => {
    if (y % PX >= PX - 2) return (x % 4 < 2 ? '#c8402a' : '#ece6da')
    return Math.floor(x / 4) % 2 === 0 ? '#c8402a' : '#ece6da'
  },
  counter: (x, y) => {
    const ly = y % PX
    if (ly === 0) return '#8a5a2b'
    if (ly === 1) return '#5b3a1f'
    return (x % PX) % 4 === 0 ? '#4a2f18' : '#6b4424'
  },
  forest: (x, y) => {
    const n = pixelHash(Math.floor(x / 2), Math.floor(y / 2))
    return n < 0.4 ? '#24401c' : n < 0.8 ? '#2a4a20' : '#315426'
  },
  slate: (x, y) => {
    if (y % 3 === 2) return '#2a2e38'
    return (x + Math.floor(y / 3) * 3) % 6 === 0 ? '#3a404e' : '#4c5466'
  },
  stone: (x, y) => {
    const course = Math.floor(y / 4)
    const offset = course % 2 === 0 ? 0 : 3
    if (y % 4 === 3 || (x + offset) % 6 === 5) return '#3a3632'
    return pixelHash(Math.floor((x + offset) / 6), course) < 0.5 ? '#7a746c' : '#6a645c'
  },
  teal: (x, y) => {
    if (y % 3 === 2) return '#1f4a4e'
    return (x + Math.floor(y / 3) * 2) % 4 === 0 ? '#2a6a70' : '#3a8a8e'
  },
  forge: (x, y) => {
    const n = pixelHash(x, y)
    return n < 0.1 ? '#3a3028' : n > 0.9 ? '#5a4a3a' : '#4a3e32'
  },
  flowers: (x, y) => {
    const n = pixelHash(x * 3, y * 5)
    if (n < 0.06) return '#ff6ad5'
    if (n < 0.11) return '#ffd34d'
    if (n < 0.14) return '#ece6da'
    return pixelHash(Math.floor(x / 3), Math.floor(y / 3)) < 0.5 ? '#5a9a38' : '#539232'
  },
  water: (x, y) => {
    const lx = x % PX
    const ly = y % PX
    const n = pixelHash(x, y)
    if (n > 0.94) return '#cfefff'
    return (lx + ly) % 7 === 0 ? '#5ab4e0' : '#3a8ac4'
  },
}

/** What stands about the town: lamps, crates and barrels, the smith's anvil, furnace and chimney, and the shop signs. */
export const TOWN_DECOR_ART: Readonly<Record<'lamp' | 'barrel' | 'crate' | 'anvil' | 'furnace' | 'chimney' | 'signCoin' | 'signCross' | 'signAnvil', readonly string[]>> = {
  lamp: [
    '..KKKK..',
    '..KiIK..',
    '..KiiK..',
    '...EE...',
    '...EK...',
    '...EK...',
    '..KEEK..',
    '.KKKKKK.',
  ],
  barrel: [
    '........',
    '..KKKK..',
    '.KnNnNK.',
    '.KEEEEK.',
    '.KnNnNK.',
    '.KEEEEK.',
    '.KnNnNK.',
    '..KKKK..',
  ],
  crate: [
    '........',
    '.KKKKKK.',
    '.KNnnNK.',
    '.KnNNnK.',
    '.KnNNnK.',
    '.KNnnNK.',
    '.KKKKKK.',
    '........',
  ],
  anvil: [
    '........',
    '........',
    '........',
    'KKKKKKK.',
    'KwwwwWWK',
    '.KKWWKK.',
    '..KEEK..',
    '.KEEEEK.',
  ],
  furnace: [
    'KKKKKKKK',
    'KeKKKKeK',
    'KEKRRKEK',
    'KeKiiKeK',
    'KEKIiKEK',
    'KeKKKKeK',
    'KEeEeEeK',
    'KKKKKKKK',
  ],
  chimney: [
    '.eOe....',
    'eOOOe...',
    '..eeOe..',
    '...KKKK.',
    '...KRuK.',
    '...KuRK.',
    '...KRuK.',
    '...KKKK.',
  ],
  signCoin: [
    '.K....K.',
    'KKKKKKKK',
    'KnnnnnnK',
    'KnyZyYnK',
    'KnyyYYnK',
    'KnnnnnnK',
    'KKKKKKKK',
    '........',
  ],
  signCross: [
    '.K....K.',
    'KKKKKKKK',
    'KhhrrhhK',
    'KhrrrrhK',
    'KhhrrhhK',
    'KHHHHHHK',
    'KKKKKKKK',
    '........',
  ],
  signAnvil: [
    '.K....K.',
    'KKKKKKKK',
    'KnnnnnnK',
    'KnwwwWnK',
    'KnnWWnnK',
    'KnWWWWnK',
    'KKKKKKKK',
    '........',
  ],
}

/** A second green for some trees, so a line of them does not look stamped. */
export const TREE_ALT: Readonly<Record<string, string>> = { l: '#5a8a2a', L: '#3a6020', g: '#8ab03a' }

/** Things two tiles across and two down, drawn from their top-left tile. */
export const TOWN_BIG_ART: Readonly<Record<'tree' | 'fountain', readonly string[]>> = {
  tree: [
    '.....KKKKKK.....',
    '...KKggggglKK...',
    '..KKggggglllKK..',
    '..KggggllllllK..',
    '.KgggglllllllLK.',
    '.KggglllllllLLK.',
    '.KgllllllllLLLK.',
    '.KlllllllLLLLLK.',
    '.KllllllLLLLLLK.',
    '.KKllllLLLLLLKK.',
    '..KllLLLLLLLLK..',
    '...KKLLLLLLKK...',
    '....KKKKKKKK....',
    '......KnNK......',
    '......KnNK......',
    '.....KKKKKK.....',
  ],
  fountain: [
    '................',
    '.....KKKKKK.....',
    '...KKwwwwwWKK...',
    '..KwwwKKKKWWWK..',
    '.KwwKbcbbbbKWWK.',
    '.KwKbcbbbbcbKWK.',
    '.wwKcbbwwcbbKqq.',
    'KwwcbbwZZwbbbqqK',
    'KwwbbbwZZwbbcqqK',
    '.wwKbbcwwbbcKqq.',
    '.KWKbcbbbbcbKqK.',
    '.KWWKbbbbcbKqqK.',
    '..KWWWKKKKqqqK..',
    '...KKWqqqqqKK...',
    '.....KKKKKK.....',
    '................',
  ],
}

const channels = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16))
const toHex = (c: readonly number[]) => `#${c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`

/** Torchlight on a pixel: ground fades with `light` (0 to 1) and warms near the torch; creatures never drop below 70%. */
export const lightPixel = (hex: string, light: number, isCreature: boolean) => {
  const [r = 0, g = 0, b = 0] = channels(hex)
  const k = isCreature ? Math.max(0.7, light) : light * 1.15
  return toHex([r * k + light * 30, g * k + light * 18, b * k])
}

/** The share of torchlight `d` tiles from the hero: full at the torch, a floor of 18% within sight. */
export const torch = (d: number) => {
  const t = Math.max(0, 1 - d / 6.5)
  return Math.max(0.15, t * t * (3 - 2 * t))
}

/** How much a creature's or item's drop shadow darkens the ground at a tile-local pixel; 1 is none. */
export const dropShadow = (lx: number, ly: number) => {
  if (ly === PX - 1 && lx >= 1 && lx <= PX - 2) return 0.45
  if (ly === PX - 2 && lx >= 2 && lx <= PX - 3) return 0.62
  return 1
}

/** How much a wall darkens the floor `px` pixels away from it; 1 is none. */
export const wallOcclusion = (px: number) => (px <= 0 ? 0.55 : px === 1 ? 0.75 : px === 2 ? 0.9 : 1)

/** A 3x5 pixel font for numbers that pop over characters; '#' is ink. */
export const FONT: Readonly<Record<string, readonly string[]>> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '-': ['...', '...', '###', '...', '...'],
  '!': ['#', '#', '#', '.', '#'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'],
  ' ': ['.', '.', '.', '.', '.'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  L: ['#..', '#..', '#..', '#..', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  // Capitals for the inventory's pixel labels.
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
}

export type PopupKind = 'damage' | 'hurt' | 'crit' | 'heal' | 'xp' | 'gold' | 'level'

/** What each number says by color; its sign or label says it again for anyone who cannot tell the colors apart. */
export const POPUP_INK: Readonly<Record<PopupKind, string>> = {
  damage: '#ffffff',
  hurt: '#ff5a4f',
  crit: '#ffd34d',
  heal: '#6adf6a',
  xp: '#7fe3ff',
  gold: '#ffd34d',
  level: '#ffd34d',
}

export const POPUP_OUTLINE = '#140c10'

/** Characters asked of the pixel font that it lacks (drawn as a space), for the assets audit. */
export const missingGlyphs = new Set<string>()

/** The text as rows of '#' and '.', glyphs a pixel apart; a character the font lacks is a space, and noted. */
export const textMask = (text: string): string[] => {
  const glyphs = [...text].map(ch => {
    if (FONT[ch] === undefined) missingGlyphs.add(ch)
    return FONT[ch] ?? FONT[' '] ?? []
  })
  return Array.from({ length: 5 }, (_, y) => glyphs.map(g => g[y] ?? '').join('.'))
}
