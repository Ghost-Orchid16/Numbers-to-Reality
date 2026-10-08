/**
 * The rocket chapter's scroll timeline. Each beat covers a span of mission
 * time anchored to events computed from the current flight (liftoff, Max-Q,
 * throttle-down, engine cutoff), so when a slider reshapes the flight the
 * story stays aligned with it.
 */
import { clamp } from '../../sim/core/math'
import { COUNTDOWN } from '../../sim/rocket/evaluate'
import type { Flight } from '../../sim/rocket/flight'

export type BeatId = 'intro' | 'countdown' | 'liftoff' | 'drag' | 'turn' | 'mass' | 'orbit' | 'lab'

export type Anchor = 'pad' | 'rocket' | 'planet'

export interface CameraShot {
  anchor: Anchor
  /** Distance from the look-at point (m). */
  distance: number
  /** Degrees around the local vertical; 0 looks at the trajectory side-on, positive swings downrange. */
  azimuth: number
  /** Degrees above the local horizontal. */
  elevation: number
  /** Raise the look-at point along local up by this fraction of the distance. */
  lift: number
}

export interface Emphasis {
  /** The computed trajectory line. */
  path: number
  thrust: number
  weight: number
  drag: number
  pad: number
  net: number
  velocity: number
  orbit: number
}

export interface BeatSpec {
  id: BeatId
  shot: CameraShot
  emphasis: Emphasis
  /** Relative scroll length of the beat. */
  weight: number
}

const none: Emphasis = { path: 1, thrust: 0, weight: 0, drag: 0, pad: 0, net: 0, velocity: 0, orbit: 0 }

export const BEATS: readonly BeatSpec[] = [
  {
    id: 'intro',
    shot: { anchor: 'pad', distance: 520, azimuth: 42, elevation: 10, lift: 0.1 },
    emphasis: { ...none, path: 0 },
    weight: 1.2,
  },
  {
    id: 'countdown',
    shot: { anchor: 'pad', distance: 240, azimuth: 34, elevation: 5, lift: 0.11 },
    emphasis: { ...none, path: 0.4, weight: 1, pad: 1 },
    weight: 1,
  },
  {
    id: 'liftoff',
    shot: { anchor: 'rocket', distance: 230, azimuth: 22, elevation: -3, lift: 0.02 },
    emphasis: { ...none, thrust: 1, weight: 1, pad: 1, net: 1 },
    weight: 1.1,
  },
  {
    id: 'drag',
    shot: { anchor: 'rocket', distance: 520, azimuth: 2, elevation: 2, lift: 0 },
    emphasis: { ...none, thrust: 1, weight: 1, drag: 1, velocity: 0.6 },
    weight: 1.2,
  },
  {
    id: 'turn',
    shot: { anchor: 'rocket', distance: 90_000, azimuth: -4, elevation: 10, lift: 0 },
    emphasis: { ...none, thrust: 1, velocity: 1, orbit: 1 },
    weight: 1.2,
  },
  {
    id: 'mass',
    shot: { anchor: 'rocket', distance: 1_400_000, azimuth: 0, elevation: 20, lift: 0 },
    emphasis: { ...none, thrust: 1, weight: 0.8, orbit: 1 },
    weight: 1.2,
  },
  {
    id: 'orbit',
    shot: { anchor: 'planet', distance: 38_000_000, azimuth: -22, elevation: 38, lift: 0 },
    emphasis: { ...none, velocity: 1, orbit: 1 },
    weight: 1.3,
  },
  {
    id: 'lab',
    shot: { anchor: 'rocket', distance: 650, azimuth: 18, elevation: 4, lift: 0 },
    emphasis: { ...none, thrust: 1, weight: 1, drag: 1, pad: 1, velocity: 0.6, orbit: 1 },
    weight: 1.4,
  },
]

export const BEAT_INDEX: Record<BeatId, number> = Object.fromEntries(BEATS.map((b, i) => [b.id, i])) as Record<BeatId, number>

const TOTAL_WEIGHT = BEATS.reduce((sum, b) => sum + b.weight, 0)

/**
 * Scroll progress (0–1) at which each beat starts, plus a final 1.
 *
 * Each step is `weight` viewports tall and the sticky stage scrolls for
 * (total − 1) viewports, so after s viewports of scroll, step i's top has
 * crossed the middle of the screen once s ≥ (start of step i) − ½. That is
 * when its text is the one being read, so that is when its beat begins.
 */
export const BEAT_STARTS: readonly number[] = (() => {
  const span = TOTAL_WEIGHT - 1
  const starts: number[] = []
  let acc = 0
  for (const b of BEATS) {
    starts.push(clamp((acc - 0.5) / span, 0, 1))
    acc += b.weight
  }
  starts.push(1)
  return starts
})()

/** Which beat a scroll progress falls in, and how far through it (0–1). */
export function beatAt(progress: number): { index: number; local: number } {
  const p = clamp(progress, 0, 1)
  for (let i = 0; i < BEATS.length; i++) {
    if (p < BEAT_STARTS[i + 1] || i === BEATS.length - 1) {
      const span = BEAT_STARTS[i + 1] - BEAT_STARTS[i]
      return { index: i, local: span > 0 ? clamp((p - BEAT_STARTS[i]) / span, 0, 1) : 1 }
    }
  }
  return { index: BEATS.length - 1, local: 1 }
}

/**
 * Mission-time span of each story beat for this flight. Always monotonic and
 * inside [−countdown, end], whatever the flight did (or failed to do).
 */
export function beatTimeRanges(flight: Flight): Array<[number, number]> {
  const end = flight.endTime
  const e = flight.events
  const liftoff = e.liftoff ?? 0
  const meco = e.meco?.t ?? end
  const burn = Math.max(1, meco - liftoff)

  // One mark per beat boundary: intro (frozen at T−10), countdown, liftoff,
  // drag, turn, mass, orbit.
  const marks = [
    -COUNTDOWN,
    -COUNTDOWN,
    0,
    // Liftoff ends as the pitch-over begins: until then the flight is purely
    // vertical and a = (T − mg − D)/m holds exactly as a scalar equation.
    e.pitchover ?? liftoff + 12,
    e.maxQ ? e.maxQ.t + 25 : liftoff + burn * 0.35,
    e.throttle && e.throttle.t < meco ? e.throttle.t : liftoff + burn * 0.62,
    meco,
    end,
  ]
  // Enforce order and bounds; a failed flight compresses the later beats.
  for (let i = 1; i < marks.length; i++) marks[i] = clamp(Math.max(marks[i], marks[i - 1]), -COUNTDOWN, end)
  const ranges: Array<[number, number]> = []
  for (let i = 0; i < marks.length - 1; i++) ranges.push([marks[i], marks[i + 1]])
  return ranges
}

/** Mission time shown at a scroll progress. During the lab beat the clock is free. */
export function timeAtProgress(flight: Flight, progress: number): number | null {
  const { index, local } = beatAt(progress)
  if (BEATS[index].id === 'lab') return null
  const [t0, t1] = beatTimeRanges(flight)[index]
  return t0 + (t1 - t0) * local
}
