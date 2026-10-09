import { LiveChannel } from '../core/liveChannel'
import type { Simulation } from '../core/simulation'
import { createStore, type Store } from '../core/store'
import { diagnoseFlight, type Diagnosis } from './diagnose'
import { COUNTDOWN, createFlightState, evaluateFlight, type FlightState } from './evaluate'
import { SampleBuffer, simulateFlight, type Flight } from './flight'
import { DEFAULT_ROCKET_PARAMS, ROCKET_PARAM_SPECS, type RocketParams } from './params'

/** Who moves the mission clock: the reader's scroll position, or real time. */
export type PlayheadDriver = 'scroll' | 'clock'

export interface RocketPlayback {
  driver: PlayheadDriver
  playing: boolean
  /** Simulated seconds per real second when the clock drives the playhead. */
  timeScale: number
}

export interface RocketFlightInfo {
  /** Increments every time the trajectory is recomputed. */
  version: number
  flight: Flight
  diagnosis: Diagnosis
}

export const TIME_SCALES = [1, 10, 100] as const

/**
 * The rocket chapter's simulation. The whole flight is solved ahead of time
 * whenever a parameter changes; the playhead then picks any moment of it.
 */
export class RocketSimulation implements Simulation<RocketParams, FlightState> {
  readonly params: Store<RocketParams> = createStore({ ...DEFAULT_ROCKET_PARAMS })
  readonly playback: Store<RocketPlayback> = createStore<RocketPlayback>({ driver: 'scroll', playing: false, timeScale: 10 })
  readonly live = new LiveChannel<FlightState>(createFlightState())
  readonly paramSpecs = ROCKET_PARAM_SPECS
  readonly flightInfo: Store<RocketFlightInfo>

  // Two buffers, alternated, so the previous flight stays intact until the next solve.
  private readonly buffers = [new SampleBuffer(), new SampleBuffer()]
  private bufferIndex = 0
  private playhead = -COUNTDOWN
  private recomputeQueued = false
  private readonly unsubscribe: () => void

  constructor() {
    const flight = this.solve(this.params.get())
    this.flightInfo = createStore<RocketFlightInfo>({ version: 0, flight, diagnosis: diagnoseFlight(flight) })
    this.unsubscribe = this.params.subscribe(() => this.queueRecompute())
    evaluateFlight(flight, this.playhead, this.live.value)
  }

  get flight(): Flight {
    return this.flightInfo.get().flight
  }

  get time(): number {
    return this.playhead
  }

  get startTime(): number {
    return -COUNTDOWN
  }

  get endTime(): number {
    return this.flight.endTime
  }

  setParam<K extends keyof RocketParams>(key: K, value: RocketParams[K]): void {
    this.params.patch({ [key]: value } as Partial<RocketParams>)
  }

  /** Moves the playhead directly (scroll scrubbing, timeline seeking). */
  setPlayhead(time: number): void {
    this.playhead = Math.min(Math.max(time, this.startTime), this.endTime)
  }

  setDriver(driver: PlayheadDriver): void {
    if (this.playback.get().driver === driver) return
    this.playback.patch({ driver, playing: false })
  }

  play(): void {
    if (this.playhead >= this.endTime - 1e-6) this.playhead = this.startTime
    this.playback.patch({ driver: 'clock', playing: true })
  }

  pause(): void {
    this.playback.patch({ playing: false })
  }

  setTimeScale(timeScale: number): void {
    this.playback.patch({ timeScale })
  }

  update(dt: number): void {
    if (this.recomputeQueued) this.recompute()
    const pb = this.playback.get()
    if (pb.driver === 'clock' && pb.playing) {
      // Clamp long frames (tab switches) so the rocket never teleports.
      this.playhead += Math.min(dt, 0.1) * pb.timeScale
      if (this.playhead >= this.endTime) {
        this.playhead = this.endTime
        this.playback.patch({ playing: false })
      }
    }
    evaluateFlight(this.flight, this.playhead, this.live.value)
    this.live.publish()
  }

  reset(): void {
    this.params.set({ ...DEFAULT_ROCKET_PARAMS })
    this.playback.patch({ playing: false })
    this.playhead = this.startTime
    this.recompute()
  }

  dispose(): void {
    this.unsubscribe()
  }

  private solve(params: RocketParams): Flight {
    this.bufferIndex = 1 - this.bufferIndex
    return simulateFlight(params, undefined, { buffer: this.buffers[this.bufferIndex] })
  }

  /** Coalesces bursts of parameter changes (a dragged slider) into one solve. */
  private queueRecompute(): void {
    if (this.recomputeQueued) return
    this.recomputeQueued = true
    queueMicrotask(() => {
      if (this.recomputeQueued) this.recompute()
    })
  }

  private recompute(): void {
    this.recomputeQueued = false
    const flight = this.solve(this.params.get())
    const prev = this.flightInfo.get()
    this.flightInfo.set({ version: prev.version + 1, flight, diagnosis: diagnoseFlight(flight) })
    this.playhead = Math.min(this.playhead, flight.endTime)
    evaluateFlight(flight, this.playhead, this.live.value)
    this.live.publish()
  }
}
