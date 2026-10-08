import { describe, expect, it } from 'vitest'
import { simulateFlight } from '../../sim/rocket/flight'
import { DEFAULT_ROCKET_PARAMS } from '../../sim/rocket/params'
import { BEAT_STARTS, BEATS, beatAt, beatTimeRanges, timeAtProgress } from './timeline'

describe('scroll timeline', () => {
  it('beat starts are monotonic from 0 to 1', () => {
    expect(BEAT_STARTS[0]).toBe(0)
    expect(BEAT_STARTS[BEAT_STARTS.length - 1]).toBe(1)
    for (let i = 1; i < BEAT_STARTS.length; i++) expect(BEAT_STARTS[i]).toBeGreaterThanOrEqual(BEAT_STARTS[i - 1])
  })

  it('maps the ends of the scroll to the first and last beats', () => {
    expect(beatAt(0).index).toBe(0)
    expect(beatAt(1).index).toBe(BEATS.length - 1)
  })

  it('mission time never runs backwards as the reader scrolls forward', () => {
    const flight = simulateFlight(DEFAULT_ROCKET_PARAMS)
    let last = -Infinity
    for (let p = 0; p <= 1; p += 0.002) {
      const t = timeAtProgress(flight, p)
      if (t === null) continue
      expect(t).toBeGreaterThanOrEqual(last - 1e-9)
      last = t
    }
  })

  it('keeps time ranges ordered and in bounds even for a failed flight', () => {
    for (const params of [DEFAULT_ROCKET_PARAMS, { ...DEFAULT_ROCKET_PARAMS, thrust: 0.15e6 }, { ...DEFAULT_ROCKET_PARAMS, pitchKick: 12 }]) {
      const flight = simulateFlight(params)
      const ranges = beatTimeRanges(flight)
      expect(ranges.length).toBe(BEATS.length - 1)
      for (const [a, b] of ranges) {
        expect(b).toBeGreaterThanOrEqual(a)
        expect(b).toBeLessThanOrEqual(flight.endTime + 1e-9)
      }
    }
  })
})
