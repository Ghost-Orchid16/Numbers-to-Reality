/**
 * Educational atmosphere model.
 *
 * Density: piecewise exponential ρ(h) = ρ₀ · e^(−(h − h₀)/H), with a base
 * density ρ₀ and scale height H for each altitude band. The table is the
 * widely used fit to the U.S. Standard Atmosphere 1976 / CIRA-72 published in
 * Vallado, "Fundamentals of Astrodynamics and Applications" (Table 8-4).
 * It ignores weather, season, time of day and solar activity — the real
 * upper atmosphere varies by an order of magnitude with the solar cycle.
 *
 * Temperature (used only to compute the speed of sound for the Mach number):
 * the piecewise-linear lapse-rate profile of the International Standard
 * Atmosphere up to 86 km, held constant above.
 */

export interface AtmosphereLayer {
  /** Base altitude h₀ in metres. */
  base: number
  /** Density at the base, ρ₀, in kg/m³. */
  density: number
  /** Scale height H in metres. */
  scaleHeight: number
}

const KM = 1000

export const ATMOSPHERE_LAYERS: readonly AtmosphereLayer[] = [
  { base: 0, density: 1.225, scaleHeight: 7.249 * KM },
  { base: 25 * KM, density: 3.899e-2, scaleHeight: 6.349 * KM },
  { base: 30 * KM, density: 1.774e-2, scaleHeight: 6.682 * KM },
  { base: 40 * KM, density: 3.972e-3, scaleHeight: 7.554 * KM },
  { base: 50 * KM, density: 1.057e-3, scaleHeight: 8.382 * KM },
  { base: 60 * KM, density: 3.206e-4, scaleHeight: 7.714 * KM },
  { base: 70 * KM, density: 8.77e-5, scaleHeight: 6.549 * KM },
  { base: 80 * KM, density: 1.905e-5, scaleHeight: 5.799 * KM },
  { base: 90 * KM, density: 3.396e-6, scaleHeight: 5.382 * KM },
  { base: 100 * KM, density: 5.297e-7, scaleHeight: 5.877 * KM },
  { base: 110 * KM, density: 9.661e-8, scaleHeight: 7.263 * KM },
  { base: 120 * KM, density: 2.438e-8, scaleHeight: 9.473 * KM },
  { base: 130 * KM, density: 8.484e-9, scaleHeight: 12.636 * KM },
  { base: 140 * KM, density: 3.845e-9, scaleHeight: 16.149 * KM },
  { base: 150 * KM, density: 2.07e-9, scaleHeight: 22.523 * KM },
  { base: 180 * KM, density: 5.464e-10, scaleHeight: 29.74 * KM },
  { base: 200 * KM, density: 2.789e-10, scaleHeight: 37.105 * KM },
  { base: 250 * KM, density: 7.248e-11, scaleHeight: 45.546 * KM },
  { base: 300 * KM, density: 2.418e-11, scaleHeight: 53.628 * KM },
  { base: 350 * KM, density: 9.518e-12, scaleHeight: 53.298 * KM },
  { base: 400 * KM, density: 3.725e-12, scaleHeight: 58.515 * KM },
  { base: 450 * KM, density: 1.585e-12, scaleHeight: 60.828 * KM },
  { base: 500 * KM, density: 6.967e-13, scaleHeight: 63.822 * KM },
  { base: 600 * KM, density: 1.454e-13, scaleHeight: 71.835 * KM },
  { base: 700 * KM, density: 3.614e-14, scaleHeight: 88.667 * KM },
  { base: 800 * KM, density: 1.17e-14, scaleHeight: 124.64 * KM },
  { base: 900 * KM, density: 5.245e-15, scaleHeight: 181.05 * KM },
  { base: 1000 * KM, density: 3.019e-15, scaleHeight: 268 * KM },
]

export const SEA_LEVEL_DENSITY = ATMOSPHERE_LAYERS[0].density

const LAYER_BASES = Float64Array.from(ATMOSPHERE_LAYERS, (l) => l.base)

/** Index of the layer whose band contains altitude h (metres). */
function layerIndex(altitude: number): number {
  // Binary search: this runs tens of thousands of times per trajectory solve.
  let lo = 0
  let hi = LAYER_BASES.length - 1
  if (altitude >= LAYER_BASES[hi]) return hi
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (altitude >= LAYER_BASES[mid]) lo = mid
    else hi = mid
  }
  return lo
}

/** The layer whose band contains altitude h (metres). */
export function atmosphereLayer(altitude: number): AtmosphereLayer {
  return ATMOSPHERE_LAYERS[layerIndex(altitude)]
}

/** Air density ρ(h) in kg/m³. */
export function airDensity(altitude: number): number {
  const layer = ATMOSPHERE_LAYERS[layerIndex(altitude)]
  return layer.density * Math.exp(-(altitude - layer.base) / layer.scaleHeight)
}

// ISA temperature profile: [base altitude (m), base temperature (K), lapse rate (K/m)].
// The standard defines these bands in geopotential altitude; treating them as
// geometric altitude shifts them by under 1% below 86 km, which is negligible
// for a displayed Mach number.
const ISA_TEMPERATURE: ReadonlyArray<readonly [number, number, number]> = [
  [0, 288.15, -0.0065],
  [11_000, 216.65, 0],
  [20_000, 216.65, 0.001],
  [32_000, 228.65, 0.0028],
  [47_000, 270.65, 0],
  [51_000, 270.65, -0.0028],
  [71_000, 214.65, -0.002],
  [86_000, 184.65, 0],
]

/** Air temperature in kelvin (ISA, constant above 86 km). */
export function airTemperature(altitude: number): number {
  const h = Math.max(0, altitude)
  let row = ISA_TEMPERATURE[0]
  for (let i = ISA_TEMPERATURE.length - 1; i >= 0; i--) {
    if (h >= ISA_TEMPERATURE[i][0]) {
      row = ISA_TEMPERATURE[i]
      break
    }
  }
  const [base, temperature, lapse] = row
  return temperature + lapse * (h - base)
}

const GAMMA_AIR = 1.4
const R_AIR = 287.053 // J/(kg·K)

/** Speed of sound a = √(γRT) in m/s. */
export function speedOfSound(altitude: number): number {
  return Math.sqrt(GAMMA_AIR * R_AIR * airTemperature(altitude))
}
