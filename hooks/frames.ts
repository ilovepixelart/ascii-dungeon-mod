// Frames: the one ticker every animation plays on, and the measure of how well it keeps time.

/** A spread of frame times in ms: the slowest 1% and the worst say more about stutter than the mean. */
export type FrameSummary = { count: number; mean: number; p50: number; p99: number; max: number }

/** Nearest-rank percentile `q` (0 to 1) of `sorted`, ascending. */
const rank = (sorted: readonly number[], q: number) => sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] ?? 0

export const summarize = (samples: readonly number[]): FrameSummary => {
  const sorted = [...samples].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  return { count: sorted.length, mean: sorted.length === 0 ? 0 : sum / sorted.length, p50: rank(sorted, 0.5), p99: rank(sorted, 0.99), max: sorted.at(-1) ?? 0 }
}

/** The latest samples of some time, kept up to `KEPT`, summarized on demand. */
export const createSamples = () => {
  const list: number[] = []
  return {
    add: (ms: number) => {
      list.push(ms)
      if (list.length > KEPT) list.shift()
    },
    summary: () => summarize(list),
    reset: () => {
      list.length = 0
    },
  }
}

/** About thirty frames a second. */
export const FRAME_MS = 33
/** A tick this much after the one before it came late. */
export const LATE_MS = FRAME_MS * 1.5
/** How many of the latest ticks the measure keeps. */
const KEPT = 600

/** One frame of an animation, `frame` counting from 1; it answers whether the animation goes on. */
export type Step = (frame: number) => boolean | Promise<boolean>
/** Starts the shared timer, ticking every FRAME_MS: each tick calls the ticker's `tick` with the time. */
export type Wake = () => { cancel: () => void }
export type TickStats = { ticks: number; late: number; skipped: number; interval: FrameSummary; work: FrameSummary }

/**
 * The single ticker: each tick of one shared timer plays the next frame of every running animation, counted, never
 * read off the clock, so a late tick plays the next frame rather than skipping ahead. The timer runs only while
 * something does; the caller owns it, started by the `wake` it hands in, and passes each tick's time. A tick that comes while the last frame is still being drawn plays nothing. `work` times a tick's
 * frames with `workNow`, finer than the host clock where the runtime has it.
 */
export const createTicker = (workNow: () => number = () => 0) => {
  const running = new Map<string, { frame: number; step: Step }>()
  let timer: { cancel: () => void } | null = null
  let lastTick: number | null = null
  let isBusy = false
  const intervals: number[] = []
  const work: number[] = []
  let ticks = 0
  let late = 0
  let skipped = 0
  const keep = (list: number[], value: number) => {
    list.push(value)
    if (list.length > KEPT) list.shift()
  }
  const sleepIfIdle = () => {
    if (running.size > 0 || timer === null) return
    timer.cancel()
    timer = null
    lastTick = null
  }
  const tick = async (at: number) => {
    ticks += 1
    if (lastTick !== null) {
      keep(intervals, at - lastTick)
      if (at - lastTick > LATE_MS) late += 1
    }
    lastTick = at
    if (isBusy) {
      skipped += 1
      return
    }
    isBusy = true
    const t0 = workNow()
    try {
      for (const [key, animation] of [...running]) {
        // One started over or stopped by an earlier step this tick plays no more.
        if (running.get(key) !== animation) continue
        animation.frame += 1
        const goesOn = await animation.step(animation.frame)
        if (!goesOn && running.get(key) === animation) running.delete(key)
      }
    } finally {
      keep(work, workNow() - t0)
      isBusy = false
      sleepIfIdle()
    }
  }
  return {
    /** Starts `key` over from frame 1, replacing any animation by that name. */
    start: (key: string, step: Step, wake: Wake) => {
      running.set(key, { frame: 0, step })
      timer ??= wake()
    },
    tick,
    stop: (key: string) => {
      running.delete(key)
      sleepIfIdle()
    },
    stats: (): TickStats => ({ ticks, late, skipped, interval: summarize(intervals), work: summarize(work) }),
    /** Forgets what was measured; the next tick has no gap before it. */
    reset: () => {
      intervals.length = 0
      work.length = 0
      ticks = 0
      late = 0
      skipped = 0
      lastTick = null
    },
  }
}
