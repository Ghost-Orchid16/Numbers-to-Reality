/**
 * Newton's cannonball (Principia, Book III, 1687): fire a ball horizontally
 * from a mountain top. Slow shots fall back; faster ones land further away;
 * at circular speed the ground curves away as fast as the ball falls and it
 * never lands; faster still gives an ellipse, then an escape path.
 *
 * Units are normalised: planet radius 1, GM = 1. A horizontal launch with
 * speed k·v_c from radius r₀ gives an orbit with
 *   p = r₀·k²   (semi-latus rectum)     e = |k² − 1|   (eccentricity)
 * The launch point is apoapsis when k < 1 and periapsis when k > 1.
 */
import {
  meanAnomalyFromTrue,
  solveKeplerElliptic,
  solveKeplerHyperbolic,
  trueAnomalyElliptic,
  trueAnomalyHyperbolic,
} from '../../sim/core/kepler'

export const EARTH_GM = 3.986004418e14
export const EARTH_RADIUS = 6_371_000

export type ShotKind = 'falls' | 'circular' | 'elliptic' | 'escape'

export interface Shot {
  /** Launch speed as a multiple of circular speed at the mountain top. */
  k: number
  kind: ShotKind
  e: number
  p: number
  /** Semi-major axis (negative for a hyperbola). */
  a: number
  /** True anomaly at launch: π for apoapsis launches, 0 for periapsis. */
  nuStart: number
  /** True anomaly where the ball meets the ground, or where it leaves the frame. */
  nuEnd: number
  /** Mean motion n = √(GM/|a|³) (normalised time units). */
  n: number
  /** Launch speed in km/s using the Earth's GM and radius. */
  speedKms: number
}

export function makeShot(k: number, r0: number, rMax: number): Shot {
  const e = Math.abs(k * k - 1)
  const p = r0 * k * k
  const a = Math.abs(e - 1) < 1e-12 ? Infinity : p / (1 - e * e)
  const n = Math.sqrt(1 / Math.abs(a) ** 3)
  const vcEarth = Math.sqrt(EARTH_GM / (r0 * EARTH_RADIUS))
  const speedKms = (k * vcEarth) / 1000

  if (k < 1 - 1e-9) {
    // Apoapsis launch: ν runs from π toward 2π until r(ν) = 1 (the ground).
    const cosImpact = (p - 1) / e
    const nuEnd = cosImpact <= -1 ? 3 * Math.PI : 2 * Math.PI - Math.acos(Math.min(1, cosImpact))
    return { k, kind: 'falls', e, p, a, nuStart: Math.PI, nuEnd, n, speedKms }
  }
  if (Math.abs(k - 1) <= 1e-9) return { k, kind: 'circular', e: 0, p, a: r0, nuStart: 0, nuEnd: 2 * Math.PI, n, speedKms }
  if (e < 1) return { k, kind: 'elliptic', e, p, a, nuStart: 0, nuEnd: 2 * Math.PI, n, speedKms }
  // Hyperbola: leave the frame at r = rMax.
  const nuEnd = Math.acos(Math.max(-1, Math.min(1, (p / rMax - 1) / e)))
  return { k, kind: 'escape', e, p, a, nuStart: 0, nuEnd, n, speedKms }
}

/** Radius at true anomaly ν. */
export function radiusAt(shot: Shot, nu: number): number {
  return shot.p / (1 + shot.e * Math.cos(nu))
}

/** Normalised time from launch until true anomaly ν is reached. */
export function timeToAnomaly(shot: Shot, nu: number): number {
  if (shot.kind === 'escape') {
    const e = shot.e
    const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2))
    return (e * Math.sinh(H) - H) / shot.n
  }
  const e = shot.e
  const M0 = shot.nuStart === 0 ? 0 : Math.PI
  // Unwrap: measure the anomaly travelled from the launch point.
  const turns = Math.floor((nu - shot.nuStart) / (2 * Math.PI))
  const local = nu - turns * 2 * Math.PI
  let M = meanAnomalyFromTrue(local, e)
  if (M < M0 - 1e-12) M += 2 * Math.PI
  return (M - M0 + turns * 2 * Math.PI) / shot.n
}

/** True anomaly reached after normalised time t since launch. */
export function anomalyAtTime(shot: Shot, t: number): number {
  if (shot.kind === 'escape') return trueAnomalyHyperbolic(solveKeplerHyperbolic(shot.n * t, shot.e), shot.e)
  const M0 = shot.nuStart === 0 ? 0 : Math.PI
  const E = solveKeplerElliptic(M0 + shot.n * t, shot.e)
  return trueAnomalyElliptic(E, shot.e)
}

/**
 * Position at true anomaly ν with the launch point at polar angle φ₀ and
 * clockwise motion: φ = φ₀ − (ν − ν_start).
 */
export function positionAt(shot: Shot, nu: number, phi0: number): [number, number] {
  const r = radiusAt(shot, nu)
  const phi = phi0 - (nu - shot.nuStart)
  return [r * Math.cos(phi), r * Math.sin(phi)]
}
