import { LiveMetric } from '../../components/ui/LiveMetric'
import { LiveText } from '../../components/ui/LiveText'
import { formatAcceleration, formatDistance, formatForce, formatMass, formatMissionTime, formatNumber, formatPressure, formatSpeed, type Formatted } from '../../sim/core/format'
import type { RocketSimulation } from '../../sim/rocket/RocketSimulation'
import { PLANET_RADIUS } from '../../sim/rocket/vehicle'
import { phaseLabel } from './phase'

const orbitAltitude = (r: number): Formatted => {
  if (!Number.isFinite(r)) return { value: 'none', unit: '' }
  const altitude = r - PLANET_RADIUS
  if (altitude < 0) return { value: 'inside planet', unit: '' }
  return formatDistance(altitude)
}

export function Telemetry({ sim, compact }: { sim: RocketSimulation; compact?: boolean }) {
  const ch = sim.live
  const orbitReached = () => sim.flight.outcome.kind === 'orbit'

  if (compact) {
    return (
      <div className="grid grid-cols-3 gap-x-3 rounded-lg border border-line bg-void/80 px-3 py-2 text-xs">
        <div>
          <p className="text-2xs text-muted">Time</p>
          <LiveText channel={ch} format={(s) => formatMissionTime(s.t)} className="tabular text-sm text-fg" />
        </div>
        <div>
          <p className="text-2xs text-muted">Altitude</p>
          <LiveText channel={ch} format={(s) => { const f = formatDistance(s.altitude); return `${f.value} ${f.unit}` }} className="tabular text-sm text-fg" />
        </div>
        <div>
          <p className="text-2xs text-muted">Speed</p>
          <LiveText channel={ch} format={(s) => { const f = formatSpeed(s.speed); return `${f.value} ${f.unit}` }} className="tabular text-sm text-fg" />
        </div>
      </div>
    )
  }

  return (
    <section aria-label="Live telemetry" className="w-full">
      <header className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <p className="flex items-center gap-2 text-xs text-muted">
          <span aria-hidden className="size-1.5 rounded-full bg-ok" />
          Live simulation
        </p>
        <LiveText channel={ch} format={(s) => formatMissionTime(s.t)} className="tabular text-lg leading-none text-fg" />
      </header>
      <LiveText channel={ch} format={(s) => phaseLabel(s, orbitReached())} className="mt-2 block text-xs text-fg/80" />
      <dl className="mt-2">
        <LiveMetric label="Altitude" channel={ch} quantity="position" format={(s) => formatDistance(s.altitude)} primary />
        <LiveMetric
          label="Speed"
          channel={ch}
          quantity="velocity"
          format={(s) => formatSpeed(s.speed)}
          detail={(s) => (Number.isFinite(s.mach) && s.mach > 0.05 && s.altitude < 90_000 ? `Mach ${formatNumber(s.mach, 1)}` : '')}
          primary
        />
        <LiveMetric
          label="Acceleration"
          channel={ch}
          quantity="acceleration"
          format={(s) => formatAcceleration(s.acceleration)}
          detail={(s) => `felt ${formatNumber(s.gLoad, 1)} g`}
        />
        <LiveMetric label="Mass" channel={ch} quantity="mass" format={(s) => formatMass(s.mass)} />
        <LiveMetric label="Thrust" channel={ch} quantity="force" format={(s) => formatForce(s.thrust)} />
        <LiveMetric label="Weight" channel={ch} quantity="gravity" format={(s) => formatForce(s.weight)} />
        <LiveMetric label="Drag" channel={ch} quantity="drag" format={(s) => formatForce(s.drag)} />
        <LiveMetric label="Dynamic pressure" channel={ch} format={(s) => formatPressure(s.dynamicPressure)} />
      </dl>
      <div className="mt-3 border-t border-line pt-2">
        <p className="text-2xs text-muted">If the engines stopped now (gravity only)</p>
        <dl>
          <LiveMetric label="Lowest point" channel={ch} format={(s) => (s.onPad ? { value: '—', unit: '' } : orbitAltitude(s.orbit.periapsis))} />
          <LiveMetric label="Highest point" channel={ch} format={(s) => (s.onPad ? { value: '—', unit: '' } : orbitAltitude(s.orbit.apoapsis))} />
        </dl>
      </div>
    </section>
  )
}
