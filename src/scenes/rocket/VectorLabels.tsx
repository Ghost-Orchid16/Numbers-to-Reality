import type { ReactNode } from 'react'
import type { LabelRegistry } from '../../components/three/labelRegistry'
import { LiveText } from '../../components/ui/LiveText'
import { QUANTITY_TEXT_COLORS } from '../../design/quantities'
import { formatForce, formatSpeed, toText } from '../../sim/core/format'
import type { FlightState } from '../../sim/rocket/evaluate'
import type { RocketSimulation } from '../../sim/rocket/RocketSimulation'

const force = (pick: (s: FlightState) => number) => (s: FlightState) => toText(formatForce(pick(s)))

function Label({ id, labels, color, children }: { id: string; labels: LabelRegistry; color: string; children: ReactNode }) {
  return (
    <div
      ref={labels.ref(id)}
      className="absolute left-0 top-0 whitespace-nowrap rounded-[3px] bg-void/75 px-1.5 py-0.5 font-math text-[13px] leading-none will-change-transform"
      style={{ color, visibility: 'hidden' }}
    >
      {children}
    </div>
  )
}

/** DOM overlay with the force-arrow labels; the scene positions them each frame. */
export function VectorLabels({ sim, labels }: { sim: RocketSimulation; labels: LabelRegistry }) {
  const ch = sim.live
  const value = 'font-sans text-[11px] not-italic'
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <Label id="thrust" labels={labels} color={QUANTITY_TEXT_COLORS.force}>
        <i>T</i> <LiveText channel={ch} format={force((s) => s.thrust)} className={value} />
      </Label>
      <Label id="weight" labels={labels} color={QUANTITY_TEXT_COLORS.gravity}>
        <i>mg</i> <LiveText channel={ch} format={force((s) => s.weight)} className={value} />
      </Label>
      <Label id="drag" labels={labels} color={QUANTITY_TEXT_COLORS.drag}>
        <i>D</i> <LiveText channel={ch} format={force((s) => s.drag)} className={value} />
      </Label>
      <Label id="pad" labels={labels} color={QUANTITY_TEXT_COLORS.neutral}>
        <i>N</i> <LiveText channel={ch} format={force((s) => s.padForce)} className={value} />
      </Label>
      <Label id="net" labels={labels} color={QUANTITY_TEXT_COLORS.acceleration}>
        <i>F</i>
        <sub className="font-sans text-[9px] not-italic">net</sub> <LiveText channel={ch} format={force((s) => s.netForce)} className={value} />
      </Label>
      <Label id="velocity" labels={labels} color={QUANTITY_TEXT_COLORS.velocity}>
        <i>v</i> <LiveText channel={ch} format={(s) => toText(formatSpeed(s.speed))} className={value} />
      </Label>
    </div>
  )
}
