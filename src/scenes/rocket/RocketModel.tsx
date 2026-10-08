import { useEffect, useMemo, type Ref, type RefObject } from 'react'
import { DoubleSide, LatheGeometry, MeshStandardMaterial, Vector2, type Group } from 'three'
import { VEHICLE } from '../../sim/rocket/vehicle'

const RADIUS = VEHICLE.diameter / 2
/** Height of the nozzle exit plane below the rocket's base (m). */
export const NOZZLE_EXIT = -2.3
/** Where force vectors attach: roughly the centre of mass of a fuelled rocket. */
export const CENTRE_OF_MASS = 21
export const NOSE_HEIGHT = VEHICLE.height

/** Body profile (radius, height) from the base to the tip of the fairing. */
function bodyProfile(): Vector2[] {
  const fairingRadius = 2.1
  const fairingBase = 47.6
  const ogiveStart = 50.8
  const tip = VEHICLE.height
  const pts = [new Vector2(0, 0), new Vector2(RADIUS, 0), new Vector2(RADIUS, 46.6), new Vector2(fairingRadius, fairingBase), new Vector2(fairingRadius, ogiveStart)]
  // Tangent ogive nose: y(x) = √(ρ² − (L − x)²) + R − ρ, with x measured from the tip.
  const L = tip - ogiveStart
  const rho = (fairingRadius ** 2 + L ** 2) / (2 * fairingRadius)
  const steps = 16
  for (let i = 1; i <= steps; i++) {
    const xFromTip = L * (1 - i / steps)
    const r = Math.max(0, Math.sqrt(rho * rho - (L - xFromTip) ** 2) + fairingRadius - rho)
    pts.push(new Vector2(i === steps ? 0 : r, tip - xFromTip))
  }
  return pts
}

function bellProfile(): Vector2[] {
  return [new Vector2(0.17, 0), new Vector2(0.22, -0.35), new Vector2(0.34, -0.95), new Vector2(0.45, -1.6), new Vector2(0.52, -2.05), new Vector2(0.55, -2.3)]
}

/** Seven engines: one in the centre and six in a ring. */
const ENGINE_POSITIONS: Array<[number, number]> = [[0, 0], ...Array.from({ length: 6 }, (_, i): [number, number] => [1.15 * Math.cos((i * Math.PI) / 3), 1.15 * Math.sin((i * Math.PI) / 3)])]

export interface RocketMaterials {
  /** Engine bells glow while firing; set emissiveIntensity per frame. */
  bell: MeshStandardMaterial
}

/**
 * Procedural launch vehicle at true scale: 56 m tall, 3.7 m diameter, seven
 * engines. Local origin at the base, +y along the body.
 */
export function RocketModel({ ref, materialsRef }: { ref?: Ref<Group>; materialsRef?: RefObject<RocketMaterials | null> }) {
  const assets = useMemo(() => {
    const body = new LatheGeometry(bodyProfile(), 48)
    const bell = new LatheGeometry(bellProfile(), 24)
    const white = new MeshStandardMaterial({ color: '#e9e7e2', roughness: 0.48, metalness: 0.05 })
    const dark = new MeshStandardMaterial({ color: '#1a1e25', roughness: 0.55, metalness: 0.2 })
    const bellMat = new MeshStandardMaterial({ color: '#4a4f57', roughness: 0.35, metalness: 0.75, emissive: '#ff7a2e', emissiveIntensity: 0, side: DoubleSide })
    return { body, bell, white, dark, bellMat }
  }, [])

  useEffect(() => {
    if (materialsRef) materialsRef.current = { bell: assets.bellMat }
  }, [assets, materialsRef])

  useEffect(
    () => () => {
      for (const value of Object.values(assets)) value.dispose()
    },
    [assets],
  )

  return (
    <group ref={ref}>
      <mesh geometry={assets.body} material={assets.white} />
      {/* Engine section, tank-dome band and interstage in carbon black. */}
      <mesh material={assets.dark} position={[0, 1.4, 0]}>
        <cylinderGeometry args={[RADIUS + 0.02, RADIUS + 0.02, 2.8, 48, 1, true]} />
      </mesh>
      <mesh material={assets.dark} position={[0, 30.5, 0]}>
        <cylinderGeometry args={[RADIUS + 0.015, RADIUS + 0.015, 0.7, 48, 1, true]} />
      </mesh>
      <mesh material={assets.dark} position={[0, 45.2, 0]}>
        <cylinderGeometry args={[RADIUS + 0.02, RADIUS + 0.02, 2.8, 48, 1, true]} />
      </mesh>
      {ENGINE_POSITIONS.map(([x, z], i) => (
        <mesh key={i} geometry={assets.bell} material={assets.bellMat} position={[x, 0, z]} />
      ))}
    </group>
  )
}
