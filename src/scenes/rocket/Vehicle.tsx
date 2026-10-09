import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, CanvasTexture, Matrix4, SpriteMaterial, Vector3, type Group, type MeshStandardMaterial, type Sprite } from 'three'
import { ForceVector } from '../../components/three/ForceVector'
import { smoothstep } from '../../sim/core/math'
import { createVectorState, type VectorState } from '../../components/three/vectorState'
import { QUANTITY_COLORS } from '../../design/quantities'
import { Exhaust } from './Exhaust'
import { CENTRE_OF_MASS, RocketModel, type RocketMaterials } from './RocketModel'
import { useRocketScene } from './sceneState'

const LABEL_KEYS = ['thrust', 'weight', 'drag', 'pad', 'net', 'velocity'] as const

/** Fraction of the camera distance drawn for a force equal to the lift-off weight. */
const FORCE_SCALE = 0.11
/** Fraction of the camera distance drawn for 8 km/s. */
const VELOCITY_SCALE = 0.15

/** A soft white dot texture for the coasting-rocket marker. */
function createMarkerTexture(): CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.18, 'rgba(235,242,255,0.9)')
  g.addColorStop(0.45, 'rgba(160,190,240,0.25)')
  g.addColorStop(1, 'rgba(160,190,240,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

/**
 * From far away a coasting rocket is far smaller than a pixel. This marker
 * keeps a constant on-screen size so the rocket can still be followed.
 */
function RocketMarker() {
  const { state } = useRocketScene()
  const ref = useRef<Sprite>(null)
  const material = useMemo(() => new SpriteMaterial({ map: createMarkerTexture(), blending: AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }), [])
  useEffect(
    () => () => {
      material.map?.dispose()
      material.dispose()
    },
    [material],
  )
  useFrame(() => {
    const sprite = ref.current
    if (!sprite) return
    const far = smoothstep(2500, 12000, state.cameraDistance)
    const show = far * (state.throttle > 0 ? 0 : 1)
    sprite.visible = show > 0.01
    material.opacity = show
    const size = state.cameraDistance * 0.012
    sprite.scale.set(size, size, 1)
    sprite.position.copy(state.rocketPosition).addScaledVector(state.rocketAxis, CENTRE_OF_MASS)
  })
  return <sprite ref={ref} material={material} renderOrder={12} />
}

/**
 * The launch vehicle, its exhaust and its free-body diagram. Force arrows share
 * one scale (lift-off weight = a fixed fraction of the view), so their lengths
 * can be compared honestly; drag really is that small next to thrust.
 */
export function Vehicle() {
  const { sim, state, labels: labelRegistry } = useRocketScene()
  const rocketRef = useRef<Group>(null)
  const materialsRef = useRef<RocketMaterials | null>(null)

  const vectors = useMemo(
    () => ({
      thrust: createVectorState(),
      weight: createVectorState(),
      drag: createVectorState(),
      pad: createVectorState(),
      net: createVectorState(),
      velocity: createVectorState(),
    }),
    [],
  )
  const labels = useMemo(
    () => ({ thrust: new Vector3(), weight: new Vector3(), drag: new Vector3(), pad: new Vector3(), net: new Vector3(), velocity: new Vector3() }),
    [],
  )
  const tmp = useMemo(() => ({ m: new Matrix4(), x: new Vector3(), z: new Vector3(0, 0, 1), origin: new Vector3(), right: new Vector3(), dir: new Vector3() }), [])

  useFrame(({ camera, size }) => {
    const rocket = rocketRef.current
    if (!rocket) return
    const s = sim.live.value
    // Body axis in the trajectory plane; roll fixed so the vehicle never spins.
    tmp.x.crossVectors(state.rocketAxis, tmp.z).normalize()
    tmp.m.makeBasis(tmp.x, state.rocketAxis, tmp.z)
    rocket.quaternion.setFromRotationMatrix(tmp.m)
    rocket.position.copy(state.rocketPosition)

    const bell = materialsRef.current?.bell
    if (bell) (bell as MeshStandardMaterial).emissiveIntensity = state.throttle * 2.5

    // Free-body diagram beside the rocket, offset toward screen-right while the
    // rocket is large on screen; from far away the arrows sit on the rocket.
    const d = state.cameraDistance
    const close = smoothstep(6000, 900, d)
    tmp.right.setFromMatrixColumn(camera.matrixWorld, 0)
    tmp.origin.copy(state.rocketPosition).addScaledVector(state.rocketAxis, CENTRE_OF_MASS).addScaledVector(tmp.right, d * 0.055 * close)
    const refForce = Math.max(1, s.mass > 0 ? sim.flight.summary.initialMass * s.gravity : 1) / (0.6 + 0.4 * close)
    const thickness = d * 0.0035
    const em = state.emphasis
    const up = state.rocketUp

    const place = (v: VectorState, label: Vector3, dirX: number, dirY: number, magnitude: number, scale: number, opacity: number, min = 0) => {
      v.origin.copy(tmp.origin)
      v.direction.set(dirX, dirY, 0)
      const len = magnitude > 0 ? Math.max(min * d, (magnitude / scale) * FORCE_SCALE * d) : 0
      v.length = len
      v.thickness = thickness
      v.opacity = opacity
      tmp.dir.copy(v.direction).normalize()
      label.copy(v.origin).addScaledVector(tmp.dir, len + d * 0.025)
    }

    place(vectors.thrust, labels.thrust, s.thrustDirX, s.thrustDirY, s.thrust, refForce, em.thrust * (s.thrust > 0 ? 1 : 0))
    place(vectors.weight, labels.weight, -up.x, -up.y, s.weight, refForce, em.weight)
    const v = Math.max(s.speed, 1e-9)
    place(vectors.drag, labels.drag, -s.vx / v, -s.vy / v, s.drag, refForce, em.drag * (s.drag > 1 ? 1 : 0), 0.012)
    place(vectors.pad, labels.pad, up.x, up.y, s.padForce, refForce, em.pad * (s.padForce > 1 ? 1 : 0))
    place(vectors.net, labels.net, s.netForceX, s.netForceY, s.netForce, refForce, em.net * (s.netForce > 1 ? 1 : 0))
    // Velocity on its own scale, drawn from the nose.
    vectors.velocity.origin.copy(state.rocketPosition).addScaledVector(state.rocketAxis, 56)
    vectors.velocity.direction.set(s.vx, s.vy, 0)
    vectors.velocity.length = (s.speed / 8000) * VELOCITY_SCALE * d * (0.6 + 0.4 * close)
    vectors.velocity.thickness = thickness * 0.8
    vectors.velocity.opacity = em.velocity * (s.speed > 5 ? 1 : 0)
    labels.velocity.copy(vectors.velocity.origin).addScaledVector(tmp.dir.set(s.vx, s.vy, 0).normalize(), vectors.velocity.length + d * 0.035)

    // Offset the net-force arrow so it does not hide behind thrust.
    vectors.net.origin.addScaledVector(tmp.right, d * 0.035 * close)
    labels.net.addScaledVector(tmp.right, d * 0.035 * close)

    // Labels appear once their arrow is clearly visible, then follow its tip.
    for (const key of LABEL_KEYS) {
      const arrow = vectors[key]
      const target = labelRegistry.target(key)
      target.position.copy(labels[key])
      target.opacity = arrow.opacity > 0.35 && arrow.length > 0 ? Math.min(1, (arrow.opacity - 0.35) / 0.4) : 0
    }
    labelRegistry.update(camera, size.width, size.height)

  })

  return (
    <>
      <group ref={rocketRef}>
        <RocketModel materialsRef={materialsRef} />
        <Exhaust />
      </group>
      <RocketMarker />

      <ForceVector color={QUANTITY_COLORS.force} state={vectors.thrust} />
      <ForceVector color={QUANTITY_COLORS.gravity} state={vectors.weight} />
      <ForceVector color={QUANTITY_COLORS.drag} state={vectors.drag} />
      <ForceVector color={QUANTITY_COLORS.neutral} state={vectors.pad} />
      <ForceVector color={QUANTITY_COLORS.acceleration} state={vectors.net} />
      <ForceVector color={QUANTITY_COLORS.velocity} state={vectors.velocity} />

    </>
  )
}
