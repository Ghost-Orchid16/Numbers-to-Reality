import type { LegendItem } from '../../components/ui/SimulationLegend'
import { SCENE_COLORS } from '../../design/quantities'
import { BEAT_INDEX, BEATS, type BeatId } from './timeline'

const FLOWN: LegendItem = { id: 'flown', mark: 'line', color: SCENE_COLORS.path, label: 'Flight path so far' }
// Matches the trajectory's dimmed, dashed rendering ahead of the playhead.
const AHEAD: LegendItem = { id: 'ahead', mark: 'dashed', color: SCENE_COLORS.path, opacity: 0.5, label: 'Rest of the computed flight' }
const ORBIT: LegendItem = { id: 'orbit', mark: 'line', quantity: 'velocity', label: 'Orbit if the engines stopped now' }

/** The scene's line encodings visible during a beat (the arrows carry their own labels). */
export function legendFor(beat: BeatId): LegendItem[] {
  const emphasis = BEATS[BEAT_INDEX[beat]].emphasis
  const items: LegendItem[] = []
  if (emphasis.path > 0.3) {
    if (beat !== 'countdown') items.push(FLOWN)
    items.push(AHEAD)
  }
  if (emphasis.orbit > 0.5) items.push(ORBIT)
  return items
}
