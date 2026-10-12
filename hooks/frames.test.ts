import { describe, expect, test } from 'claude-code/testing'

import { FRAME_MS, createSamples, createTicker, summarize } from './frames'

test('summarizes frame times by nearest rank: the median, the slowest 1% and the worst', async () => {
  // 1..100 ms: the 50th value is 50, the 99th is 99.
  const times = Array.from({ length: 100 }, (_, i) => 100 - i)
  expect(summarize(times)).toEqual({ count: 100, mean: 50.5, p50: 50, p99: 99, max: 100 })
  expect(summarize([7])).toEqual({ count: 1, mean: 7, p50: 7, p99: 7, max: 7 })
  expect(summarize([])).toEqual({ count: 0, mean: 0, p50: 0, p99: 0, max: 0 })
})

/** A clock the test drives by hand: `tick()` fires the timer once, `at` is the time it reads. */
const fakeClock = () => {
  let ticker: ReturnType<typeof createTicker> | null = null
  const clock = {
    at: 0,
    fn: null as (() => void) | null,
    started: 0,
    /** The wake a ticker is started with: a timer whose ticks pass the time read now. */
    wake: (t: ReturnType<typeof createTicker>) => () => {
      ticker = t
      clock.fn = () => void ticker?.tick(clock.at)
      clock.started += 1
      return { cancel: () => (clock.fn = null) }
    },
    tick: async (ms = FRAME_MS) => {
      clock.at += ms
      clock.fn?.()
      // Lets the tick and anything it awaits settle before the next one.
      for (let i = 0; i < 10; i += 1) await Promise.resolve()
    },
  }
  return clock
}

describe('the ticker', () => {
  test('plays one frame per tick, counting from 1, and sleeps once nothing runs', async () => {
    const clock = fakeClock()
    const ticker = createTicker()
    const seen: number[] = []
    ticker.start(
      'walk',
      f => {
        seen.push(f)
        return f < 3
      },
      clock.wake(ticker),
    )
    for (let i = 0; i < 5; i += 1) await clock.tick()
    expect(seen).toEqual([1, 2, 3])
    expect(clock.fn).toBeNull()
  })

  test('a late tick plays the next frame, never skipping ahead', async () => {
    const clock = fakeClock()
    const ticker = createTicker()
    const seen: number[] = []
    ticker.start('walk', f => (seen.push(f), true), clock.wake(ticker))
    await clock.tick()
    await clock.tick(5 * FRAME_MS)
    await clock.tick()
    expect(seen).toEqual([1, 2, 3])
    ticker.stop('walk')
  })

  test('several animations share one timer, each with its own frame count', async () => {
    const clock = fakeClock()
    const ticker = createTicker()
    const a: number[] = []
    const b: number[] = []
    ticker.start('a', f => (a.push(f), true), clock.wake(ticker))
    await clock.tick()
    ticker.start('b', f => (b.push(f), true), clock.wake(ticker))
    await clock.tick()
    expect({ a, b, timers: clock.started }).toEqual({ a: [1, 2], b: [1], timers: 1 })
    ticker.stop('a')
    ticker.stop('b')
    expect(clock.fn).toBeNull()
  })

  test('restarting an animation starts it over from frame 1; the replaced one plays no more', async () => {
    const clock = fakeClock()
    const ticker = createTicker()
    const old: number[] = []
    const fresh: number[] = []
    ticker.start('walk', f => (old.push(f), true), clock.wake(ticker))
    await clock.tick()
    ticker.start('walk', f => (fresh.push(f), true), clock.wake(ticker))
    await clock.tick()
    await clock.tick()
    expect({ old, fresh }).toEqual({ old: [1], fresh: [1, 2] })
    ticker.stop('walk')
  })

  test('an animation stopped by another during a tick plays no frame in it', async () => {
    const clock = fakeClock()
    const ticker = createTicker()
    const b: number[] = []
    ticker.start(
      'a',
      () => {
        ticker.stop('b')
        return false
      },
      clock.wake(ticker),
    )
    ticker.start('b', f => (b.push(f), true), clock.wake(ticker))
    await clock.tick()
    expect(b).toEqual([])
    expect(clock.fn).toBeNull()
  })

  test('a tick that comes while a frame is still being drawn plays nothing and is counted', async () => {
    const clock = fakeClock()
    const ticker = createTicker()
    const seen: number[] = []
    let release = () => {}
    ticker.start(
      'walk',
      f => {
        seen.push(f)
        return f === 1 ? new Promise<boolean>(done => (release = () => done(true))) : true
      },
      clock.wake(ticker),
    )
    await clock.tick()
    await clock.tick()
    release()
    for (let i = 0; i < 10; i += 1) await Promise.resolve()
    await clock.tick()
    await clock.tick()
    expect(seen).toEqual([1, 2, 3])
    expect(ticker.stats().skipped).toBe(1)
    ticker.stop('walk')
  })

  test('runs at 30 frames a second', async () => {
    expect(FRAME_MS).toBe(33)
  })

  test('measures the gaps between ticks and counts the late ones, more than 1.5 frames apart', async () => {
    const clock = fakeClock()
    const ticker = createTicker()
    ticker.start('walk', () => true, clock.wake(ticker))
    for (const gap of [33, 33, 60, 33, 34]) await clock.tick(gap)
    const s = ticker.stats()
    expect(s.ticks).toBe(5)
    expect(s.late).toBe(1)
    // The first tick has no gap before it: four gaps, 33, 60, 33, 34.
    expect(s.interval).toEqual(summarize([33, 60, 33, 34]))
    ticker.stop('walk')
  })
})

test('reset clears what was measured, so a benchmark reports only its own frames', async () => {
  const clock = fakeClock()
  const ticker = createTicker()
  ticker.start('walk', () => true, clock.wake(ticker))
  for (const gap of [33, 80, 33]) await clock.tick(gap)
  ticker.reset()
  await clock.tick(33)
  await clock.tick(34)
  const s = ticker.stats()
  expect({ ticks: s.ticks, late: s.late, skipped: s.skipped, interval: s.interval }).toEqual({ ticks: 2, late: 0, skipped: 0, interval: summarize([34]) })
  ticker.stop('walk')
  const samples = createSamples()
  samples.add(5)
  samples.reset()
  samples.add(2)
  expect(samples.summary()).toEqual(summarize([2]))
})
