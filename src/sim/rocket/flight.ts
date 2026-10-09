/**
 * Rocket flight model: a point mass moving in the plane of its trajectory,
 * in an inertial frame centred on the planet.
 *
 *   m·a = T·û + m·g(r) + D
 *
 *   gravity  g(r) = −μ·r / |r|³               (inverse square, μ = g₀R²)
 *   drag     D    = −½·ρ(h)·|v|·v·C_D·A        (opposes the velocity)
 *   mass     dm/dt = −T / vₑ                   (propellant mass flow)
 *
 * Coordinates: the launch site is at (0, R) and +x points downrange (east),
 * so the rocket travels clockwise when viewed from +z. The planet does not
 * rotate and there is no wind.
 *
 * Guidance (where the engine points, and how hard it pushes):
 *   1. vertical rise until the rocket clears the tower,
 *   2. pitch-over: tilt the thrust by the pitch-over angle,
 *   3. gravity turn: thrust along the velocity while the air is thick, so the
 *      rocket never flies sideways into the wind and gravity bends the path,
 *   4. (guidance computer on) closed-loop steering once the air is thin:
 *      every 0.1 s it solves for the vertical acceleration that brings the
 *      vertical speed to zero exactly at the target altitude, throttles to keep
 *      the felt acceleration under 4 g, and cuts the engine when the rocket
 *      has the energy of a circular orbit at that altitude.
 * With the guidance computer off, the engine burns at full thrust until the
 * propellant runs out and only the pitch-over angle shapes the path.
 *
 * The whole flight is integrated ahead of time with RK4 — fast enough to redo
 * every frame while a slider moves — so any moment can be looked up directly.
 */
import { RK4 } from '../core/integrators'
import { DEG } from '../core/math'
import { airDensity, speedOfSound } from './atmosphere'
import { orbitalElements, type OrbitalElements } from './orbit'
import type { RocketParams } from './params'
import { KARMAN_LINE, PLANET_RADIUS, referenceArea, STANDARD_GRAVITY, VEHICLE, type VehicleSpec } from './vehicle'

/** Guidance phase of a sample. */
export const Phase = {
  Pad: 0,
  Vertical: 1,
  Pitchover: 2,
  GravityTurn: 3,
  Guided: 4,
  Coast: 5,
  Landed: 6,
} as const
export type Phase = (typeof Phase)[keyof typeof Phase]

export type OutcomeKind = 'no-liftoff' | 'crash' | 'suborbital' | 'decaying-orbit' | 'orbit' | 'escape'

export interface FlightOutcome {
  kind: OutcomeKind
  /** Osculating orbit at engine cutoff (null if the engines never cut off in flight). */
  elements: OrbitalElements | null
  /** Periapsis and apoapsis altitudes above the surface (m). */
  periapsisAltitude: number
  apoapsisAltitude: number
}

export interface FlightEvents {
  liftoff: number | null
  pitchover: number | null
  mach1: { t: number; altitude: number } | null
  maxQ: { t: number; altitude: number; q: number; speed: number } | null
  /** Closed-loop guidance takes over. */
  guidance: { t: number; altitude: number } | null
  /** Throttling begins to hold the g-limit. */
  throttle: { t: number } | null
  karman: { t: number } | null
  meco: { t: number; altitude: number; speed: number; flightPathAngle: number; propellantLeft: number } | null
  apoapsis: { t: number; altitude: number } | null
  impact: { t: number; downrange: number; speed: number } | null
}

export interface FlightSummary {
  initialMass: number
  /** Mass flow at full thrust (kg/s). */
  massFlow: number
  /** Time to burn all propellant at full thrust (s). */
  fullThrustBurnTime: number
  /** Thrust-to-weight ratio on the pad at ignition. */
  thrustToWeight: number
  /** Ideal Δv from the rocket equation, vₑ·ln(m₀/m_f). */
  idealDeltaV: number
  /** Gravitational parameter μ = g₀R². */
  mu: number
  /** Largest felt (non-gravitational) acceleration during the burn, in g. */
  maxGLoad: number
}

export interface Flight {
  params: RocketParams
  vehicle: VehicleSpec
  samples: SampleBuffer
  events: FlightEvents
  outcome: FlightOutcome
  summary: FlightSummary
  /** Last sampled time (s). */
  endTime: number
}

/** Struct-of-arrays storage for trajectory samples, reusable between solves. */
export class SampleBuffer {
  count = 0
  t: Float64Array
  x: Float64Array
  y: Float64Array
  vx: Float64Array
  vy: Float64Array
  m: Float64Array
  /** Thrust vector divided by its maximum: direction × throttle (zero when off). */
  thrustX: Float64Array
  thrustY: Float64Array
  phase: Uint8Array

  constructor(capacity = 8192) {
    this.t = new Float64Array(capacity)
    this.x = new Float64Array(capacity)
    this.y = new Float64Array(capacity)
    this.vx = new Float64Array(capacity)
    this.vy = new Float64Array(capacity)
    this.m = new Float64Array(capacity)
    this.thrustX = new Float64Array(capacity)
    this.thrustY = new Float64Array(capacity)
    this.phase = new Uint8Array(capacity)
  }

  get capacity(): number {
    return this.t.length
  }

  clear(): void {
    this.count = 0
  }

  push(t: number, x: number, y: number, vx: number, vy: number, m: number, thrustX: number, thrustY: number, phase: Phase): void {
    if (this.count === this.capacity) this.grow()
    const i = this.count++
    this.t[i] = t
    this.x[i] = x
    this.y[i] = y
    this.vx[i] = vx
    this.vy[i] = vy
    this.m[i] = m
    this.thrustX[i] = thrustX
    this.thrustY[i] = thrustY
    this.phase[i] = phase
  }

  private grow(): void {
    const size = this.capacity * 2
    const growF = (a: Float64Array) => {
      const b = new Float64Array(size)
      b.set(a)
      return b
    }
    this.t = growF(this.t)
    this.x = growF(this.x)
    this.y = growF(this.y)
    this.vx = growF(this.vx)
    this.vy = growF(this.vy)
    this.m = growF(this.m)
    this.thrustX = growF(this.thrustX)
    this.thrustY = growF(this.thrustY)
    const p = new Uint8Array(size)
    p.set(this.phase)
    this.phase = p
  }
}

export interface FlightOptions {
  /** Integration and guidance-update step during powered flight (s). */
  poweredStep?: number
  /** Longest coast to simulate after engine cutoff (s). */
  maxCoast?: number
  /** Reuse an existing buffer to avoid reallocating every solve. */
  buffer?: SampleBuffer
}

export function simulateFlight(params: RocketParams, vehicle: VehicleSpec = VEHICLE, options: FlightOptions = {}): Flight {
  const R = PLANET_RADIUS
  const mu = params.surfaceGravity * R * R
  const maxThrust = params.thrust
  const ve = vehicle.exhaustVelocity
  const fullMassFlow = maxThrust / ve
  const m0 = params.dryMass + params.propellantMass
  const mDry = params.dryMass
  const dragArea = vehicle.dragCoefficient * referenceArea(vehicle)
  const dragOn = params.drag
  const guided = params.guidance
  const kick = params.pitchKick * DEG
  const gLimitAccel = vehicle.gLimit * STANDARD_GRAVITY
  const targetAltitude = vehicle.targetAltitude
  const poweredStep = options.poweredStep ?? 0.2
  const maxCoast = options.maxCoast ?? 4 * 3600

  const targetRadius = R + targetAltitude
  const targetEnergy = -mu / (2 * targetRadius)
  const targetCircularSpeed = Math.sqrt(mu / targetRadius)

  const samples = options.buffer ?? new SampleBuffer()
  samples.clear()

  const events: FlightEvents = {
    liftoff: null,
    pitchover: null,
    mach1: null,
    maxQ: null,
    guidance: null,
    throttle: null,
    karman: null,
    meco: null,
    apoapsis: null,
    impact: null,
  }

  const summary: FlightSummary = {
    initialMass: m0,
    massFlow: fullMassFlow,
    fullThrustBurnTime: params.propellantMass / fullMassFlow,
    thrustToWeight: maxThrust / (m0 * params.surfaceGravity),
    idealDeltaV: ve * Math.log(m0 / mDry),
    mu,
    maxGLoad: 0,
  }

  const flight: Flight = {
    params,
    vehicle,
    samples,
    events,
    outcome: { kind: 'no-liftoff', elements: null, periapsisAltitude: Number.NaN, apoapsisAltitude: Number.NaN },
    summary,
    endTime: 0,
  }

  /** Thrust actually delivered at mass m: full thrust, or less when holding the g-limit. */
  const thrustAt = (m: number) => (guided ? Math.min(maxThrust, m * gLimitAccel) : maxThrust)

  /** Mass below which the g-limit forces throttling. */
  const throttleMass = guided ? maxThrust / gLimitAccel : 0

  /** Burn time needed to gain Δv starting from mass m (two-segment rocket equation). */
  const burnTimeForDeltaV = (m: number, dv: number): number => {
    let t = 0
    let mass = m
    let remaining = dv
    if (mass > throttleMass) {
      // Full thrust: Δv = vₑ·ln(m/m₁)  ⇒  m₁ = m·e^(−Δv/vₑ), t = (m − m₁)/ṁ
      const dvFull = ve * Math.log(mass / Math.max(throttleMass, mDry))
      const dvHere = Math.min(remaining, dvFull)
      const m1 = mass * Math.exp(-dvHere / ve)
      t += (mass - m1) / fullMassFlow
      remaining -= dvHere
      mass = m1
    }
    // Throttled: constant acceleration n·g₀.
    if (remaining > 0 && guided) t += remaining / gLimitAccel
    return t
  }

  /** Time until the propellant runs out, starting from mass m. */
  const burnTimeToEmpty = (m: number): number => {
    if (!guided || throttleMass <= mDry) return (m - mDry) / fullMassFlow
    let t = 0
    let mass = m
    if (mass > throttleMass) {
      t += (mass - throttleMass) / fullMassFlow
      mass = throttleMass
    }
    // Throttled: m(t) = m·e^(−n·g₀·t/vₑ)  ⇒  t = (vₑ/(n·g₀))·ln(m/m_dry)
    return t + (ve / gLimitAccel) * Math.log(mass / mDry)
  }

  // ── Pad phase (exact) ────────────────────────────────────────────────────
  // The engines ignite at t = 0. The pad holds the rocket up until the thrust
  // exceeds the weight, T > m(t)·g, which happens once enough propellant is
  // gone. (If the g-limit throttles at ignition, T/W is already above 1.)
  const gSurface = params.surfaceGravity
  const throttledAtIgnition = thrustAt(m0) < maxThrust
  const liftoffMass = maxThrust / gSurface
  const liftoffTime = throttledAtIgnition || m0 <= liftoffMass ? 0 : (m0 - liftoffMass) / fullMassFlow
  const padBurnTime = params.propellantMass / fullMassFlow

  samples.push(0, 0, R, 0, 0, m0, 0, thrustAt(m0) / maxThrust, Phase.Pad)

  if (liftoffTime >= padBurnTime) {
    // Thrust never beats weight: the engines burn out on the pad.
    samples.push(padBurnTime, 0, R, 0, 0, mDry, 0, 0, Phase.Pad)
    flight.endTime = padBurnTime
    return flight
  }

  if (liftoffTime > 0) samples.push(liftoffTime, 0, R, 0, 0, m0 - fullMassFlow * liftoffTime, 0, 1, Phase.Pad)
  events.liftoff = liftoffTime

  // ── Powered ascent ───────────────────────────────────────────────────────
  const state = new Float64Array([0, R, 0, 0, m0 - fullMassFlow * liftoffTime])
  const rk4 = new RK4(5)

  let phase: Phase = Phase.Vertical
  let engineOn = true
  let pitchStart = 0
  /** Commanded pitch above the local horizontal during guided flight (rad), held for one step. */
  let guidedPitch = 0
  // Output of `guide`: unit thrust direction.
  let dirX = 0
  let dirY = 1

  const guide = (t: number, x: number, y: number, vx: number, vy: number) => {
    const r = Math.sqrt(x * x + y * y)
    const upX = x / r
    const upY = y / r
    // Local horizontal pointing downrange: (up_y, −up_x).
    if (phase === Phase.Vertical) {
      dirX = upX
      dirY = upY
    } else if (phase === Phase.Pitchover) {
      const angle = kick * Math.min(1, (t - pitchStart) / vehicle.pitchRampDuration)
      const c = Math.cos(angle)
      const s = Math.sin(angle)
      dirX = c * upX + s * upY
      dirY = c * upY - s * upX
    } else if (phase === Phase.GravityTurn) {
      const v = Math.sqrt(vx * vx + vy * vy)
      if (v > 1e-9) {
        dirX = vx / v
        dirY = vy / v
      } else {
        dirX = upX
        dirY = upY
      }
    } else {
      // Guided: pitch above local horizontal, re-expressed in the local frame.
      const s = Math.sin(guidedPitch)
      const c = Math.cos(guidedPitch)
      dirX = s * upX + c * upY
      dirY = s * upY - c * upX
    }
  }

  const dynamics = (t: number, s: Float64Array, out: Float64Array) => {
    const x = s[0]
    const y = s[1]
    const vx = s[2]
    const vy = s[3]
    const m = s[4]
    const r2 = x * x + y * y
    const r = Math.sqrt(r2)
    const gk = -mu / (r2 * r)
    let ax = gk * x
    let ay = gk * y
    let mdot = 0

    if (engineOn) {
      guide(t, x, y, vx, vy)
      const thrust = thrustAt(m)
      const aT = thrust / m
      ax += aT * dirX
      ay += aT * dirY
      mdot = -thrust / ve
    }

    if (dragOn) {
      const v = Math.sqrt(vx * vx + vy * vy)
      if (v > 0) {
        // D/m = ½ρv²C_DA/m along −v̂, i.e. −(½ρ|v|C_DA/m)·v
        const k = (0.5 * airDensity(r - R) * v * dragArea) / m
        ax -= k * vx
        ay -= k * vy
      }
    }

    out[0] = vx
    out[1] = vy
    out[2] = ax
    out[3] = ay
    out[4] = mdot
  }

  /**
   * Closed-loop steering. Over the time left in the burn, τ, a vertical
   * acceleration that varies linearly in time can satisfy both end
   * conditions — vertical speed 0 and altitude h_T. Solving
   *   v_r + Aτ + ½Bτ² = 0   and   h + v_rτ + ½Aτ² + ⅙Bτ³ = h_T
   * for the acceleration needed right now gives
   *   A = 6(h_T − h)/τ² − 4·v_r/τ.
   * Thrust must supply A plus gravity, minus the "centrifugal" term v_h²/r.
   */
  const updateGuidance = () => {
    const x = state[0]
    const y = state[1]
    const vx = state[2]
    const vy = state[3]
    const m = state[4]
    const r = Math.sqrt(x * x + y * y)
    const upX = x / r
    const upY = y / r
    const vr = vx * upX + vy * upY
    const vh = vx * upY - vy * upX
    const thrust = thrustAt(m)
    const aT = thrust / m

    // Time to go: how long the engine must still burn to gain the missing
    // velocity, and how long the propellant lasts. Both follow from the rocket
    // equation over two segments: full thrust until the g-limit is reached at
    // m_lim = T/(n·g₀), then throttled flight at constant acceleration n·g₀.
    let command: number
    if ((vx * vx + vy * vy) / 2 - mu / r >= targetEnergy) {
      // Enough energy, but the orbit still dips too low: push along the local
      // horizontal, which raises the low point of the orbit most efficiently.
      command = 0
    } else {
      const dvGo = Math.sqrt(Math.max(0, targetCircularSpeed - vh) ** 2 + vr * vr)
      const tau = Math.min(burnTimeForDeltaV(m, dvGo), burnTimeToEmpty(m))
      // Near the end the gains blow up; hold the last command, as real guidance does.
      if (tau < 5) return
      const A = (6 * (targetAltitude - (r - R))) / (tau * tau) - (4 * vr) / tau
      const radialThrustAccel = A + mu / (r * r) - (vh * vh) / r
      command = Math.asin(Math.max(-0.95, Math.min(0.95, radialThrustAccel / aT)))
    }
    // The vehicle can only rotate so fast.
    const maxStep = vehicle.maxPitchRate * poweredStep
    guidedPitch += Math.max(-maxStep, Math.min(maxStep, command - guidedPitch))
  }

  // Tracks the felt (non-gravitational) acceleration for the summary.
  const trackGLoad = () => {
    const m = state[4]
    let fx = engineOn ? thrustAt(m) * dirX : 0
    let fy = engineOn ? thrustAt(m) * dirY : 0
    if (dragOn) {
      const vx = state[2]
      const vy = state[3]
      const v = Math.sqrt(vx * vx + vy * vy)
      const r = Math.sqrt(state[0] * state[0] + state[1] * state[1])
      const k = 0.5 * airDensity(r - R) * v * dragArea
      fx -= k * vx
      fy -= k * vy
    }
    const g = Math.sqrt(fx * fx + fy * fy) / m / STANDARD_GRAVITY
    if (g > summary.maxGLoad) summary.maxGLoad = g
  }

  let airIsThin = !dragOn

  /** Ascent milestones. Max-Q is tracked only while the engines burn (re-entry is not "Max-Q"). */
  const recordAscentEvents = (t: number, prevAltitude: number) => {
    const x = state[0]
    const y = state[1]
    const vx = state[2]
    const vy = state[3]
    const altitude = Math.sqrt(x * x + y * y) - R
    const speed = Math.sqrt(vx * vx + vy * vy)

    if (dragOn) {
      if (!events.mach1 && speed >= speedOfSound(altitude)) events.mach1 = { t, altitude }
      const q = 0.5 * airDensity(altitude) * speed * speed
      if (!events.maxQ || q > events.maxQ.q) events.maxQ = { t, altitude, q, speed }
      else if (q < vehicle.guidanceHandoverQ) airIsThin = true
    }
    if (!events.karman && prevAltitude < KARMAN_LINE && altitude >= KARMAN_LINE) events.karman = { t }
    if (!events.throttle && engineOn && thrustAt(state[4]) < maxThrust) events.throttle = { t }
  }

  /** Detects a ground strike between the previous and current state; returns true if it happened. */
  const checkImpact = (t: number, h: number, prevX: number, prevY: number, prevAltitude: number): boolean => {
    const altitude = Math.sqrt(state[0] * state[0] + state[1] * state[1]) - R
    if (altitude >= 0) return false
    const f = prevAltitude / (prevAltitude - altitude)
    const tImpact = t - h + f * h
    const x = prevX + (state[0] - prevX) * f
    const y = prevY + (state[1] - prevY) * f
    const r = Math.sqrt(x * x + y * y)
    const sx = (x / r) * R
    const sy = (y / r) * R
    events.impact = { t: tImpact, downrange: R * Math.atan2(sx, sy), speed: Math.sqrt(state[2] ** 2 + state[3] ** 2) }
    // Keep the impact velocity so interpolation into the final instant stays smooth.
    samples.push(tImpact, sx, sy, state[2], state[3], state[4], 0, 0, Phase.Landed)
    flight.endTime = tImpact
    return true
  }

  /** Specific orbital energy of the current state. */
  const energy = () => {
    const r = Math.sqrt(state[0] * state[0] + state[1] * state[1])
    return (state[2] * state[2] + state[3] * state[3]) / 2 - mu / r
  }

  let t = liftoffTime
  guide(t, state[0], state[1], state[2], state[3])
  let cutoff = false

  while (!cutoff) {
    let h = poweredStep
    const m = state[4]
    const thrustNow = thrustAt(m)
    const mdotNow = thrustNow / ve

    // Never burn past the last of the propellant.
    if (m - mdotNow * h <= mDry) {
      h = (m - mDry) / mdotNow
      cutoff = true
    }

    // Guided cutoff: when this step would bring the rocket to the energy of
    // the target orbit, shorten it to land exactly on that energy. The cutoff
    // is only accepted below if the resulting orbit also clears the planet.
    let energyCutoff = false
    if (guided && phase === Phase.Guided && !cutoff) {
      const e0 = energy()
      // dε/dt = (non-gravitational force per unit mass) · v
      const v2 = state[2] * state[2] + state[3] * state[3]
      const dragPower = dragOn ? (0.5 * airDensity(Math.sqrt(state[0] ** 2 + state[1] ** 2) - R) * Math.sqrt(v2) ** 3 * dragArea) / m : 0
      const power = (thrustNow / m) * (dirX * state[2] + dirY * state[3]) - dragPower
      if (power > 0 && e0 < targetEnergy && e0 + power * h >= targetEnergy) {
        h = Math.max(0, Math.min(h, (targetEnergy - e0) / power))
        energyCutoff = true
      }
    }

    const prevX = state[0]
    const prevY = state[1]
    const prevAltitude = Math.sqrt(prevX * prevX + prevY * prevY) - R

    if (h > 0) {
      rk4.step(dynamics, t, state, h)
      t += h
    }
    if (state[4] < mDry) state[4] = mDry

    if (t - liftoffTime > 1 && checkImpact(t, h, prevX, prevY, prevAltitude)) {
      flight.outcome = { kind: 'crash', elements: null, periapsisAltitude: Number.NaN, apoapsisAltitude: Number.NaN }
      return flight
    }

    // Accept a guided cutoff once the orbit has the target energy and its
    // periapsis is safely above the atmosphere; otherwise keep burning.
    if (guided && phase === Phase.Guided && !cutoff && (energyCutoff || energy() >= targetEnergy)) {
      const el = orbitalElements(state[0], state[1], state[2], state[3], mu)
      if (el.periapsis - R >= targetAltitude - 25_000 || el.energy >= 0) cutoff = true
    }

    // Guidance transitions happen between steps.
    const speed = Math.sqrt(state[2] * state[2] + state[3] * state[3])
    if (phase === Phase.Vertical && speed >= vehicle.pitchStartSpeed) {
      phase = Phase.Pitchover
      pitchStart = t
      events.pitchover = t
    } else if (phase === Phase.Pitchover && t - pitchStart >= vehicle.pitchRampDuration) {
      // Hand over to the gravity turn once the velocity has tilted as far as the thrust.
      const r = Math.sqrt(state[0] * state[0] + state[1] * state[1])
      const cosZenith = (state[0] * state[2] + state[1] * state[3]) / (r * speed)
      const zenith = Math.acos(Math.max(-1, Math.min(1, cosZenith)))
      if (zenith >= kick - 1e-6 || t - pitchStart > 60) phase = Phase.GravityTurn
    } else if (guided && phase === Phase.GravityTurn && airIsThin) {
      phase = Phase.Guided
      const r = Math.sqrt(state[0] * state[0] + state[1] * state[1])
      events.guidance = { t, altitude: r - R }
      // Start from the current flight-path angle so the handover is smooth.
      guidedPitch = Math.asin(Math.max(-1, Math.min(1, (state[0] * state[2] + state[1] * state[3]) / (r * speed))))
    }

    if (phase === Phase.Guided) updateGuidance()
    guide(t, state[0], state[1], state[2], state[3])
    recordAscentEvents(t, prevAltitude)
    trackGLoad()

    const throttle = thrustAt(state[4]) / maxThrust
    samples.push(t, state[0], state[1], state[2], state[3], state[4], dirX * throttle, dirY * throttle, phase)
  }

  // ── Main engine cut-off ──────────────────────────────────────────────────
  engineOn = false
  phase = Phase.Coast
  {
    const x = state[0]
    const y = state[1]
    const r = Math.sqrt(x * x + y * y)
    const speed = Math.sqrt(state[2] * state[2] + state[3] * state[3])
    const vertical = (x * state[2] + y * state[3]) / r
    events.meco = {
      t,
      altitude: r - R,
      speed,
      flightPathAngle: Math.asin(Math.max(-1, Math.min(1, vertical / speed))),
      propellantLeft: state[4] - mDry,
    }
    // Record the coast state at the same instant so interpolation sees the thrust drop.
    samples.push(t, x, y, state[2], state[3], state[4], 0, 0, Phase.Coast)
  }

  const elements = orbitalElements(state[0], state[1], state[2], state[3], mu)
  const periapsisAltitude = elements.periapsis - R
  const apoapsisAltitude = elements.apoapsis - R
  let kind: OutcomeKind
  if (elements.energy >= 0) kind = 'escape'
  else if (periapsisAltitude >= KARMAN_LINE) kind = 'orbit'
  else if (periapsisAltitude >= 0) kind = 'decaying-orbit'
  else kind = 'suborbital'
  flight.outcome = { kind, elements, periapsisAltitude, apoapsisAltitude }

  // ── Coast ────────────────────────────────────────────────────────────────
  // Bound orbits are followed for one full revolution; everything else until
  // impact or the time limit.
  let coastLimit = maxCoast
  if (kind === 'orbit' || kind === 'decaying-orbit') coastLimit = Math.min(maxCoast, elements.period)
  else if (kind === 'escape') coastLimit = Math.min(maxCoast, 3 * 3600)
  const tEnd = t + coastLimit

  let prevRadialSpeed = (state[0] * state[2] + state[1] * state[3]) / Math.sqrt(state[0] ** 2 + state[1] ** 2)

  while (t < tEnd - 1e-9) {
    const x = state[0]
    const y = state[1]
    const r = Math.sqrt(x * x + y * y)
    const speed = Math.sqrt(state[2] * state[2] + state[3] * state[3])
    const altitude = r - R

    // Keep the angular step to 0.01 rad (RK4 then holds an orbit to about a
    // metre per revolution) and resolve the drag time scale in thick air.
    let h = (0.01 * r) / Math.max(speed, 1)
    if (dragOn && altitude < 200_000) {
      const dragRate = (0.5 * airDensity(altitude) * speed * dragArea) / state[4]
      if (dragRate > 0) h = Math.min(h, 0.05 / dragRate)
    }
    h = Math.min(Math.max(h, 0.01), 30, tEnd - t)

    const prevX = x
    const prevY = y
    rk4.step(dynamics, t, state, h)
    t += h

    if (checkImpact(t, h, prevX, prevY, altitude)) return flight

    const rNew = Math.sqrt(state[0] * state[0] + state[1] * state[1])
    const radialSpeed = (state[0] * state[2] + state[1] * state[3]) / rNew
    if (!events.apoapsis && prevRadialSpeed > 0 && radialSpeed <= 0) {
      events.apoapsis = { t, altitude: rNew - R }
    }
    prevRadialSpeed = radialSpeed
    if (!events.karman && altitude < KARMAN_LINE && rNew - R >= KARMAN_LINE) events.karman = { t }

    samples.push(t, state[0], state[1], state[2], state[3], state[4], 0, 0, Phase.Coast)
  }

  flight.endTime = t
  return flight
}
