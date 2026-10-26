import type { Foe, Game, HeroClass, Talent } from '../types'
import type { Theme } from './map'

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
  // The Rotking: a kobold under a red toadstool cap spotted white, in a rotting robe, two spores drifting off it.
  rot: ['.KrrrrK.', 'KrorrorK', 'KrrrrrrK', '.KffffK.', 'vfkffkf.', '.KfPPfKv', '.KPPPPK.', '.f.KK.f.'],
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
  // Chests, one silhouette whatever they are made of: wooden (a brass knob), iron-bound (steel corners, edges, band and
  // knob), gilded (gold trim and band, a gem for the knob); then each opened, its lid up, its inside dark, its knob kept.
  // Each theme's thing to gather, with what lies round it: a warding stone and its rune over bones, reeds in a pool,
  // glowing caps and their spores, rime crystals on rock, a powder keg with its fuse lit and powder spilt.
  U: ['...c....', '.KKKKKK.', '.KeccEK.', '.KeEceK.', '.KecceK.', '.KEeceK.', 'oKeeEEKO', 'OoOKKoOo'],
  V: ['.N....N.', '.n..N.n.', '.l..n.lL', '.lL.l.l.', 'l.lLlLl.', 'bClLlLCb', 'BbCbbCbB', '.BBBBBB.'],
  P: ['..pppp..', '.pFZFpp.', 'pFpFFpFp', '.KKooKK.', '...oo..c', '.c.oo.vF', '..MooM.o', '.MMMMMMM'],
  X: ['...Z....', '..cZ..c.', '..cC.cZ.', '.cCZcCc.', '.cCZcCcc', 'cCcZCcCc', 'EKCcCcKE', '.EEEEEE.'],
  K: ['.....Zi.', '....Ei..', '..KKKK..', '.KDnDnK.', '.KwWwWK.', '.KnDnDK.', '.KwWwWK.', '.EKKKKEE'],
  C: ['........', '........', '.KKKKKK.', 'KDDDDDDK', 'KnnnnnnK', 'KWWyyWWK', 'KnNnnNnK', 'KKKKKKKK'],
  H: ['........', '........', '.KKKKKK.', 'KwDDDDwK', 'KWWWWWWK', 'KWnwwnWK', 'KwNnnNwK', 'KKKKKKKK'],
  G: ['........', '........', '.KKKKKK.', 'KYDDDDYK', 'KyyyyyyK', 'KYnZZnYK', 'KYNnnNYK', 'KKKKKKKK'],
  c: ['........', '.KKKKKK.', 'KDDDDDDK', 'KKKKKKKK', 'KkkkkkkK', 'KWWyyWWK', 'KnNnnNnK', 'KKKKKKKK'],
  h: ['........', '.KKKKKK.', 'KwDDDDwK', 'KKKKKKKK', 'KkkkkkkK', 'KWWwwWWK', 'KwNnnNwK', 'KKKKKKKK'],
  j: ['........', '.KKKKKK.', 'KYDDDDYK', 'KKKKKKKK', 'KkkkkkkK', 'KyyZZyyK', 'KYNnnNYK', 'KKKKKKKK'],
  // An item left on the floor when the bag was full: a sack tied with gold.
  '*': [
    '........',
    '...KK...',
    '..KyYK..',
    '..KnnK..',
    '.KnDnnK.',
    'KnDnnnNK',
    'KnnnnNNK',
    '.KKKKKK.',
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

/** A hash of a pixel in [0, 1), finer than `pixelHash`'s hundredths, for accents rarer than one pixel in a hundred. */
const groundHash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
type Tex = (x: number, y: number) => string

// CRYPT. Floor: irregular flagstones. Wall: ashlar blocks 7 by 3, lit along the top, one in five worn darker.
const cryptFloor: Tex = (x, y) => {
  // Irregular flagstones: each tile two or three slabs, their seams jogged per tile so no grout runs straight through.
  const tx = Math.floor(x / PX)
  const ty = Math.floor(y / PX)
  const lx = x % PX
  const ly = y % PX
  const cut = 3 + Math.floor(groundHash(tx, ty) * 3)
  const isRow = groundHash(ty, tx) < 0.5
  const across = isRow ? ly : lx
  const along = isRow ? lx : ly
  const jog = 2 + Math.floor(groundHash(tx * 3, ty * 5) * 4)
  const grout = lx === PX - 1 || ly === PX - 1 || across === cut || (across > cut && along === jog)
  if (grout) return '#3c3329'
  const slab = across < cut ? 0 : along < jog ? 1 : 2
  const lit = lx === 0 || ly === 0 || across === cut + 1 || (across > cut && along === jog + 1)
  if (lit) return '#675a48'
  const tone = groundHash(tx * 3 + slab, ty * 5 + slab)
  const base = tone < 0.4 ? '#584c3d' : tone < 0.8 ? '#5c4f40' : '#54483a'
  return groundHash(x, y) < 0.05 ? '#4e4436' : base
}
const cryptWall: Tex = (x, y) => {
  const course = Math.floor(y / 4)
  const off = course % 2 === 0 ? 0 : 4
  const bx = (x + off) % PX
  if (y % 4 === 3 || bx === PX - 1) return '#241e1a'
  if (y % 4 === 0) return bx === 0 ? '#9a9088' : '#8a8078'
  const worn = groundHash(Math.floor((x + off) / PX), course) < 0.2
  return bx === PX - 2 ? '#5e564e' : worn ? '#665d55' : '#736a62'
}

// FLOODED HALLS. Floor: worn rounded slabs, green-grey, with puddles that catch a glint. Wall: mossy stone, moss on the
// top of each course and drips down the face.
const PUDDLE = ['........', '..##....', '.####...', '.#####..', '..####..', '...##...', '........', '........']
/** A shallow puddle's pixel in one tile in seven, mirrored in half of them: dark water, a single glint; else undefined. */
const puddle = (tx: number, ty: number, lx: number, ly: number) => {
  if (groundHash(tx, ty * 7) >= 0.14) return undefined
  const flip = groundHash(ty, tx) < 0.5
  if (PUDDLE[ly]?.[flip ? PX - 1 - lx : lx] !== '#') return undefined
  if (lx === (flip ? 5 : 2) && ly === 2) return '#9fd8d0'
  return ly <= 2 ? '#2c4a46' : '#22403e'
}
const floodFloor: Tex = (x, y) => {
  // Worn slabs, their corners rounded off; one tile in seven holds a shallow puddle.
  const tx = Math.floor(x / PX)
  const ty = Math.floor(y / PX)
  const lx = x % PX
  const ly = y % PX
  const corner = (lx === 0 || lx === PX - 1) && (ly === 0 || ly === PX - 1)
  if (corner || lx === PX - 1 || ly === PX - 1) return '#1e2a26'
  const water = puddle(tx, ty, lx, ly)
  if (water !== undefined) return water
  if (lx === 0 || ly === 0) return '#56685c'
  return groundHash(x, y) < 0.1 ? '#3a4a40' : groundHash(tx, ty) < 0.5 ? '#44564a' : '#405248'
}
const floodWall: Tex = (x, y) => {
  const course = Math.floor(y / 4)
  const off = course % 2 === 0 ? 0 : 3
  const bx = (x + off) % 6
  if (y % 4 === 3 || bx === 5) return '#16201c'
  const drip = groundHash(x, course) < 0.18 && y % 4 <= 2
  if (y % 4 === 0) return groundHash(x * 3, course) < 0.6 ? '#5a9a42' : '#7a8a76'
  if (drip) return '#3c6a2e'
  return y % 4 === 1 ? '#6a7a68' : '#5e7060'
}

// FUNGAL DEEP. Floor: soft packed earth, no grout, pale mycelium threads and a rare glowing spore. Wall: rounded porous
// rock lumps, a glowing cap now and then.
const fungalFloor: Tex = (x, y) => {
  const n = groundHash(Math.floor(x / 2), Math.floor(y / 2))
  const thread = (groundHash(Math.floor((x + y) / 3), Math.floor((x - y + 64) / 5)) < 0.08) && groundHash(x, y) < 0.6
  if (thread) return '#7a6a88'
  if (groundHash(x * 7, y * 3) < 0.0025) return '#7fe3ff'
  return n < 0.3 ? '#3a2c40' : n < 0.75 ? '#42324a' : '#4a3a52'
}
const fungalWall: Tex = (x, y) => {
  const cx = Math.floor(x / 4)
  const cy = Math.floor(y / 4)
  const lx = x % 4
  const ly = y % 4
  const lump = groundHash(cx, cy)
  if ((lx === 0 && ly === 0) || (lx === 3 && ly === 3)) return '#1c1420'
  if (ly === 0 || lx === 0) return lump < 0.5 ? '#7a6488' : '#6e5a7c'
  if (lump > 0.93 && lx === 2 && ly === 1) return '#ff6ad5'
  if (lump > 0.93 && ly === 2 && lx >= 1 && lx <= 2) return '#e8e2d0'
  if (groundHash(x, y) < 0.12) return '#3e3048'
  return lx === 3 || ly === 3 ? '#4a3a58' : '#5a4868'
}

// FROZEN CAVERNS. Floor: ice sheets, diagonal facet lines in ice glow that run across tiles, a snow dimple here and
// there. Wall: rough grey-blue rock, snow on the top of each lump, an icicle hanging.
const frozenFloor: Tex = (x, y) => {
  // Dark sheet ice: long diagonal facet lines, a glow line over its shadow, running across tiles; frost specks sparse.
  const facet = (x + 2 * y) % 19
  const run = groundHash(Math.floor((x + 2 * y) / 19), Math.floor((2 * x - y + 200) / 23)) < 0.55
  if (run && facet === 0) return '#7aa8c8'
  if (run && facet === 1) return '#243a52'
  if (groundHash(x, y) < 0.012) return '#c8e4f4'
  const n = groundHash(Math.floor(x / 4), Math.floor(y / 4))
  return n < 0.4 ? '#324a64' : n < 0.8 ? '#36506c' : '#2e445c'
}
const frozenWall: Tex = (x, y) => {
  // Rough blue-grey rock in lumps; snow lies only on a lump's top, unevenly; now and then an icicle hangs from it.
  const cx = Math.floor(x / 4)
  const cy = Math.floor(y / 4)
  const lx = x % 4
  const ly = y % 4
  const snow = groundHash(cx, cy) < 0.65
  if (ly === 0 && snow && (lx < 3 || groundHash(x, cy) < 0.5)) return lx === 0 ? '#a8bccc' : '#d8e6f0'
  if (ly === 3 || lx === 3) return '#18222e'
  if (lx === 1 && groundHash(cx, cy * 3) < 0.22 && ly <= 2) return '#9ad0f0'
  return groundHash(x, y) < 0.15 ? '#3a4858' : ly === 0 ? '#5a6a7c' : '#485a6c'
}

// FORGE. Floor: dark iron plates, a bevel lit top-left and rivets at the corners; now and then a cracked plate with an
// ember glow in the crack. Wall: near-black basalt blocks, a red rim of heat at the foot of each course.
const forgeFloor: Tex = (x, y) => {
  const tx = Math.floor(x / PX)
  const ty = Math.floor(y / PX)
  const lx = x % PX
  const ly = y % PX
  if (lx === PX - 1 || ly === PX - 1) return '#120e0e'
  if ((lx === 1 || lx === PX - 2) && (ly === 1 || ly === PX - 2)) return lx === 1 && ly === 1 ? '#8a7a70' : '#5a4e48'
  if (lx === 0 || ly === 0) return '#4a403c'
  const cracked = groundHash(tx * 5, ty * 3) < 0.15
  if (cracked && (lx === ly || lx === ly + 1) && lx >= 2 && lx <= 5) return lx === 3 ? '#ffd34d' : '#ff6a1a'
  return groundHash(x, y) < 0.07 ? '#2e2624' : '#362e2c'
}
const forgeWall: Tex = (x, y) => {
  const course = Math.floor(y / 4)
  const off = course % 2 === 0 ? 0 : 4
  const bx = (x + off) % PX
  if (y % 4 === 3) return '#5a1810'
  if (bx === PX - 1) return '#0c0a0a'
  if (y % 4 === 0) return '#3a302c'
  return groundHash(x, y) < 0.1 ? '#161212' : '#1e1818'
}

/**
 * Each theme's floor and wall by world pixel, in its own colors and its own shapes: the crypt's flagstones (a slab in
 * twenty cracked) and ashlar, the flooded halls' worn slabs and mossy stone, the fungal deep's packed earth and porous
 * lumps, the frozen caverns' sheet ice and snowy rock, the forge's iron plates and basalt.
 */
export const GROUND: Readonly<Record<Theme, Readonly<Record<'floor' | 'wall', Tex>>>> = {
  crypt: { floor: (x, y) => (isCracked(Math.floor(x / PX), Math.floor(y / PX)) && CRACK.some(([cx, cy]) => cx === x % PX && cy === y % PX) ? CRACK_INK : cryptFloor(x, y)), wall: cryptWall },
  flooded: { floor: floodFloor, wall: floodWall },
  fungal: { floor: fungalFloor, wall: fungalWall },
  frozen: { floor: frozenFloor, wall: frozenWall },
  forge: { floor: forgeFloor, wall: forgeWall },
}

/** A pillar's stone, by its column of the tile: lit from the left, in shade on the right. */
const SHAFT = ['', '', '#a89e94', '#8a8078', '#7a7068', '#5a524a', '', ''] as const

/** A pillar's own pixel by world pixel, its capital, shaft and base; undefined where the floor shows round it. */
export const pillarShaft = (x: number, y: number): string | undefined => {
  const lx = x % PX
  const ly = y % PX
  if (ly === 0 && lx >= 1 && lx <= 6) return lx === 1 ? '#5a524a' : '#9a9088'
  if (ly === PX - 1 && lx >= 1 && lx <= 6) return MORTAR
  if (ly === PX - 2 && lx >= 1 && lx <= 6) return lx === 6 ? '#3e3830' : '#6a6058'
  const shaft = SHAFT[lx]
  return shaft === undefined || shaft === '' ? undefined : shaft
}

/** Ground textures by world pixel, so neighbouring tiles join without seams; floor and wall are the crypt's (`GROUND`). */
export const TERRAIN: Readonly<Record<'floor' | 'passage' | 'wall' | 'door' | 'stairs' | 'pillar', (x: number, y: number) => string>> = {
  floor: (x, y) => GROUND.crypt.floor(x, y),
  // A column standing on the floor slab, its capital on top and its base below: rock in a room, not a wall.
  pillar: (x, y) => pillarShaft(x, y) ?? GROUND.crypt.floor(x, y),
  passage: (x, y) => {
    const n = pixelHash(x, y)
    return n < 0.12 ? '#2a241e' : n > 0.92 ? '#4a4034' : '#3a3228'
  },
  wall: (x, y) => GROUND.crypt.wall(x, y),
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

/**
 * Each talent's icon, 12 by 12, drawn at twice its size on its card: a tick, a shield, a rocket, a duck; a winged
 * heart, a blade, a drop of blood, a cracked skull; a bottle, a flask, a coin, a compass.
 */
export const TALENT_ICON: Readonly<Record<Talent, readonly string[]>> = {
  testDriven: ['............', '.........KK.', '........KgK.', '.......KgGK.', '.KK...KgGK..', 'KgGK.KgGK...', 'KGggKgGK....', '.KGgggK.....', '..KGgK......', '...KK.......', '............', '............'],
  cleanCommit: ['..KKKKKKKK..', '.KwwwwwwwWK.', '.KwZwwwwwWK.', '.KwwwccwwWK.', '.KwwcccwwWK.', '.KwwwccwwWK.', '.KwwwwwwwWK.', '..KwwwwwWK..', '...KwwwWK...', '....KwWK....', '.....KK.....', '............'],
  shipIt: ['.....KK.....', '....KwwK....', '...KwZwWK...', '...KwccWK...', '...KwccWK...', '...KwwwWK...', '..KKwwwWKK..', '.KrKwwwWKrK.', '.KKKKKKKKKK.', '....KiIK....', '.....iI.....', '.....I......'],
  rubberDucking: ['............', '....KKKK....', '...KyyyyK...', '...KyykyKKK.', '...KyyyyiiIK', '..KKyyyyKKK.', '.KyyyyyyyK..', 'KyZyyyyyyyK.', 'KyyyyyyyYyK.', '.KYyyyyyYK..', '..KKKKKKK...', '............'],
  secondWind: ['............', 'Kh.KK.KK.hK.', 'KhKrrKrrKhK.', '.KrZrrrrrK..', '.KrrrrrrRK..', '..KrrrrRK...', '...KrrRK....', '....KRK.....', '.....K......', '............', '............', '............'],
  opener: ['..........KK', '.........KwK', '........KwWK', '.......KwWK.', '......KwWK..', '.....KwWK...', '..KK.KwK....', '..KyKKK.....', '...KyK......', '..KnKyK.....', '.KnK.KK.....', '.KK.........'],
  bloodletting: ['.....KK.....', '.....KrK....', '....KrrK....', '....KrrrK...', '...KrZrrK...', '...KrZrrrK..', '..KrrrrrRK..', '..KrrrrrRK..', '..KRrrrRRK..', '...KRRRRK...', '....KKKK....', '............'],
  grudge: ['...KKKKKK...', '..KooooooK..', '.KoooooooOK.', '.KoKKoKKoOK.', '.KoKrKoKrOK.', '.KooooKoooK.', '..KooKKooK..', '..KoOoOoOK..', '...KoKoKK...', '...KKKKK....', '............', '............'],
  scavenger: ['....KKKK....', '....KnnK....', '....KKKK....', '...KvvvvK...', '..KvZvvvvK..', '..KvvvvvvK..', '..KvvvvvvK..', '..KvvvvvvK..', '...KvvvvK...', '....KKKK....', '............', '............'],
  ironStomach: ['...KKKKKK...', '...KeEEeK...', '....KeeK....', '...KeeeeK...', '..KeEeeeEK..', '.KeEgggggEK.', '.KegZggggeK.', '.KeggggggeK.', '.KeEggggEeK.', '..KeEEEEeK..', '...KKKKKK...', '............'],
  haggler: ['....KKKK....', '..KKyyyyKK..', '.KyyZYYYyyK.', '.KyYyyyyYyK.', 'KyYyKKKKyYyK', 'KyYyKyyyyYyK', 'KyYyyKKyyYyK', 'KyYyyyyKyYyK', '.KyYKKKKYyK.', '.KyyYYYYyyK.', '..KKyyyyKK..', '....KKKK....'],
  pathfinder: ['....KKKK....', '..KKnnnnKK..', '.KnNwwwwNnK.', '.KnwwwrwwnK.', 'KnwwwrrwwwnK', 'KnwwwwKwwwnK', 'KnwwwKwwwwnK', 'KnwwbbwwwwnK', '.Knwwbwwwwn.', '.KnNwwwwNnK.', '..KKnnnnKK..', '....KKKK....'],
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
  ',': ['...', '...', '...', '.#.', '#..'],
  '!': ['#', '#', '#', '.', '#'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'],
  ' ': ['.', '.', '.', '.', '.'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  L: ['#..', '#..', '#..', '#..', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  // Capitals for the windows' titles, tabs and button keys.
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
