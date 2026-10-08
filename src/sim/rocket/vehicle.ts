/** Standard gravity g₀, used to convert specific impulse to exhaust velocity. */
export const STANDARD_GRAVITY = 9.80665

/** Mean radius of the Earth (m). The planet radius stays fixed in this model. */
export const PLANET_RADIUS = 6_371_000

/** The Kármán line: the conventional boundary of space (m). */
export const KARMAN_LINE = 100_000

/**
 * Fixed properties of the educational launch vehicle. Its proportions are
 * those of a modern medium-lift booster (3.7 m diameter), but it is a single
 * stage with a constant-thrust engine so that every number can be traced back
 * to a handful of equations.
 */
export interface VehicleSpec {
  /** Effective exhaust velocity vₑ (m/s). Specific impulse Isp = vₑ / g₀. */
  exhaustVelocity: number
  /** Body diameter (m); sets the drag reference area A = πd²/4. */
  diameter: number
  /** Drag coefficient C_D, held constant. Real values vary with Mach number. */
  dragCoefficient: number
  /** Overall height (m), used for the 3D model and scale references. */
  height: number
  /** Speed at which the pitch-over manoeuvre begins (m/s). */
  pitchStartSpeed: number
  /** Time taken to tilt the thrust to the pitch-over angle (s). */
  pitchRampDuration: number
  /** Altitude the guidance computer levels off at (m). */
  targetAltitude: number
  /** Felt-acceleration limit the guidance computer holds by throttling (multiples of g₀). */
  gLimit: number
  /** Dynamic pressure below which (after Max-Q) the guidance computer takes over (Pa). */
  guidanceHandoverQ: number
  /** Fastest the guidance computer will rotate the vehicle (rad/s). */
  maxPitchRate: number
}

export const VEHICLE: VehicleSpec = {
  exhaustVelocity: 3400,
  diameter: 3.7,
  dragCoefficient: 0.4,
  height: 56,
  pitchStartSpeed: 50,
  pitchRampDuration: 8,
  targetAltitude: 200_000,
  gLimit: 4,
  guidanceHandoverQ: 1000,
  maxPitchRate: (4 * Math.PI) / 180,
}

export function referenceArea(vehicle: VehicleSpec): number {
  return (Math.PI * vehicle.diameter * vehicle.diameter) / 4
}

export function specificImpulse(vehicle: VehicleSpec): number {
  return vehicle.exhaustVelocity / STANDARD_GRAVITY
}
