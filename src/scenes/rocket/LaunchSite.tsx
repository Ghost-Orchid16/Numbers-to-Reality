import { useEffect, useMemo } from 'react'
import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, LineBasicMaterial, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Height of the launch mount the rocket stands on (m). */
export const MOUNT_HEIGHT = 6
const PAD_HEIGHT = 1.5
export const ROCKET_BASE_HEIGHT = PAD_HEIGHT + MOUNT_HEIGHT
/** The service tower stands west of the rocket, so the eastward pitch-over clears it. */
const TOWER = { x: -11, z: -3, width: 8, height: 78, bay: 7.8 }
/** Lightning masts stand north and west of the pad, behind it from the usual camera angles. */
const MASTS: Array<[number, number]> = [
  [-175, -40],
  [-70, -185],
  [120, -160],
]
const MAST_HEIGHT = 115

/** A box spanning from a to b with the given square cross-section. */
function beam(a: Vector3, b: Vector3, size: number): BufferGeometry {
  const length = a.distanceTo(b)
  const g = new BoxGeometry(size, length, size)
  const mid = a.clone().add(b).multiplyScalar(0.5)
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize())
  g.applyMatrix4(new Matrix4().compose(mid, q, new Vector3(1, 1, 1)))
  return g
}

/** Square lattice tower with an access arm, merged into one geometry (one draw call). */
function createTowerGeometry(): BufferGeometry {
  const { width: w, height: h, bay } = TOWER
  const half = w / 2
  const parts: BufferGeometry[] = []
  const corners = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ]
  for (const [x, z] of corners) parts.push(beam(new Vector3(x, 0, z), new Vector3(x, h, z), 0.55))
  const levels = Math.floor(h / bay)
  for (let i = 0; i <= levels; i++) {
    const y = Math.min(h, i * bay)
    for (let k = 0; k < 4; k++) {
      const [x1, z1] = corners[k]
      const [x2, z2] = corners[(k + 1) % 4]
      parts.push(beam(new Vector3(x1, y, z1), new Vector3(x2, y, z2), 0.32))
      if (i < levels) {
        // One diagonal per face per bay, alternating direction.
        const yTop = Math.min(h, y + bay)
        if (i % 2 === 0) parts.push(beam(new Vector3(x1, y, z1), new Vector3(x2, yTop, z2), 0.2))
        else parts.push(beam(new Vector3(x2, y, z2), new Vector3(x1, yTop, z1), 0.2))
      }
    }
  }
  // Crew access arm reaching to the rocket, and a mast on top.
  const armY = 58
  parts.push(beam(new Vector3(half, armY, 0), new Vector3(-TOWER.x - 2.2, armY, -TOWER.z), 1.6))
  parts.push(beam(new Vector3(0, h, 0), new Vector3(0, h + 14, 0), 0.4))
  const merged = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  return merged
}

/** Lightning-protection wires: catenaries between the mast tops. */
function createWireGeometry(): BufferGeometry {
  const points: number[] = []
  const tops = MASTS
  const sag = 22
  for (let k = 0; k < tops.length - 1; k++) {
    const [x1, z1] = tops[k]
    const [x2, z2] = tops[k + 1]
    const n = 32
    for (let i = 0; i < n; i++) {
      for (const j of [i, i + 1]) {
        const t = j / n
        // A parabola is a close stand-in for the catenary at this sag ratio.
        const y = MAST_HEIGHT - 4 * sag * t * (1 - t)
        points.push(x1 + (x2 - x1) * t, y, z1 + (z2 - z1) * t)
      }
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(points, 3))
  return g
}

/**
 * The launch complex: pad, launch mount, service tower, lightning masts and
 * floodlights. Positioned in the pad's local frame (y up, x east, z south).
 */
export function LaunchSite() {
  const assets = useMemo(() => {
    const concrete = new MeshStandardMaterial({ color: '#7a7f86', roughness: 0.95, metalness: 0 })
    const trench = new MeshStandardMaterial({ color: '#16191d', roughness: 1 })
    const steel = new MeshStandardMaterial({ color: '#3b424c', roughness: 0.6, metalness: 0.35 })
    const mast = new MeshStandardMaterial({ color: '#a7aeb8', roughness: 0.5, metalness: 0.3 })
    const lamp = new MeshStandardMaterial({ color: '#202428', emissive: '#e8f0ff', emissiveIntensity: 2.2 })
    const wire = new LineBasicMaterial({ color: '#6f7884', transparent: true, opacity: 0.5 })
    const tower = createTowerGeometry()
    const wires = createWireGeometry()
    const mastGeometry = new CylinderGeometry(0.25, 0.7, MAST_HEIGHT, 8)
    mastGeometry.translate(0, MAST_HEIGHT / 2, 0)
    return { concrete, trench, steel, mast, lamp, wire, tower, wires, mastGeometry }
  }, [])

  useEffect(
    () => () => {
      for (const value of Object.values(assets)) value.dispose()
    },
    [assets],
  )

  const lamps: Array<[number, number]> = [
    [34, 22],
    [-30, 26],
    [26, -34],
    [-34, -20],
  ]

  return (
    <group>
      {/* Pad and flame trench (the trench runs north–south). */}
      <mesh material={assets.concrete} position={[0, PAD_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[42, 46, PAD_HEIGHT, 8]} />
      </mesh>
      <mesh material={assets.trench} position={[0, PAD_HEIGHT + 0.02, 0]}>
        <boxGeometry args={[7, 0.05, 70]} />
      </mesh>
      {/* Launch mount: a frame the rocket stands on, open in the middle for the exhaust. */}
      {[-1, 1].map((side) => (
        <mesh key={side} material={assets.concrete} position={[side * 3.4, PAD_HEIGHT + MOUNT_HEIGHT / 2, 0]}>
          <boxGeometry args={[1.6, MOUNT_HEIGHT, 7]} />
        </mesh>
      ))}
      <mesh material={assets.steel} position={[0, PAD_HEIGHT + MOUNT_HEIGHT - 0.4, 0]}>
        <boxGeometry args={[8.4, 0.8, 7]} />
      </mesh>

      <mesh geometry={assets.tower} material={assets.steel} position={[TOWER.x, PAD_HEIGHT, TOWER.z]} />

      {MASTS.map(([x, z]) => (
        <mesh key={`${x},${z}`} geometry={assets.mastGeometry} material={assets.mast} position={[x, 0, z]} />
      ))}
      <lineSegments geometry={assets.wires} material={assets.wire} />

      {lamps.map(([x, z]) => (
        <mesh key={`${x},${z}`} material={assets.lamp} position={[x, 2.2, z]}>
          <boxGeometry args={[2.4, 1.6, 0.6]} />
        </mesh>
      ))}
    </group>
  )
}
