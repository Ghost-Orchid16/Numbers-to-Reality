import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { FogExp2, Object3D, Vector3, type DirectionalLight, type HemisphereLight, type PerspectiveCamera, type PointLight } from 'three'
import { EarthGlobe } from '../../components/three/earth/EarthGlobe'
import { launchFrameRotation } from '../../components/three/earth/geo'
import type { LabelRegistry } from '../../components/three/labelRegistry'
import { detectQuality } from '../../hooks/useQuality'
import { BEATS, beatAt, timeAtProgress, type CameraShot, type Emphasis } from '../../chapters/rocket/timeline'
import { damp, smoothstep } from '../../sim/core/math'
import { airDensity, SEA_LEVEL_DENSITY } from '../../sim/rocket/atmosphere'
import type { RocketSimulation } from '../../sim/rocket/RocketSimulation'
import { PLANET_RADIUS } from '../../sim/rocket/vehicle'
import { LAUNCH_SITE, skyBrightness, sunlight, SUN_DIRECTION } from './environment'
import { FlightPaths } from './FlightPaths'
import { GroundCap } from './GroundCap'
import { LaunchSite, ROCKET_BASE_HEIGHT } from './LaunchSite'
import { CENTRE_OF_MASS, NOZZLE_EXIT } from './RocketModel'
import { createSceneState, RocketSceneCtx, useRocketScene } from './sceneState'
import { Sky } from './Sky'
import { Smoke } from './Smoke'
import { Vehicle } from './Vehicle'

const R = PLANET_RADIUS
const PAD = new Vector3(0, R, 0)
const Z = new Vector3(0, 0, 1)
const WORLD_UP = new Vector3(0, 1, 0)
const DEG = Math.PI / 180

export interface RocketSceneControls {
  /** Scroll progress through the chapter, 0–1 (written by the chapter). */
  progress: number
  /** Camera shot used while the lab beat is active. */
  labShot: CameraShot
  /** Where to frame the subject, as a fraction of the viewport (0 = centred). */
  framingX: number
  framingY: number
  reducedMotion: boolean
}

interface ShotParams {
  pad: number
  rocket: number
  planet: number
  logDistance: number
  azimuth: number
  elevation: number
  lift: number
}

function toParams(shot: CameraShot): ShotParams {
  return {
    pad: shot.anchor === 'pad' ? 1 : 0,
    rocket: shot.anchor === 'rocket' ? 1 : 0,
    planet: shot.anchor === 'planet' ? 1 : 0,
    logDistance: Math.log(shot.distance),
    azimuth: shot.azimuth,
    elevation: shot.elevation,
    lift: shot.lift,
  }
}

function blendParams(a: ShotParams, b: ShotParams, t: number, out: ShotParams): ShotParams {
  for (const key of Object.keys(out) as Array<keyof ShotParams>) out[key] = a[key] + (b[key] - a[key]) * t
  return out
}

function blendEmphasis(a: Emphasis, b: Emphasis, t: number, out: Emphasis) {
  for (const key of Object.keys(out) as Array<keyof Emphasis>) out[key] = a[key] + (b[key] - a[key]) * t
}

/** Runs before everything else each frame: scroll → mission time → physics → derived visuals → camera. */
function Driver({ sim, controls, sceneState }: { sim: RocketSimulation; controls: RefObject<RocketSceneControls>; sceneState: ReturnType<typeof createSceneState> }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const memo = useMemo(
    () => ({
      progress: 0,
      current: toParams(BEATS[0].shot),
      goal: toParams(BEATS[0].shot),
      emphasisGoal: { ...BEATS[0].emphasis },
      target: new Vector3(),
      anchor: new Vector3(),
      up: new Vector3(),
      down: new Vector3(),
      dir: new Vector3(),
      tmp: new Vector3(),
      axisGoal: new Vector3(0, 1, 0),
      framing: [Number.NaN, Number.NaN, 0, 0],
      initialised: false,
    }),
    [],
  )

  useFrame((_, rawDt) => {
    const c = controls.current
    const dt = Math.min(rawDt, 0.1)
    const m = memo
    const instant = !m.initialised || c.reducedMotion

    // ── Scroll → mission time ───────────────────────────────────────────
    m.progress = instant ? c.progress : damp(m.progress, c.progress, 7, dt)
    const { index, local } = beatAt(m.progress)
    const beat = BEATS[index]
    if (beat.id === 'lab') {
      sim.setDriver('clock')
    } else {
      sim.setDriver('scroll')
      const t = timeAtProgress(sim.flight, m.progress)
      if (t !== null) sim.setPlayhead(t)
    }
    sim.update(dt)
    const s = sim.live.value

    // ── Rocket placement and attitude ───────────────────────────────────
    const st = sceneState
    st.time = s.t
    st.rocketUp.set(s.x, s.y, 0).normalize()
    st.rocketPosition.set(s.x, s.y, 0).addScaledVector(st.rocketUp, ROCKET_BASE_HEIGHT)
    if (s.onPad || s.landed) m.axisGoal.copy(st.rocketUp)
    else if (s.thrust > 0) m.axisGoal.set(s.thrustDirX, s.thrustDirY, 0)
    else if (s.speed > 1) m.axisGoal.set(s.vx, s.vy, 0).normalize()
    st.rocketAxis.lerp(m.axisGoal, instant ? 1 : 1 - Math.exp(-8 * dt)).normalize()
    st.throttle = s.thrust > 0 ? s.throttle : 0
    st.plumeExpansion = sim.params.get().drag ? 1 - Math.pow(airDensity(s.altitude) / SEA_LEVEL_DENSITY, 0.35) : 1
    m.tmp.copy(st.rocketPosition).addScaledVector(st.rocketAxis, CENTRE_OF_MASS)
    st.rocketSunlight = sunlight(m.tmp.x, m.tmp.y, m.tmp.z)
    st.rocketSky = skyBrightness(s.altitude)

    // ── Camera shot for this beat ───────────────────────────────────────
    const goalShot = beat.id === 'lab' ? c.labShot : beat.shot
    const prevShot = index > 0 && beat.id !== 'lab' ? BEATS[index - 1].shot : goalShot
    const k = smoothstep(0, 0.45, local)
    blendParams(toParams(prevShot), toParams(goalShot), k, m.goal)
    const prevEmphasis = index > 0 ? BEATS[index - 1].emphasis : beat.emphasis
    blendEmphasis(prevEmphasis, beat.emphasis, smoothstep(0, 0.3, local), m.emphasisGoal)
    for (const key of Object.keys(m.current) as Array<keyof ShotParams>) {
      m.current[key] = instant ? m.goal[key] : damp(m.current[key], m.goal[key], 4, dt)
    }
    for (const key of Object.keys(st.emphasis) as Array<keyof Emphasis>) {
      st.emphasis[key] = instant ? m.emphasisGoal[key] : damp(st.emphasis[key], m.emphasisGoal[key], 4, dt)
    }

    // Resolve the look-at point. Anchors are blended around the rocket, and
    // each anchor's pull is limited so the target never moves further from
    // the rocket than the camera is from its subject: blending linearly
    // toward a planet centre 6,571 km away would otherwise swing the view off
    // the rocket in mid-transition.
    const p = m.current
    const wsum = p.pad + p.rocket + p.planet || 1
    const distance = Math.exp(p.logDistance)
    const rocketCentre = m.tmp.copy(st.rocketPosition).addScaledVector(st.rocketAxis, CENTRE_OF_MASS)
    m.anchor.copy(rocketCentre)
    const padSeparation = PAD.distanceTo(rocketCentre)
    const padPull = (p.pad / wsum) * Math.min(1, distance / Math.max(padSeparation, 1))
    m.anchor.addScaledVector(m.dir.copy(PAD).sub(rocketCentre), padPull)
    const planetSeparation = rocketCentre.length()
    const planetW = (p.planet / wsum) * Math.min(1, distance / planetSeparation)
    m.anchor.addScaledVector(rocketCentre, -planetW)
    st.planetView = planetW
    const anchorLength = m.anchor.length()
    m.up.copy(anchorLength > 1 ? m.tmp.copy(m.anchor).divideScalar(anchorLength) : WORLD_UP)
    m.up.lerp(WORLD_UP, planetW).normalize()
    m.down.set(m.up.y, -m.up.x, 0).normalize() // local downrange
    const az = p.azimuth * DEG
    const el = p.elevation * DEG
    m.dir
      .copy(Z)
      .multiplyScalar(Math.cos(az))
      .addScaledVector(m.down, Math.sin(az))
      .multiplyScalar(Math.cos(el))
      .addScaledVector(m.up, Math.sin(el))
    m.target.copy(m.anchor).addScaledVector(m.up, p.lift * distance)
    camera.position.copy(m.target).addScaledVector(m.dir, distance)
    camera.up.copy(m.up)
    camera.lookAt(m.target)
    camera.near = Math.max(0.5, distance * 0.001)
    camera.far = 1e10
    st.cameraDistance = distance
    st.cameraAltitude = camera.position.length() - R

    // Frame the subject away from the narrative column.
    const fx = c.framingX
    const fy = c.framingY
    if (fx !== m.framing[0] || fy !== m.framing[1] || size.width !== m.framing[2] || size.height !== m.framing[3]) {
      m.framing = [fx, fy, size.width, size.height]
      if (fx === 0 && fy === 0) camera.clearViewOffset()
      else camera.setViewOffset(size.width, size.height, -fx * size.width, -fy * size.height, size.width, size.height)
    }
    camera.updateProjectionMatrix()
    m.initialised = true
  }, -1)

  return null
}

/**
 * A spotlight with its target placed in the scene graph (a target outside the
 * graph never updates its world matrix and the light points at the origin).
 */
function Floodlight({ position, aim, intensity, angle = 0.42 }: { position: [number, number, number]; aim: [number, number, number]; intensity: number; angle?: number }) {
  const target = useMemo(() => new Object3D(), [])
  return (
    <>
      <primitive object={target} position={aim} />
      <spotLight position={position} target={target} color="#dfe8ff" intensity={intensity} angle={angle} penumbra={0.7} distance={500} decay={2} />
    </>
  )
}

/** Scene lights driven by the frame state: twilight sky, the Sun above the Earth's shadow, the engines. */
function Lights() {
  const { state } = useRocketScene()
  const hemiRef = useRef<HemisphereLight>(null)
  const sunRef = useRef<DirectionalLight>(null)
  const plumeRef = useRef<PointLight>(null)
  const sunTarget = useMemo(() => new Object3D(), [])

  useFrame(() => {
    const hemi = hemiRef.current
    const sun = sunRef.current
    const plume = plumeRef.current
    if (!hemi || !sun || !plume) return
    hemi.intensity = 0.5 + 1.5 * state.rocketSky
    sun.intensity = 2.6 * state.rocketSunlight
    sunTarget.position.copy(state.rocketPosition)
    sunTarget.updateMatrixWorld()
    sun.position.copy(state.rocketPosition).addScaledVector(SUN_DIRECTION, 2000)
    plume.position.copy(state.rocketPosition).addScaledVector(state.rocketAxis, NOZZLE_EXIT - 6)
    plume.intensity = 45_000 * state.throttle
  })

  return (
    <>
      <hemisphereLight ref={hemiRef} args={['#5f7aa8', '#14110e', 1]} />
      <primitive object={sunTarget} />
      <directionalLight ref={sunRef} color="#fff1dc" intensity={0} target={sunTarget} />
      <pointLight ref={plumeRef} color="#ffae63" intensity={0} distance={6000} decay={2} />
      {/* Floodlights on the pad, aimed up the rocket. */}
      <group position={[0, R, 0]}>
        <Floodlight position={[34, 3, 22]} aim={[0, 30, 0]} intensity={4500} />
        <Floodlight position={[-30, 3, 26]} aim={[0, 34, 0]} intensity={3500} />
        {/* A high light washing the pad itself. */}
        <Floodlight position={[60, 70, 90]} aim={[0, 0, 0]} intensity={26000} angle={0.5} />
      </group>
    </>
  )
}

function Atmospherics() {
  const scene = useThree((s) => s.scene)
  const { state } = useRocketScene()
  const fog = useMemo(() => new FogExp2('#111a2b', 0), [])
  useEffect(() => {
    scene.fog = fog
    return () => {
      scene.fog = null
    }
  }, [scene, fog])
  useFrame(() => {
    // Haze thins with the air around the camera.
    fog.density = 2.4e-5 * skyBrightness(state.cameraAltitude)
  })
  return null
}

interface RocketSceneProps {
  sim: RocketSimulation
  controls: RefObject<RocketSceneControls>
  labels: LabelRegistry
}

export function RocketScene({ sim, controls, labels }: RocketSceneProps) {
  const sceneState = useMemo(() => createSceneState(), [])
  const ctx = useMemo(() => ({ sim, state: sceneState, labels }), [sim, sceneState, labels])
  const rotation = useMemo(() => launchFrameRotation(LAUNCH_SITE.latitude, LAUNCH_SITE.longitude), [])
  const quality = useMemo(() => detectQuality(), [])
  useEffect(() => {
    // Development aid: inspect the live simulation and frame state from the console.
    if (import.meta.env.DEV) (window as unknown as { rocketDebug?: unknown }).rocketDebug = { sim, state: sceneState }
  }, [sim, sceneState])
  const smokeCount = Math.round(720 * quality.particles)

  const groundState = useMemo(() => ({ opacity: 1, grid: 1, glow: 0, glowHeight: 0, ambient: 1 }), [])
  useFrame(() => {
    const s = sceneState
    const alt = s.cameraAltitude
    groundState.opacity = 1 - smoothstep(120_000, 450_000, alt)
    groundState.grid = 1 - smoothstep(4_000, 30_000, alt)
    // Engines light the ground while the rocket is low.
    const rocketAlt = sim.live.value.altitude
    groundState.glow = s.throttle * 2.2 * Math.exp(-rocketAlt / 350)
    groundState.glowHeight = rocketAlt
    groundState.ambient = 0.55 + 0.6 * s.rocketSky
  })

  return (
    <RocketSceneCtx.Provider value={ctx}>
      <Driver sim={sim} controls={controls} sceneState={sceneState} />
      <Atmospherics />
      <Sky starCount={Math.round(2200 * Math.max(0.5, quality.particles))} />
      <EarthGlobe radius={R} rotation={rotation} sunDirection={SUN_DIRECTION} opacity={() => smoothstep(12_000, 60_000, sceneState.cameraAltitude)} />
      <GroundCap rotation={rotation} state={groundState} />
      <group position={[0, R, 0]}>
        <LaunchSite />
      </group>
      <Smoke count={smokeCount} />
      <FlightPaths />
      <Vehicle />
      <Lights />
    </RocketSceneCtx.Provider>
  )
}
