import { describe, expect, it } from 'vitest'
import { createFlightState, evaluateFlight } from './evaluate'
import { simulateFlight } from './flight'
import { orbitalElements, sampleConic } from './orbit'
import { DEFAULT_ROCKET_PARAMS } from './params'

/** Distance from point (px, py) to the polyline. */
function distanceToPolyline(pts: Float64Array, n: number, px: number, py: number): number {
  let best = Infinity
  for (let i = 0; i < n - 1; i++) {
    const ax = pts[2 * i]
    const ay = pts[2 * i + 1]
    const dx = pts[2 * i + 2] - ax
    const dy = pts[2 * i + 3] - ay
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    best = Math.min(best, Math.hypot(ax + t * dx - px, ay + t * dy - py))
  }
  return best
}

describe('predicted orbit drawing', () => {
  it('passes through the rocket at every stage of the ascent (as drawn, 720 segments)', () => {
    const flight = simulateFlight(DEFAULT_ROCKET_PARAMS)
    for (const t of [20, 60, 126, 200, 260, 299, 400]) {
      const s = evaluateFlight(flight, t, createFlightState())
      const el = orbitalElements(s.x, s.y, s.vx, s.vy, flight.summary.mu)
      const pts = new Float64Array(2 * 721)
      const n = sampleConic(el, 720, 6371000 * 14, pts)
      const miss = distanceToPolyline(pts, n, s.x, s.y)
      // Far below a pixel at the camera distances used in that part of the story.
      expect(miss, `t=${t}, e=${el.eccentricity.toFixed(3)}`).toBeLessThan(100)
    }
  })

  it('draws escape trajectories as hyperbolas through the current position', () => {
    const mu = 9.81 * 6371000 ** 2
    const r = 6571000
    const v = Math.sqrt((2 * mu) / r) * 1.2
    const el = orbitalElements(r * Math.cos(1), r * Math.sin(1), -v * Math.sin(1) * 0.9, v * Math.cos(1), mu)
    const pts = new Float64Array(2 * 721)
    const n = sampleConic(el, 720, r * 20, pts)
    expect(el.eccentricity).toBeGreaterThan(1)
    expect(distanceToPolyline(pts, n, r * Math.cos(1), r * Math.sin(1))).toBeLessThan(200)
  })
})
