/**
 * Geographic frames.
 *
 * Globe meshes are built in a "geo" frame: +y through the North Pole, +x
 * through latitude 0° / longitude 0°, and
 *   p(lat, lon) = (cos lat·cos lon, sin lat, −cos lat·sin lon).
 * Shaders invert it with lat = asin(y), lon = atan2(−z, x).
 */
import { Matrix4, Vector3 } from 'three'

const DEG = Math.PI / 180

export function geoToVector(latDeg: number, lonDeg: number, radius = 1, out = new Vector3()): Vector3 {
  const lat = latDeg * DEG
  const lon = lonDeg * DEG
  return out.set(radius * Math.cos(lat) * Math.cos(lon), radius * Math.sin(lat), -radius * Math.cos(lat) * Math.sin(lon))
}

/**
 * Rotation that takes the geo frame to a launch frame in which the site sits
 * on +y, local east points along +x and +z points south. Applying it to a
 * globe mesh puts the right geography under a 2D trajectory that starts at
 * (0, R) and heads downrange along +x.
 */
export function launchFrameRotation(latDeg: number, lonDeg: number): Matrix4 {
  const up = geoToVector(latDeg, lonDeg)
  const north = new Vector3(0, 1, 0).sub(up.clone().multiplyScalar(up.y)).normalize()
  const east = new Vector3().crossVectors(north, up).normalize()
  const south = north.clone().negate()
  // Rows of the rotation are the target axes expressed in geo coordinates.
  const basis = new Matrix4().makeBasis(east, up, south)
  return basis.transpose()
}
