import type { CameraShot } from './timeline'

export type LabView = 'close' | 'wide' | 'orbit'

export const LAB_SHOTS: Record<LabView, CameraShot> = {
  close: { anchor: 'rocket', distance: 650, azimuth: 18, elevation: 4, lift: 0 },
  wide: { anchor: 'rocket', distance: 160_000, azimuth: -5, elevation: 12, lift: 0 },
  orbit: { anchor: 'planet', distance: 38_000_000, azimuth: -22, elevation: 38, lift: 0 },
}
