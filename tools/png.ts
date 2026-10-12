import { deflateSync } from 'node:zlib'

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type: string, data: Uint8Array) => {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(new TextEncoder().encode(type), 4)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** Encodes `px` (rows of '#rrggbb'), each pixel blown up to `zoom` x `zoom`, as an RGB PNG. */
export const png = (px: string[][], zoom: number) => {
  const h = px.length * zoom
  const w = (px[0]?.length ?? 0) * zoom
  const raw = new Uint8Array(h * (1 + w * 3))
  for (let y = 0; y < h; y += 1) {
    const row = px[Math.floor(y / zoom)] ?? []
    raw[y * (1 + w * 3)] = 0
    for (let x = 0; x < w; x += 1) {
      const hex = row[Math.floor(x / zoom)] ?? '#000000'
      const at = y * (1 + w * 3) + 1 + x * 3
      for (let i = 0; i < 3; i += 1) raw[at + i] = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
    }
  }
  const ihdr = new Uint8Array(13)
  const v = new DataView(ihdr.buffer)
  v.setUint32(0, w)
  v.setUint32(4, h)
  ihdr.set([8, 2, 0, 0, 0], 8)
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** Encodes frames of equal size as an animated PNG that loops forever, each frame shown `delayMs`. */
export const apng = (frames: string[][][], zoom: number, delayMs: number) => {
  const h = (frames[0]?.length ?? 0) * zoom
  const w = (frames[0]?.[0]?.length ?? 0) * zoom
  const raw = (px: string[][]) => {
    const out = new Uint8Array(h * (1 + w * 3))
    for (let y = 0; y < h; y += 1) {
      const row = px[Math.floor(y / zoom)] ?? []
      for (let x = 0; x < w; x += 1) {
        const hex = row[Math.floor(x / zoom)] ?? '#000000'
        const at = y * (1 + w * 3) + 1 + x * 3
        for (let i = 0; i < 3; i += 1) out[at + i] = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
      }
    }
    return deflateSync(out)
  }
  const u32 = (...values: number[]) => {
    const b = new Uint8Array(values.length * 4)
    const v = new DataView(b.buffer)
    values.forEach((n, i) => v.setUint32(i * 4, n))
    return b
  }
  const ihdr = new Uint8Array(13)
  const v = new DataView(ihdr.buffer)
  v.setUint32(0, w)
  v.setUint32(4, h)
  ihdr.set([8, 2, 0, 0, 0], 8)
  const parts: Uint8Array[] = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('acTL', u32(frames.length, 0))]
  let seq = 0
  frames.forEach((px, i) => {
    const fctl = new Uint8Array(26)
    const f = new DataView(fctl.buffer)
    f.setUint32(0, seq++)
    f.setUint32(4, w)
    f.setUint32(8, h)
    f.setUint16(20, delayMs)
    f.setUint16(22, 1000)
    parts.push(chunk('fcTL', fctl))
    const data = raw(px)
    if (i === 0) parts.push(chunk('IDAT', data))
    else {
      const fdat = new Uint8Array(4 + data.length)
      new DataView(fdat.buffer).setUint32(0, seq++)
      fdat.set(data, 4)
      parts.push(chunk('fdAT', fdat))
    }
  })
  parts.push(chunk('IEND', new Uint8Array()))
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
