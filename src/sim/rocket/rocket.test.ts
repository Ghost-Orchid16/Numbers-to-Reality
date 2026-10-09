import { describe, expect, it } from 'vitest'
import { airDensity, airTemperature, ATMOSPHERE_LAYERS, speedOfSound } from './atmosphere'
import { createFlightState, evaluateFlight } from './evaluate'
import { Phase, simulateFlight } from './flight'
import { circularSpeed, escapeSpeed, orbitalElements, sampleConic } from './orbit'
import { DEFAULT_ROCKET_PARAMS, type RocketParams } from './params'
import { PLANET_RADIUS, STANDARD_GRAVITY, VEHICLE } from './vehicle'

const R = PLANET_RADIUS
const params = (overrides: Partial<RocketParams> = {}): RocketParams => ({ ...DEFAULT_ROCKET_PARAMS, ...overrides })

describe('atmosphere', () => {
  it('matches sea-level reference values', () => {
    expect(airDensity(0)).toBeCloseTo(1.225, 6)
    expect(airTemperature(0)).toBeCloseTo(288.15, 6)
    expect(speedOfSound(0)).toBeCloseTo(340.3, 1)
    expect(airTemperature(11_000)).toBeCloseTo(216.65, 6)
  })

  it('falls by a factor e over one scale height within a layer', () => {
    const layer = ATMOSPHERE_LAYERS[0]
    expect(airDensity(layer.scaleHeight) / airDensity(0)).toBeCloseTo(Math.exp(-1), 9)
  })

  it('decreases monotonically from the ground to 1000 km', () => {
    let previous = airDensity(0)
    for (let h = 500; h <= 1_000_000; h += 500) {
      const rho = airDensity(h)
      expect(rho).toBeLessThan(previous)
      previous = rho
    }
  })

  it('is nearly continuous across layer boundaries (published fit)', () => {
    for (const layer of ATMOSPHERE_LAYERS.slice(1)) {
      const below = airDensity(layer.base - 1e-6)
      const above = airDensity(layer.base)
      expect(Math.abs(above / below - 1)).toBeLessThan(0.25)
    }
  })
})

describe('orbital elements', () => {
  const mu = 9.81 * R * R

  it('recognises a circular orbit', () => {
    const r = R + 200_000
    const v = circularSpeed(mu, r)
    const el = orbitalElements(0, r, v, 0, mu)
    expect(el.eccentricity).toBeLessThan(1e-12)
    expect(el.periapsis).toBeCloseTo(r, 3)
    expect(el.apoapsis).toBeCloseTo(r, 3)
    expect(el.period).toBeCloseTo(2 * Math.PI * Math.sqrt(r ** 3 / mu), 6)
    expect(el.energy).toBeCloseTo(-mu / (2 * r), 3)
  })

  it('places periapsis at a horizontal launch faster than circular', () => {
    const r = R + 300_000
    const v = 1.1 * circularSpeed(mu, r)
    const el = orbitalElements(0, r, v, 0, mu)
    expect(el.periapsis).toBeCloseTo(r, 3)
    // Vis-viva: v² = μ(2/r − 1/a)
    expect(v * v).toBeCloseTo(mu * (2 / r - 1 / el.semiMajorAxis), 3)
    expect(el.apoapsis).toBeGreaterThan(r)
  })

  it('gives the ballistic apex for purely vertical motion (degenerate ellipse)', () => {
    const r = R + 41
    const v = 21
    const el = orbitalElements(0, r, 0, v, mu)
    const g = mu / (r * r)
    // h_max ≈ h + v²/2g for a short hop.
    expect(el.apoapsis - R).toBeCloseTo(41 + (v * v) / (2 * g), 1)
    expect(el.periapsis).toBeLessThan(R)
  })

  it('classifies escape at escape speed or above', () => {
    const r = R + 300_000
    const el = orbitalElements(0, r, escapeSpeed(mu, r) * 1.05, 0, mu)
    expect(el.energy).toBeGreaterThan(0)
    expect(el.eccentricity).toBeGreaterThan(1)
    expect(el.apoapsis).toBe(Infinity)
  })

  it('samples a conic whose points satisfy r(θ) = p / (1 + e·cos(θ − ω))', () => {
    const r = R + 300_000
    const el = orbitalElements(0, r, 1.2 * circularSpeed(mu, r), 0, mu)
    const pts = new Float64Array(2 * 65)
    const n = sampleConic(el, 64, 1e9, pts)
    expect(n).toBe(65)
    for (let i = 0; i < n; i++) {
      const x = pts[2 * i]
      const y = pts[2 * i + 1]
      const theta = Math.atan2(y, x)
      const expected = el.semiLatusRectum / (1 + el.eccentricity * Math.cos(theta - el.argumentOfPeriapsis))
      expect(Math.hypot(x, y) / expected).toBeCloseTo(1, 9)
    }
  })
})

describe('rocket flight', () => {
  it('reproduces the Tsiolkovsky rocket equation with no gravity or air', () => {
    const p = params({ surfaceGravity: 1e-9, drag: false, guidance: false, pitchKick: 0 })
    const flight = simulateFlight(p)
    const expected = VEHICLE.exhaustVelocity * Math.log((p.dryMass + p.propellantMass) / p.dryMass)
    expect(flight.events.meco).not.toBeNull()
    expect(Math.abs(flight.events.meco!.speed - expected) / expected).toBeLessThan(1e-6)
    expect(flight.summary.idealDeltaV).toBeCloseTo(expected, 6)
  })

  it('matches the analytic vertical ascent v(t) = vₑ·ln(m₀/m) − g·t', () => {
    const p = params({ drag: false, guidance: false, pitchKick: 0 })
    const flight = simulateFlight(p)
    const state = evaluateFlight(flight, 20, createFlightState())
    const m0 = p.dryMass + p.propellantMass
    const mdot = p.thrust / VEHICLE.exhaustVelocity
    const analytic = VEHICLE.exhaustVelocity * Math.log(m0 / (m0 - mdot * 20)) - p.surfaceGravity * 20
    // Inverse-square gravity is ~0.05% weaker 1 km up; allow 0.1%.
    expect(Math.abs(state.speed - analytic) / analytic).toBeLessThan(1e-3)
    expect(state.horizontalSpeed).toBeCloseTo(0, 9)
  })

  it('stays on the pad until thrust exceeds weight', () => {
    const p = params({ thrust: 3.5e6, guidance: false })
    const flight = simulateFlight(p)
    const m0 = p.dryMass + p.propellantMass
    const mdot = p.thrust / VEHICLE.exhaustVelocity
    const expected = (m0 - p.thrust / p.surfaceGravity) / mdot
    expect(flight.events.liftoff).toBeCloseTo(expected, 9)

    const before = evaluateFlight(flight, expected * 0.5, createFlightState())
    expect(before.onPad).toBe(true)
    expect(before.speed).toBe(0)
    expect(before.acceleration).toBeCloseTo(0, 6)
    // The pad carries what the engines cannot: N = mg − T.
    expect(before.padForce).toBeCloseTo(before.weight - before.thrust, 3)
  })

  it('never lifts off if thrust cannot beat the dry weight', () => {
    const p = params({ thrust: 0.15e6 })
    const flight = simulateFlight(p)
    expect(flight.outcome.kind).toBe('no-liftoff')
    expect(flight.events.liftoff).toBeNull()
    const end = evaluateFlight(flight, flight.endTime + 5, createFlightState())
    expect(end.thrust).toBe(0)
    expect(end.mass).toBeCloseTo(p.dryMass, 6)
  })

  it('holds a circular orbit: energy and angular momentum are conserved while coasting', () => {
    const flight = simulateFlight(params({ drag: false }))
    expect(flight.outcome.kind).toBe('orbit')
    const s = flight.samples
    const mu = flight.summary.mu
    const mecoIndex = s.phase.indexOf(Phase.Coast)
    const last = s.count - 1
    const energy = (i: number) => (s.vx[i] ** 2 + s.vy[i] ** 2) / 2 - mu / Math.hypot(s.x[i], s.y[i])
    const momentum = (i: number) => s.x[i] * s.vy[i] - s.y[i] * s.vx[i]
    expect(Math.abs(energy(last) / energy(mecoIndex) - 1)).toBeLessThan(1e-7)
    expect(Math.abs(momentum(last) / momentum(mecoIndex) - 1)).toBeLessThan(1e-7)
    // One full period later the rocket is back where it started (to within ~10 m).
    const gap = Math.hypot(s.x[last] - s.x[mecoIndex], s.y[last] - s.y[mecoIndex])
    expect(gap).toBeLessThan(10)
  })

  it('reaches a stable low orbit with the default vehicle', () => {
    const flight = simulateFlight(DEFAULT_ROCKET_PARAMS)
    const { outcome, events, summary } = flight
    expect(outcome.kind).toBe('orbit')
    expect(outcome.periapsisAltitude).toBeGreaterThan(180_000)
    expect(outcome.apoapsisAltitude).toBeLessThan(220_000)
    expect(summary.thrustToWeight).toBeGreaterThan(1.4)
    expect(summary.thrustToWeight).toBeLessThan(1.6)
    // Max-Q in the range real launches report (tens of kPa, around 10 km up).
    expect(events.maxQ!.q).toBeGreaterThan(15_000)
    expect(events.maxQ!.q).toBeLessThan(45_000)
    expect(events.maxQ!.altitude).toBeGreaterThan(6_000)
    expect(events.maxQ!.altitude).toBeLessThan(16_000)
    // The g-limit holds.
    expect(summary.maxGLoad).toBeLessThan(4.01)
    expect(events.meco!.propellantLeft).toBeGreaterThan(0)
  })

  it('without guidance, flying straight up falls straight back down', () => {
    const flight = simulateFlight(params({ guidance: false, pitchKick: 0 }))
    expect(flight.outcome.kind).toBe('suborbital')
    expect(flight.events.impact).not.toBeNull()
    expect(Math.abs(flight.events.impact!.downrange)).toBeLessThan(1)
  })

  it('crashes when tilted too far in the thick lower atmosphere', () => {
    const flight = simulateFlight(params({ pitchKick: 12 }))
    expect(flight.outcome.kind).toBe('crash')
  })

  it('reaches orbit far more easily under lunar gravity', () => {
    const earth = simulateFlight(DEFAULT_ROCKET_PARAMS)
    const moon = simulateFlight(params({ surfaceGravity: 1.62 }))
    expect(moon.outcome.kind).toBe('orbit')
    expect(moon.outcome.periapsisAltitude).toBeGreaterThan(150_000)
    // Orbital speed scales with √g at fixed radius, so much less Δv is needed.
    const vCircMoon = circularSpeed(moon.summary.mu, R + 200_000)
    expect(vCircMoon / circularSpeed(earth.summary.mu, R + 200_000)).toBeCloseTo(Math.sqrt(1.62 / 9.81), 6)
    expect(moon.events.meco!.propellantLeft).toBeGreaterThan(5 * earth.events.meco!.propellantLeft)
  })

  it('without guidance, lunar gravity sends the same rocket onto an escape trajectory', () => {
    const flight = simulateFlight(params({ surfaceGravity: 1.62, guidance: false }))
    expect(flight.outcome.kind).toBe('escape')
    expect(flight.outcome.elements!.energy).toBeGreaterThan(0)
  })
})

describe('evaluateFlight', () => {
  const flight = simulateFlight(DEFAULT_ROCKET_PARAMS)
  const state = createFlightState()

  it('shows a fuelled rocket resting on the pad during the countdown', () => {
    evaluateFlight(flight, -5, state)
    expect(state.mass).toBe(flight.summary.initialMass)
    expect(state.thrust).toBe(0)
    expect(state.padForce).toBeCloseTo(state.weight, 6)
    expect(state.netForce).toBeCloseTo(0, 6)
    expect(state.gLoad).toBeCloseTo(state.gravity / STANDARD_GRAVITY, 9)
  })

  it('obeys F_net = T − mg − D and a = F_net/m at liftoff', () => {
    evaluateFlight(flight, 0.01, state)
    const p = flight.params
    expect(state.thrust).toBeCloseTo(p.thrust, 3)
    const expected = state.thrust - state.weight - state.drag
    expect(state.netForce).toBeCloseTo(expected, 0)
    expect(state.acceleration).toBeCloseTo(state.netForce / state.mass, 9)
  })

  it('agrees with finite differences of the trajectory (Newton’s second law)', () => {
    for (const t of [30, 90, 150, 250]) {
      const h = 0.05
      const a = evaluateFlight(flight, t - h, createFlightState())
      const b = evaluateFlight(flight, t + h, createFlightState())
      const s = evaluateFlight(flight, t, createFlightState())
      const ax = (b.vx - a.vx) / (2 * h)
      const ay = (b.vy - a.vy) / (2 * h)
      const fdAccel = Math.hypot(ax, ay)
      expect(Math.abs(fdAccel - s.acceleration) / s.acceleration).toBeLessThan(0.02)
    }
  })

  it('reproduces sampled positions exactly at sample times', () => {
    const s = flight.samples
    for (const i of [5, 100, 1000, s.count - 10]) {
      evaluateFlight(flight, s.t[i], state)
      expect(state.x).toBeCloseTo(s.x[i], 3)
      expect(state.y).toBeCloseTo(s.y[i], 3)
    }
  })

  it('cuts the thrust after engine cutoff', () => {
    evaluateFlight(flight, flight.events.meco!.t + 1, state)
    expect(state.thrust).toBe(0)
    expect(state.engineCutoff).toBe(true)
    expect(state.gLoad).toBeLessThan(1e-3)
  })
})
