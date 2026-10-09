import { DataCell, DataGroup, DataPanel, DataStrip } from '../../components/ui/DataPanel'
import { LiveMetric } from '../../components/ui/LiveMetric'
import { LiveText } from '../../components/ui/LiveText'
import { Term } from '../../components/ui/Term'
import { formatAcceleration, formatDistance, formatForce, formatMass, formatMissionTime, formatNumber, formatPressure, formatSpeed, toText, type Formatted } from '../../sim/core/format'
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
      <DataStrip label="Live telemetry">
        <DataCell label="Time">
          <LiveText channel={ch} format={(s) => formatMissionTime(s.t)} />
        </DataCell>
        <DataCell label="Altitude">
          <LiveText channel={ch} format={(s) => toText(formatDistance(s.altitude))} />
        </DataCell>
        <DataCell label="Speed">
          <LiveText channel={ch} format={(s) => toText(formatSpeed(s.speed))} />
        </DataCell>
      </DataStrip>
    )
  }

  return (
    <DataPanel
      label="Live telemetry"
      status="Live simulation"
      headline={<LiveText channel={ch} format={(s) => formatMissionTime(s.t)} className="tabular text-lg leading-none text-fg" />}
    >
      <LiveText channel={ch} format={(s) => phaseLabel(s, orbitReached())} className="mt-2 block text-xs text-fg/80" />
      <DataGroup>
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
        <LiveMetric
          label={<Term definition="The pressure of the oncoming air, q = ½ρv². Drag and the aerodynamic load on the structure both scale with it.">Dynamic pressure</Term>}
          channel={ch}
          format={(s) => formatPressure(s.dynamicPressure)}
        />
      </DataGroup>
      <DataGroup divided caption="If the engines stopped now (gravity only)">
        <LiveMetric label="Lowest point" channel={ch} format={(s) => (s.onPad ? { value: '—', unit: '' } : orbitAltitude(s.orbit.periapsis))} />
        <LiveMetric label="Highest point" channel={ch} format={(s) => (s.onPad ? { value: '—', unit: '' } : orbitAltitude(s.orbit.apoapsis))} />
      </DataGroup>
    </DataPanel>
  )
}
