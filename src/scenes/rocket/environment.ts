/**
 * The setting of the launch: an evening launch eastward from the Florida
 * coast, 25 minutes after sunset.
 *
 * World frame = the physics frame: planet centre at the origin, launch site at
 * (0, R, 0), +x east (downrange), +z south, y up at the pad.
 */
import { Vector3 } from 'three'
import { airDensity, SEA_LEVEL_DENSITY } from '../../sim/rocket/atmosphere'
import { PLANET_RADIUS } from '../../sim/rocket/vehicle'
import { smoothstep } from '../../sim/core/math'

export const LAUNCH_SITE = { latitude: 28.6, longitude: -80.6 }

const DEG = Math.PI / 180
/** The Sun sits 7° below the horizon, toward the west-south-west (azimuth 250°). */
const SUN_DEPRESSION = 7 * DEG
const SUN_AZIMUTH = 250 * DEG

export const SUN_DIRECTION = new Vector3(
  Math.cos(SUN_DEPRESSION) * Math.sin(SUN_AZIMUTH),
  -Math.sin(SUN_DEPRESSION),
  -Math.cos(SUN_DEPRESSION) * Math.cos(SUN_AZIMUTH),
).normalize()

/**
 * How much direct sunlight reaches a point (0–1). The Earth's shadow is
 * modelled as a cylinder behind the planet, with a soft 30 km edge standing in
 * for the penumbra and atmospheric refraction.
 */
export function sunlight(x: number, y: number, z: number): number {
  const s = SUN_DIRECTION
  const along = x * s.x + y * s.y + z * s.z
  if (along >= 0) return 1
  const px = x - along * s.x
  const py = y - along * s.y
  const pz = z - along * s.z
  const fromAxis = Math.sqrt(px * px + py * py + pz * pz)
  return smoothstep(PLANET_RADIUS - 5_000, PLANET_RADIUS + 25_000, fromAxis)
}

/**
 * Brightness of the sky seen from altitude h, relative to the ground. Skylight
 * is sunlight scattered by the air above you, so it fades with the same
 * density profile the drag model uses.
 */
export function skyBrightness(altitude: number): number {
  return Math.sqrt(airDensity(Math.max(0, altitude)) / SEA_LEVEL_DENSITY)
}
