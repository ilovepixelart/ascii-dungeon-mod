// The map is its own dark canvas, painted with fixed colors, so it reads the same under a light or a dark theme.

export const CANVAS = '#0b0b10'
export const MEMORY_BG = '#121626'
export const MEMORY_FG = '#3a4670'
export const WOOD_BG = '#4a2f18'
export const WOOD_FG = '#b0804a'

export const INK = {
  hero: '#fff4c8',
  foe: '#ff9485',
  sensed: '#d9a0ff',
  stairs: '#7fe3ff',
  gold: '#ffd34d',
  potion: '#ffa3e6',
  trap: '#ff8f80',
} as const

/** Stone and floor at no light and at full torchlight; a lit cell lies between. */
const RAMPS = {
  floorBg: ['#17130f', '#4a3a28'],
  floorFg: ['#2d251c', '#b8946a'],
  passageBg: ['#100e0c', '#3d3226'],
  wallBg: ['#24232b', '#6b6258'],
  wallFg: ['#2d2c35', '#857a6d'],
} as const

export type Ramp = keyof typeof RAMPS

const LIGHT_STEPS = 4
export const TORCH_RADIUS = 9

const channels = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16))
const toHex = (rgb: number[]) => `#${rgb.map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}`

export const mix = (from: string, to: string, t: number) => {
  const a = channels(from)
  const b = channels(to)
  return toHex(a.map((c, i) => c + ((b[i] ?? c) - c) * t))
}

/**
 * Torchlight at a cell `dx`, `dy` from the hero, 0 to 1, in a few steps so neighbouring cells share a style.
 * Rows count double: a terminal cell is about twice as tall as it is wide.
 */
export const light = (dx: number, dy: number) => {
  const distance = Math.hypot(dx, dy * 2)
  const raw = Math.max(0, 1 - distance / TORCH_RADIUS)
  return Math.round(raw * LIGHT_STEPS) / LIGHT_STEPS
}

export const shade = (ramp: Ramp, level: number) => {
  const [dark, bright] = RAMPS[ramp]
  return mix(dark, bright, Math.max(0.15, level))
}

const luminance = (hex: string) => {
  const [r = 0, g = 0, b = 0] = channels(hex).map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The WCAG contrast ratio of two colors, 1 to 21. */
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
