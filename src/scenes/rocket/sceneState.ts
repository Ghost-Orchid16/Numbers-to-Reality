import { createContext, useContext } from 'react'
import { Vector3 } from 'three'
import type { LabelRegistry } from '../../components/three/labelRegistry'
import type { RocketSimulation } from '../../sim/rocket/RocketSimulation'
import type { CameraShot, Emphasis } from '../../chapters/rocket/timeline'

/**
 * Everything the rocket scene derives once per frame. Written by the scene's
 * driver before any component renders, then read by components in their own
 * frame callbacks — no React state changes per frame.
 */
export interface RocketSceneState {
  /** World position of the rocket's base. */
  rocketPosition: Vector3
  /** Unit vector along the rocket body (nose direction). */
  rocketAxis: Vector3
  /** Local vertical at the rocket. */
  rocketUp: Vector3
  /** Engine throttle 0–1 (0 when off). */
  throttle: number
  /** 0 at sea level → 1 in vacuum: how far the exhaust plume has expanded. */
  plumeExpansion: number
  /** Direct sunlight on the rocket, 0–1. */
  rocketSunlight: number
  /** Brightness of the sky around the rocket relative to the ground. */
  rocketSky: number
  cameraAltitude: number
  cameraDistance: number
  /** Blended visual emphasis for the current story beat. */
  emphasis: Emphasis
  /** Current (damped) camera shot. */
  shot: CameraShot
  /** Planet-centred frame: weight of the planet anchor (0–1). */
  planetView: number
  /** Mission time. */
  time: number
}

export function createSceneState(): RocketSceneState {
  return {
    rocketPosition: new Vector3(),
    rocketAxis: new Vector3(0, 1, 0),
    rocketUp: new Vector3(0, 1, 0),
    throttle: 0,
    plumeExpansion: 0,
    rocketSunlight: 0,
    rocketSky: 1,
    cameraAltitude: 0,
    cameraDistance: 1,
    emphasis: { path: 0, thrust: 0, weight: 0, drag: 0, pad: 0, net: 0, velocity: 0, orbit: 0 },
    shot: { anchor: 'pad', distance: 240, azimuth: 30, elevation: 5, lift: 0.1 },
    planetView: 0,
    time: 0,
  }
}

export interface RocketSceneContext {
  sim: RocketSimulation
  state: RocketSceneState
  /** Screen-space labels drawn in a DOM overlay above the canvas. */
  labels: LabelRegistry
}

export const RocketSceneCtx = createContext<RocketSceneContext | null>(null)

export function useRocketScene(): RocketSceneContext {
  const ctx = useContext(RocketSceneCtx)
  if (!ctx) throw new Error('useRocketScene must be used inside <RocketScene>')
  return ctx
}
