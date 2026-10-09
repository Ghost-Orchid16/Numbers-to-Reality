import { Annotation, AnnotationLayer } from '../../components/three/Annotation'
import type { LabelRegistry } from '../../components/three/labelRegistry'
import { LiveText } from '../../components/ui/LiveText'
import { QUANTITY_TEXT_COLORS } from '../../design/quantities'
import { formatForce, formatSpeed, toText } from '../../sim/core/format'
import type { FlightState } from '../../sim/rocket/evaluate'
import type { RocketSimulation } from '../../sim/rocket/RocketSimulation'

const force = (pick: (s: FlightState) => number) => (s: FlightState) => toText(formatForce(pick(s)))
const SYMBOL = 'font-math text-[13px]'
const VALUE = 'font-sans text-[11px] not-italic'

/** Labels for the force and velocity arrows; Vehicle.tsx positions them each frame. */
export function VectorLabels({ sim, labels }: { sim: RocketSimulation; labels: LabelRegistry }) {
  const ch = sim.live
  return (
    <AnnotationLayer>
      <Annotation id="thrust" registry={labels} color={QUANTITY_TEXT_COLORS.force} className={SYMBOL}>
        <i>T</i> <LiveText channel={ch} format={force((s) => s.thrust)} className={VALUE} />
      </Annotation>
      <Annotation id="weight" registry={labels} color={QUANTITY_TEXT_COLORS.gravity} className={SYMBOL}>
        <i>mg</i> <LiveText channel={ch} format={force((s) => s.weight)} className={VALUE} />
      </Annotation>
      <Annotation id="drag" registry={labels} color={QUANTITY_TEXT_COLORS.drag} className={SYMBOL}>
        <i>D</i> <LiveText channel={ch} format={force((s) => s.drag)} className={VALUE} />
      </Annotation>
      <Annotation id="pad" registry={labels} color={QUANTITY_TEXT_COLORS.neutral} className={SYMBOL}>
        <i>N</i> <LiveText channel={ch} format={force((s) => s.padForce)} className={VALUE} />
      </Annotation>
      <Annotation id="net" registry={labels} color={QUANTITY_TEXT_COLORS.acceleration} className={SYMBOL}>
        <i>F</i>
        <sub className="font-sans text-[9px] not-italic">net</sub> <LiveText channel={ch} format={force((s) => s.netForce)} className={VALUE} />
      </Annotation>
      <Annotation id="velocity" registry={labels} color={QUANTITY_TEXT_COLORS.velocity} className={SYMBOL}>
        <i>v</i> <LiveText channel={ch} format={(s) => toText(formatSpeed(s.speed))} className={VALUE} />
      </Annotation>
    </AnnotationLayer>
  )
}
