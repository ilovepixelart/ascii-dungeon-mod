import { describe, expect, test } from 'claude-code/testing'

import { PAL, THING_ART } from './pixelart'

/** Where the outline ink is: a chest's silhouette. */
const outline = (key: string) => THING_ART[key]!.map(row => [...row].map(ch => (ch === 'K' ? '#' : '.')).join(''))

describe('the chests', () => {
  test('every closed chest has one silhouette, and every opened one its own, so each reads as a chest whatever it is made of', async () => {
    expect(outline('H')).toEqual(outline('C'))
    expect(outline('G')).toEqual(outline('C'))
    expect(outline('h')).toEqual(outline('c'))
    expect(outline('j')).toEqual(outline('c'))
  })

  test('the kinds differ in what they are made of: none is drawn as another', async () => {
    expect(new Set(['C', 'H', 'G'].map(k => THING_ART[k]!.join())).size).toBe(3)
    expect(new Set(['c', 'h', 'j'].map(k => THING_ART[k]!.join())).size).toBe(3)
  })

  test('each make has its own knob, closed and opened: brass on wood, steel on iron, a gem on gilt', async () => {
    const knob = (key: string, row: number) => THING_ART[key]![row]!.slice(3, 5)
    expect([knob('C', 5), knob('H', 5), knob('G', 5)]).toEqual(['yy', 'ww', 'ZZ'])
    expect([knob('c', 5), knob('h', 5), knob('j', 5)]).toEqual(['yy', 'ww', 'ZZ'])
  })

  test('each is 8 by 8, every ink one the palette has', async () => {
    for (const key of ['C', 'H', 'G', 'c', 'h', 'j']) {
      const art = THING_ART[key]!
      expect([art.length, art.every(row => row.length === 8)]).toEqual([8, true])
      expect([...art.join('')].filter(ch => ch !== '.' && PAL[ch] === undefined)).toEqual([])
    }
  })
})
