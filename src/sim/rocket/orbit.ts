/**
 * Two-body (Keplerian) orbital elements in a plane.
 *
 * Given position r and velocity v relative to the planet's centre and the
 * gravitational parameter μ = GM, the motion under gravity alone is a conic:
 *
 *   r(θ) = p / (1 + e·cos(θ − ω))
 *
 * where p = h²/μ (semi-latus rectum), h = |r × v| (specific angular momentum),
 * e is the eccentricity and ω the direction of periapsis.
 */
export interface OrbitalElements {
  /** Specific orbital energy ε = v²/2 − μ/r (J/kg). Negative means bound. */
  energy: number
  /** Specific angular momentum h = x·vy − y·vx (m²/s). Sign gives direction. */
  angularMomentum: number
  eccentricity: number
  /** Semi-major axis a = −μ/(2ε); negative for hyperbolic orbits. */
  semiMajorAxis: number
  /** Semi-latus rectum p = h²/μ. */
  semiLatusRectum: number
  /** Periapsis radius r_p = p/(1 + e). */
  periapsis: number
  /** Apoapsis radius r_a = a(1 + e); Infinity when unbound. */
  apoapsis: number
  /** Orbital period 2π√(a³/μ); NaN when unbound. */
  period: number
  /** Angle of the periapsis direction, ω (rad). */
  argumentOfPeriapsis: number
  /** Escape (hyperbolic excess) speed √(2ε) when unbound, else 0. */
  excessSpeed: number
}

export function orbitalElements(x: number, y: number, vx: number, vy: number, mu: number): OrbitalElements {
  const r = Math.hypot(x, y)
  const v2 = vx * vx + vy * vy
  const energy = v2 / 2 - mu / r
  const h = x * vy - y * vx
  const rDotV = x * vx + y * vy

  // Eccentricity vector e = ((v² − μ/r)·r − (r·v)·v) / μ
  const k = v2 - mu / r
  const ex = (k * x - rDotV * vx) / mu
  const ey = (k * y - rDotV * vy) / mu
  const e = Math.hypot(ex, ey)

  const p = (h * h) / mu
  const periapsis = p / (1 + e)
  const bound = energy < 0
  const semiMajorAxis = -mu / (2 * energy)
  // a(1 + e) rather than p/(1 − e): for near-vertical flight the orbit is a
  // needle-thin ellipse with e → 1 and p → 0, where p/(1 − e) is 0/0. (Purely
  // vertical motion is the limit e = 1 of a bound orbit, apoapsis 2a.)
  const apoapsis = bound ? semiMajorAxis * (1 + Math.min(e, 1)) : Infinity
  const period = bound ? 2 * Math.PI * Math.sqrt(semiMajorAxis ** 3 / mu) : Number.NaN
  // For a near-circular orbit the periapsis direction is undefined; use the position angle.
  const argumentOfPeriapsis = e > 1e-9 ? Math.atan2(ey, ex) : Math.atan2(y, x)

  return {
    energy,
    angularMomentum: h,
    eccentricity: e,
    semiMajorAxis,
    semiLatusRectum: p,
    periapsis,
    apoapsis,
    period,
    argumentOfPeriapsis,
    excessSpeed: bound ? 0 : Math.sqrt(2 * energy),
  }
}

/** Circular orbital speed at radius r: v = √(μ/r). */
export function circularSpeed(mu: number, r: number): number {
  return Math.sqrt(mu / r)
}

/** Escape speed at radius r: v = √(2μ/r). */
export function escapeSpeed(mu: number, r: number): number {
  return Math.sqrt((2 * mu) / r)
}

/**
 * Samples points along the conic described by `el`, writing [x0, y0, x1, y1, …]
 * into `out` and returning the number of points written. The curve is cut
 * where it reaches `maxRadius`, so very eccentric ellipses and hyperbolic
 * escape paths stay drawable.
 *
 * Points are spaced uniformly in the eccentric anomaly E (hyperbolic anomaly
 * H for escape paths), not in the true anomaly: during an ascent the orbit is
 * a needle-thin ellipse (e ≈ 0.97), and equal steps in true anomaly leave
 * points ~100 km apart near apoapsis, where chords would cut kilometres
 * inside the curve. Equal steps in E keep the chord error to metres.
 */
export function sampleConic(el: OrbitalElements, segments: number, maxRadius: number, out: Float64Array): number {
  const e = el.eccentricity
  const p = el.semiLatusRectum
  const w = el.argumentOfPeriapsis
  if (!(p > 0) || p / (1 + e) > maxRadius) return 0
  const cw = Math.cos(w)
  const sw = Math.sin(w)
  const count = Math.min(segments + 1, Math.floor(out.length / 2))
  const put = (i: number, xPf: number, yPf: number) => {
    // Rotate from the perifocal frame (periapsis along +x) to the plane.
    out[2 * i] = xPf * cw - yPf * sw
    out[2 * i + 1] = xPf * sw + yPf * cw
  }

  if (e < 1 - 1e-9) {
    // Ellipse: x = a(cos E − e), y = b·sin E, r = a(1 − e·cos E).
    const a = p / (1 - e * e)
    const b = a * Math.sqrt(1 - e * e)
    let limit = Math.PI
    const c = (1 - maxRadius / a) / Math.max(e, 1e-12)
    if (e > 0 && c > -1) limit = Math.acos(Math.min(1, c))
    for (let i = 0; i < count; i++) {
      const E = -limit + (2 * limit * i) / (count - 1)
      put(i, a * (Math.cos(E) - e), b * Math.sin(E))
    }
    return count
  }

  if (e > 1 + 1e-9) {
    // Hyperbola: x = |a|(e − cosh H), y = |a|√(e² − 1)·sinh H, r = |a|(e·cosh H − 1).
    const a = p / (e * e - 1)
    const b = a * Math.sqrt(e * e - 1)
    const limit = Math.acosh(Math.max(1, (maxRadius / a + 1) / e))
    for (let i = 0; i < count; i++) {
      const H = -limit + (2 * limit * i) / (count - 1)
      put(i, a * (e - Math.cosh(H)), b * Math.sinh(H))
    }
    return count
  }

  // Parabola (e = 1): r = p / (1 + cos ν), sampled in ν.
  const limit = Math.acos(Math.max(-1, Math.min(1, p / maxRadius - 1)))
  for (let i = 0; i < count; i++) {
    const nu = -limit + (2 * limit * i) / (count - 1)
    const r = p / (1 + Math.cos(nu))
    put(i, r * Math.cos(nu), r * Math.sin(nu))
  }
  return count
}
