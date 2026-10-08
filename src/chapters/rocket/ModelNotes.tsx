import { formatNumber } from '../../sim/core/format'
import { specificImpulse, VEHICLE } from '../../sim/rocket/vehicle'

const NOTES: Array<{ topic: string; model: string; reality: string }> = [
  {
    topic: 'Gravity',
    model: 'Inverse-square pull toward the planet’s centre, with GM = g₀R² so the gravity slider changes only gravity.',
    reality: 'The Earth’s equatorial bulge, the Moon and the Sun all tug on real trajectories.',
  },
  {
    topic: 'Atmosphere',
    model: 'Density from a layered exponential fit to the U.S. Standard Atmosphere 1976 (Vallado, table 8-4). Temperature is used only for the Mach number.',
    reality: 'Weather, wind and the solar cycle change the upper atmosphere’s density by up to ten times.',
  },
  {
    topic: 'Drag',
    model: `Constant drag coefficient C_D = ${VEHICLE.dragCoefficient} on the ${VEHICLE.diameter} m body; no aerodynamic lift.`,
    reality: 'C_D peaks near Mach 1 and depends on the angle of attack; vehicles are tested in wind tunnels and with CFD.',
  },
  {
    topic: 'Engines',
    model: `Constant thrust and exhaust velocity vₑ = ${formatNumber(VEHICLE.exhaustVelocity / 1000, 1)} km/s (specific impulse ≈ ${formatNumber(specificImpulse(VEHICLE), 0)} s), throttled down to hold ${VEHICLE.gLimit} g.`,
    reality: 'Real thrust rises by about a tenth as the outside air pressure falls, and engines have minimum throttle settings.',
  },
  {
    topic: 'Vehicle',
    model: `One stage, ${VEHICLE.height} m tall, carrying all its structure to orbit.`,
    reality: 'Orbital launchers use two or three stages and drop the empty ones.',
  },
  {
    topic: 'Guidance',
    model: `Vertical rise, pitch-over, gravity turn through the thick air, then closed-loop steering to ${formatNumber(VEHICLE.targetAltitude / 1000, 0)} km, updated every 0.2 s, with cutoff at circular-orbit energy.`,
    reality: 'Flight guidance targets a full orbit — plane, timing and shape — with more sophisticated laws such as Powered Explicit Guidance.',
  },
  {
    topic: 'Geometry',
    model: 'Motion stays in one plane, and the planet does not rotate.',
    reality: 'An eastward launch from Florida gains about 0.41 km/s from the Earth’s rotation, and trajectories are three-dimensional.',
  },
  {
    topic: 'Numerics',
    model: 'Fourth-order Runge–Kutta integration: 0.2 s steps under power, adaptive steps when coasting. The whole flight is re-solved in about 2 ms whenever a value changes.',
    reality: 'Mission analysis uses higher-fidelity force models, adaptive integrators and Monte Carlo runs over thousands of dispersed flights.',
  },
  {
    topic: 'Picture',
    model: 'Rocket, tower and planet are drawn to scale. Plume and smoke are artistic, but driven by the simulated thrust and air density; the Earth’s shadow uses exact cylinder geometry.',
    reality: 'Arrows are sized on one shared scale: drag really is that small compared with thrust.',
  },
]

/** Level 3 — engineering reality: what the model simplifies, stated plainly. */
export function ModelNotes() {
  return (
    <section aria-labelledby="rocket-model-title" className="page-x mx-auto max-w-[1600px] py-24">
      <div className="max-w-[46rem]">
        <h3 id="rocket-model-title" className="semi-wide text-2xl font-[560] text-fg">
          The model behind this chapter
        </h3>
        <p className="mt-3 leading-relaxed text-muted">
          Every number above is computed live in your browser from the equations on screen. It is an educational model: physically meaningful, but simpler than the real
          thing. Here is exactly what it simplifies.
        </p>
      </div>
      <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
        {NOTES.map((n) => (
          <div key={n.topic} className="border-t border-line pt-4">
            <dt className="text-sm text-fg">{n.topic}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-fg/80">{n.model}</dd>
            <dd className="mt-2 text-sm leading-relaxed text-muted">{n.reality}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
