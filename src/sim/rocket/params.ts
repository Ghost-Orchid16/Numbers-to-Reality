import type { ParamSpec } from '../core/simulation'

export interface RocketParams {
  /** Engine thrust T (N), constant while propellant remains. */
  thrust: number
  /** Dry mass: structure, engines and payload (kg). */
  dryMass: number
  /** Propellant (fuel + oxidiser) mass at ignition (kg). */
  propellantMass: number
  /** Surface gravity g₀ (m/s²). The planet's radius stays Earth's. */
  surfaceGravity: number
  /** Whether the atmosphere (and therefore drag) is modelled. */
  drag: boolean
  /** Pitch-over angle: how far the thrust tilts from vertical after clearing the tower (°). */
  pitchKick: number
  /** Closed-loop guidance: steer to a 200 km orbit, hold ≤ 4 g, cut off at orbital energy. */
  guidance: boolean
}

export const EARTH_SURFACE_GRAVITY = 9.81

export const DEFAULT_ROCKET_PARAMS: RocketParams = {
  thrust: 6.2e6,
  dryMass: 18_000,
  propellantMass: 400_000,
  surfaceGravity: EARTH_SURFACE_GRAVITY,
  drag: true,
  pitchKick: 5,
  guidance: true,
}

export const ROCKET_PARAM_SPECS: ReadonlyArray<ParamSpec<keyof RocketParams>> = [
  {
    kind: 'number',
    key: 'thrust',
    label: 'Thrust',
    symbol: 'T',
    unit: 'MN',
    toDisplay: 1e-6,
    min: 2e6,
    max: 12e6,
    step: 0.05e6,
    digits: 2,
    quantity: 'force',
    description: 'Push from the engines. Mass flow rises with it: ṁ = T / vₑ.',
  },
  {
    kind: 'number',
    key: 'dryMass',
    label: 'Dry mass',
    symbol: 'm',
    symbolSub: 'dry',
    unit: 't',
    toDisplay: 1e-3,
    min: 8_000,
    max: 80_000,
    step: 500,
    digits: 1,
    quantity: 'mass',
    description: 'Structure, engines and payload — everything that is not propellant.',
  },
  {
    kind: 'number',
    key: 'propellantMass',
    label: 'Propellant',
    symbol: 'm',
    symbolSub: 'prop',
    unit: 't',
    toDisplay: 1e-3,
    min: 50_000,
    max: 600_000,
    step: 5_000,
    digits: 0,
    quantity: 'mass',
    description: 'Fuel and oxidiser. Initial mass m₀ = dry mass + propellant.',
  },
  {
    kind: 'number',
    key: 'surfaceGravity',
    label: 'Surface gravity',
    symbol: 'g',
    symbolSub: '0',
    unit: 'm/s²',
    min: 1,
    max: 20,
    step: 0.01,
    digits: 2,
    quantity: 'gravity',
    description: 'Only gravity changes: the planet keeps Earth’s size and air.',
    marks: [
      { value: 1.62, label: 'Moon' },
      { value: 3.72, label: 'Mars' },
      { value: 9.81, label: 'Earth' },
    ],
  },
  {
    kind: 'boolean',
    key: 'drag',
    label: 'Atmosphere and drag',
    description: 'Switch the air off to see how much speed drag costs.',
    quantity: 'drag',
  },
  {
    kind: 'number',
    key: 'pitchKick',
    label: 'Pitch-over angle',
    symbol: 'θ',
    unit: '°',
    min: 0,
    max: 12,
    step: 0.1,
    digits: 1,
    quantity: 'velocity',
    description: 'Tilt after clearing the tower. 0° flies straight up; gravity bends the rest.',
  },
  {
    kind: 'boolean',
    key: 'guidance',
    label: 'Guidance computer',
    description: 'Steers to a 200 km orbit, throttles to stay under 4 g and cuts the engine at orbital energy.',
    quantity: 'neutral',
  },
]
