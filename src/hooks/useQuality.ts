/**
 * Device quality tier, decided once from cheap heuristics and then adapted at
 * runtime by each canvas's performance monitor (which lowers resolution when
 * the frame rate drops).
 */
export type QualityTier = 'low' | 'medium' | 'high'

export interface Quality {
  tier: QualityTier
  /** Upper bound for the canvas device-pixel ratio. */
  maxDpr: number
  /** Multiplier for particle counts. */
  particles: number
}

const PRESETS: Record<QualityTier, Quality> = {
  low: { tier: 'low', maxDpr: 1, particles: 0.35 },
  medium: { tier: 'medium', maxDpr: 1.5, particles: 0.65 },
  high: { tier: 'high', maxDpr: 2, particles: 1 },
}

let cached: Quality | null = null

export function detectQuality(): Quality {
  if (cached) return cached
  if (typeof navigator === 'undefined') return PRESETS.medium
  const cores = navigator.hardwareConcurrency ?? 4
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  const small = typeof window !== 'undefined' && Math.min(window.screen.width, window.screen.height) < 500

  let tier: QualityTier = 'high'
  if (cores <= 4 || memory <= 4 || (coarse && small)) tier = 'medium'
  if (cores <= 2 || memory <= 2) tier = 'low'
  cached = PRESETS[tier]
  return cached
}

/** True if this browser can create a WebGL2 context. */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!canvas.getContext('webgl2')
  } catch {
    return false
  }
}
