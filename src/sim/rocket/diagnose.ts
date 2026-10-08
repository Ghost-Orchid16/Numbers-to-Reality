/**
 * Turns a simulated flight into a plain-language verdict with the physical
 * reason behind it, so a failed launch teaches something instead of looking
 * like a bug.
 */
import type { Flight } from './flight'
import { circularSpeed } from './orbit'
import { PLANET_RADIUS } from './vehicle'

export type Verdict = 'success' | 'warning' | 'failure'

export interface Diagnosis {
  verdict: Verdict
  /** Short status, e.g. "Orbit reached". */
  title: string
  /** One or two sentences: what happened and why. */
  detail: string
}

/** Dynamic pressure real launch vehicles are typically built to survive (Pa). */
const STRUCTURAL_Q_LIMIT = 60_000

function km(m: number): string {
  return `${Math.round(m / 1000).toLocaleString('en-US')} km`
}

function kmps(mps: number): string {
  return `${(mps / 1000).toFixed(2)} km/s`
}

export function diagnoseFlight(flight: Flight): Diagnosis {
  const { outcome, events, summary, params } = flight
  const targetAltitude = flight.vehicle.targetAltitude
  const vNeeded = circularSpeed(summary.mu, PLANET_RADIUS + targetAltitude)
  const overloaded = events.maxQ !== null && events.maxQ.q > STRUCTURAL_Q_LIMIT
  const overloadNote = overloaded
    ? ` Peak dynamic pressure reached ${Math.round(events.maxQ!.q / 1000)} kPa — far beyond the ~${STRUCTURAL_Q_LIMIT / 1000} kPa a real rocket is built to survive.`
    : ''

  switch (outcome.kind) {
    case 'no-liftoff':
      return {
        verdict: 'failure',
        title: 'No liftoff',
        detail: `Thrust (${(params.thrust / 1e6).toFixed(2)} MN) never exceeded the weight, even with the tanks empty. Net force stayed zero, so the rocket never moved.`,
      }
    case 'crash': {
      const lowTW = summary.thrustToWeight < 1.25
      return {
        verdict: 'failure',
        title: 'Crashed',
        detail: lowTW
          ? `With thrust-to-weight of only ${summary.thrustToWeight.toFixed(2)}, the rocket climbed slowly and gravity bent its path back into the ground.${overloadNote}`
          : `The path turned too flat while the air was still thick, and the rocket flew back into the ground.${overloadNote} Try a smaller pitch-over angle.`,
      }
    }
    case 'suborbital': {
      const meco = events.meco!
      const ranDry = meco.propellantLeft < 1
      return {
        verdict: 'failure',
        title: 'Suborbital',
        detail: ranDry
          ? `Propellant ran out at ${kmps(meco.speed)}; orbit at ${km(targetAltitude)} needs ${kmps(vNeeded)}. The path falls back and meets the surface.`
          : `At engine cutoff the path still intersects the planet: it will fall back.${overloadNote}`,
      }
    }
    case 'decaying-orbit':
      return {
        verdict: 'warning',
        title: 'Orbit too low',
        detail: `The lowest point of the orbit is ${km(outcome.periapsisAltitude)} up — inside the atmosphere. Drag will pull it down within a few passes.`,
      }
    case 'escape':
      return {
        verdict: 'warning',
        title: 'Escape trajectory',
        detail: `Engine cutoff speed ${kmps(events.meco!.speed)} exceeds escape speed. The rocket leaves the planet for good on a hyperbolic path.`,
      }
    case 'orbit':
      return {
        verdict: 'success',
        title: 'Orbit reached',
        detail: `Engines cut off at ${kmps(events.meco!.speed)}. Orbit: ${km(outcome.periapsisAltitude)} × ${km(outcome.apoapsisAltitude)}, with ${(events.meco!.propellantLeft / 1000).toFixed(1)} t of propellant to spare.${overloadNote}`,
      }
  }
}
