/**
 * Kepler's equation: where a body is on its orbit at a given time.
 *
 * Elliptic:   M = E − e·sin E          (M = n·t, the mean anomaly)
 * Hyperbolic: M = e·sinh H − H
 *
 * Both are solved with Newton's method; the true anomaly ν then gives the
 * position through r = p / (1 + e·cos ν).
 */

/** Eccentric anomaly E for mean anomaly M (any real number) and 0 ≤ e < 1. */
export function solveKeplerElliptic(M: number, e: number): number {
  // Reduce M to (−π, π] for a good starting point; add the turns back afterwards.
  const turns = Math.round(M / (2 * Math.PI))
  const m = M - turns * 2 * Math.PI
  let E = e < 0.8 ? m : Math.PI * Math.sign(m || 1)
  for (let i = 0; i < 30; i++) {
    const f = E - e * Math.sin(E) - m
    const step = f / (1 - e * Math.cos(E))
    E -= step
    if (Math.abs(step) < 1e-13) break
  }
  return E + turns * 2 * Math.PI
}

/** Hyperbolic anomaly H for mean anomaly M and e > 1. */
export function solveKeplerHyperbolic(M: number, e: number): number {
  let H = Math.asinh(M / e)
  for (let i = 0; i < 50; i++) {
    const f = e * Math.sinh(H) - H - M
    const step = f / (e * Math.cosh(H) - 1)
    H -= step
    if (Math.abs(step) < 1e-13) break
  }
  return H
}

/** True anomaly ν from the eccentric anomaly (continuous across turns). */
export function trueAnomalyElliptic(E: number, e: number): number {
  const turns = Math.round(E / (2 * Math.PI))
  const Er = E - turns * 2 * Math.PI
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(Er / 2), Math.sqrt(1 - e) * Math.cos(Er / 2))
  return nu + turns * 2 * Math.PI
}

/** True anomaly ν from the hyperbolic anomaly. */
export function trueAnomalyHyperbolic(H: number, e: number): number {
  return 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H / 2))
}

/** Mean anomaly of an elliptic orbit at true anomaly ν (inverse of the above). */
export function meanAnomalyFromTrue(nu: number, e: number): number {
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2))
  return E - e * Math.sin(E)
}
