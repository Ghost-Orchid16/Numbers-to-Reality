/** Formatters that turn the live flight state into display strings. */
import { formatAcceleration, formatDistance, formatForce, formatMass, formatNumber, formatPressure, formatSpeed, toText } from '../../sim/core/format'
import type { FlightState } from '../../sim/rocket/evaluate'

export const fmt = {
  thrust: (s: FlightState) => toText(formatForce(s.thrust)),
  weight: (s: FlightState) => toText(formatForce(s.weight)),
  drag: (s: FlightState) => toText(formatForce(s.drag)),
  pad: (s: FlightState) => toText(formatForce(s.padForce)),
  net: (s: FlightState) => toText(formatForce(s.netForce)),
  mass: (s: FlightState) => toText(formatMass(s.mass)),
  gravity: (s: FlightState) => `${formatNumber(s.gravity, 2)} m/s²`,
  accel: (s: FlightState) => toText(formatAcceleration(s.acceleration)),
  speed: (s: FlightState) => toText(formatSpeed(s.speed)),
  altitude: (s: FlightState) => toText(formatDistance(s.altitude)),
  q: (s: FlightState) => toText(formatPressure(s.dynamicPressure)),
  horizontal: (s: FlightState) => toText(formatSpeed(Math.max(0, s.horizontalSpeed))),
}
