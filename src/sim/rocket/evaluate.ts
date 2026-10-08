/**
 * Looks up the flight at any mission time and derives every quantity the
 * visitor sees. Positions use cubic Hermite interpolation (exact for the
 * sampled positions and velocities); forces are recomputed from the
 * interpolated state with the same equations the integrator uses, so the
 * numbers on screen and the motion on screen always agree.
 */
import { airDensity, atmosphereLayer, speedOfSound, type AtmosphereLayer } from './atmosphere'
import { Phase, type Flight } from './flight'
import { orbitalElements, type OrbitalElements } from './orbit'
import { PLANET_RADIUS, referenceArea, STANDARD_GRAVITY } from './vehicle'

/** Seconds of countdown shown before ignition. */
export const COUNTDOWN = 10

export interface FlightState {
  /** Mission time (s); negative during the countdown. */
  t: number
  phase: Phase
  x: number
  y: number
  vx: number
  vy: number
  /** Total mass (kg). */
  mass: number
  propellant: number
  altitude: number
  speed: number
  /** Velocity component away from the planet's centre (m/s). */
  verticalSpeed: number
  /** Velocity component along the local horizontal, downrange (m/s). */
  horizontalSpeed: number
  /** Angle of the velocity above the local horizontal (rad). */
  flightPathAngle: number
  /** Distance travelled over the surface from the launch site (m). */
  downrange: number

  /** Thrust delivered (N) and its unit direction. */
  thrust: number
  thrustDirX: number
  thrustDirY: number
  /** Fraction of maximum thrust in use. */
  throttle: number
  /** Local gravitational acceleration magnitude μ/r² (m/s²). */
  gravity: number
  /** Weight m·g (N). */
  weight: number
  /** Supporting force from the pad while the rocket sits on it (N). */
  padForce: number
  /** Aerodynamic drag magnitude (N). */
  drag: number
  density: number
  layer: AtmosphereLayer
  /** Dynamic pressure q = ½ρv² (Pa). */
  dynamicPressure: number
  /** Mach number v/a (NaN without an atmosphere). */
  mach: number

  /** Net force vector and magnitude (N). */
  netForceX: number
  netForceY: number
  netForce: number
  /** Kinematic acceleration a = F_net/m (m/s²). */
  acceleration: number
  /** Felt acceleration (thrust + drag)/m in multiples of standard gravity. */
  gLoad: number

  /** Osculating Keplerian orbit: where gravity alone would take the rocket from here. */
  orbit: OrbitalElements
  /** True once the engines have burned out. */
  engineCutoff: boolean
  onPad: boolean
  landed: boolean
}

export function createFlightState(): FlightState {
  return {
    t: -COUNTDOWN,
    phase: Phase.Pad,
    x: 0,
    y: PLANET_RADIUS,
    vx: 0,
    vy: 0,
    mass: 0,
    propellant: 0,
    altitude: 0,
    speed: 0,
    verticalSpeed: 0,
    horizontalSpeed: 0,
    flightPathAngle: 0,
    downrange: 0,
    thrust: 0,
    thrustDirX: 0,
    thrustDirY: 1,
    throttle: 0,
    gravity: 0,
    weight: 0,
    padForce: 0,
    drag: 0,
    density: 0,
    layer: atmosphereLayer(0),
    dynamicPressure: 0,
    mach: 0,
    netForceX: 0,
    netForceY: 0,
    netForce: 0,
    acceleration: 0,
    gLoad: 0,
    orbit: orbitalElements(0, PLANET_RADIUS, 1, 0, 1),
    engineCutoff: false,
    onPad: true,
    landed: false,
  }
}

/** Index i with t[i] ≤ time < t[i + 1] (clamped to the sample range). */
export function findSampleIndex(times: Float64Array, count: number, time: number): number {
  if (time <= times[0]) return 0
  if (time >= times[count - 1]) return count - 1
  let lo = 0
  let hi = count - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (times[mid] <= time) lo = mid
    else hi = mid
  }
  return lo
}

/** Fills `out` with the state of `flight` at mission time `time`. */
export function evaluateFlight(flight: Flight, time: number, out: FlightState): FlightState {
  const s = flight.samples
  const R = PLANET_RADIUS
  const mu = flight.summary.mu
  const maxThrust = flight.params.thrust
  const dryMass = flight.params.dryMass
  out.t = time

  let x: number
  let y: number
  let vx: number
  let vy: number
  let m: number
  let tx: number
  let ty: number
  let phase: Phase

  if (time < 0) {
    // Countdown: fuelled, on the pad, engines off.
    x = 0
    y = R
    vx = 0
    vy = 0
    m = flight.summary.initialMass
    tx = 0
    ty = 0
    phase = Phase.Pad
  } else {
    const i = findSampleIndex(s.t, s.count, time)
    const j = Math.min(i + 1, s.count - 1)
    const t0 = s.t[i]
    const dt = s.t[j] - t0
    if (j === i || dt <= 0 || time >= s.t[j]) {
      const k = time >= s.t[j] ? j : i
      x = s.x[k]
      y = s.y[k]
      vx = s.vx[k]
      vy = s.vy[k]
      m = s.m[k]
      tx = s.thrustX[k]
      ty = s.thrustY[k]
      phase = s.phase[k] as Phase
    } else {
      const u = (time - t0) / dt
      // Cubic Hermite basis for position, using the sampled velocities as tangents.
      const u2 = u * u
      const u3 = u2 * u
      const h00 = 2 * u3 - 3 * u2 + 1
      const h10 = u3 - 2 * u2 + u
      const h01 = -2 * u3 + 3 * u2
      const h11 = u3 - u2
      x = h00 * s.x[i] + h10 * dt * s.vx[i] + h01 * s.x[j] + h11 * dt * s.vx[j]
      y = h00 * s.y[i] + h10 * dt * s.vy[i] + h01 * s.y[j] + h11 * dt * s.vy[j]
      vx = s.vx[i] + (s.vx[j] - s.vx[i]) * u
      vy = s.vy[i] + (s.vy[j] - s.vy[i]) * u
      m = s.m[i] + (s.m[j] - s.m[i]) * u
      // Thrust is held over each guidance step, like the flight computer's command.
      tx = s.thrustX[i]
      ty = s.thrustY[i]
      phase = s.phase[i] as Phase
    }
  }

  if (phase === Phase.Landed) {
    vx = 0
    vy = 0
  }

  const r = Math.sqrt(x * x + y * y)
  const upX = x / r
  const upY = y / r
  const speed = Math.sqrt(vx * vx + vy * vy)
  const altitude = r - R
  const landed = phase === Phase.Landed
  const onPad = phase === Phase.Pad

  out.phase = phase
  out.x = x
  out.y = y
  out.vx = vx
  out.vy = vy
  out.mass = m
  out.propellant = Math.max(0, m - dryMass)
  out.altitude = Math.max(0, altitude)
  out.speed = speed
  out.verticalSpeed = vx * upX + vy * upY
  out.horizontalSpeed = vx * upY - vy * upX
  out.flightPathAngle = speed > 1e-6 ? Math.asin(Math.max(-1, Math.min(1, out.verticalSpeed / speed))) : Math.PI / 2
  out.downrange = R * Math.atan2(x, y)
  out.onPad = onPad
  out.landed = landed
  out.engineCutoff = flight.events.meco !== null && time >= flight.events.meco.t

  // Thrust: the stored vector is direction × throttle.
  const throttle = Math.sqrt(tx * tx + ty * ty)
  out.throttle = throttle
  out.thrust = throttle * maxThrust
  if (throttle > 1e-9) {
    out.thrustDirX = tx / throttle
    out.thrustDirY = ty / throttle
  } else {
    out.thrustDirX = upX
    out.thrustDirY = upY
  }

  // Gravity and weight.
  const g = mu / (r * r)
  out.gravity = g
  out.weight = m * g

  // Atmosphere.
  const dragOn = flight.params.drag
  const rho = dragOn ? airDensity(out.altitude) : 0
  out.density = rho
  out.layer = atmosphereLayer(out.altitude)
  out.dynamicPressure = 0.5 * rho * speed * speed
  out.drag = out.dynamicPressure * flight.vehicle.dragCoefficient * referenceArea(flight.vehicle)
  out.mach = dragOn ? speed / speedOfSound(out.altitude) : Number.NaN

  // Net force = thrust + weight + drag (+ the pad's support while on it).
  let fx = out.thrust * out.thrustDirX - out.weight * upX
  let fy = out.thrust * out.thrustDirY - out.weight * upY
  if (speed > 1e-9) {
    fx -= (out.drag * vx) / speed
    fy -= (out.drag * vy) / speed
  }
  out.padForce = 0
  if (onPad || landed) {
    // The ground pushes back exactly enough to stop the rocket sinking.
    const support = Math.max(0, -(fx * upX + fy * upY))
    out.padForce = support
    fx += support * upX
    fy += support * upY
  }
  out.netForceX = fx
  out.netForceY = fy
  out.netForce = Math.sqrt(fx * fx + fy * fy)
  out.acceleration = out.netForce / m

  // Felt acceleration: everything except gravity (the pad's push counts — you feel it).
  const feltX = fx + out.weight * upX
  const feltY = fy + out.weight * upY
  out.gLoad = Math.sqrt(feltX * feltX + feltY * feltY) / m / STANDARD_GRAVITY

  out.orbit = orbitalElements(x, y, speed > 1e-9 ? vx : 1e-9 * upY, speed > 1e-9 ? vy : -1e-9 * upX, mu)
  return out
}
