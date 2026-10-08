import type { FlightState } from '../../sim/rocket/evaluate'
import { Phase } from '../../sim/rocket/flight'

/** What the rocket is doing, in words. */
export function phaseLabel(s: FlightState, orbitReached: boolean): string {
  if (s.t < 0) return 'Countdown'
  switch (s.phase) {
    case Phase.Pad:
      return s.thrust > 0 ? 'Engines firing, held by the pad' : 'Engines shut down on the pad'
    case Phase.Vertical:
      return 'Vertical climb'
    case Phase.Pitchover:
      return 'Pitch-over'
    case Phase.GravityTurn:
      return 'Gravity turn'
    case Phase.Guided:
      return s.throttle < 0.999 ? 'Guided, throttled to 4 g' : 'Guided ascent'
    case Phase.Coast:
      return orbitReached ? 'In orbit, engines off' : 'Coasting, engines off'
    case Phase.Landed:
      return 'Impact'
    default:
      return ''
  }
}
