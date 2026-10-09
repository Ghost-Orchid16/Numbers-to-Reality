import type { LiveChannel } from './liveChannel'
import type { Store } from './store'

/**
 * Physical quantity families. Each maps to one colour that is used for the
 * same kind of quantity everywhere: 3D vectors, equation variables, sliders,
 * telemetry and charts. Colour is a variable binding, never decoration.
 */
export type QuantityKind =
  | 'force'
  | 'gravity'
  | 'drag'
  | 'velocity'
  | 'acceleration'
  | 'mass'
  | 'position'
  | 'neutral'

export interface NumberParamSpec<K extends string = string> {
  kind: 'number'
  key: K
  label: string
  /** Mathematical symbol shown beside the label, e.g. "T" or "m". */
  symbol?: string
  /** Upright subscript for the symbol, e.g. "dry" in m_dry. */
  symbolSub?: string
  /** Display unit, e.g. "MN". */
  unit: string
  /** Multiply the SI value by this factor to get the display value (N → MN is 1e-6). */
  toDisplay?: number
  /** Bounds and step in SI units. */
  min: number
  max: number
  step: number
  /** Fraction digits for the displayed value. */
  digits?: number
  quantity?: QuantityKind
  description?: string
  /** Reference values drawn as ticks on the slider track (SI units). */
  marks?: ReadonlyArray<{ value: number; label: string }>
}

export interface BooleanParamSpec<K extends string = string> {
  kind: 'boolean'
  key: K
  label: string
  description?: string
  quantity?: QuantityKind
}

export type ParamSpec<K extends string = string> = NumberParamSpec<K> | BooleanParamSpec<K>

/**
 * The contract every chapter simulation implements.
 *
 * - `params` holds low-frequency inputs that controls bind to.
 * - `live` carries high-frequency outputs that telemetry and 3D read each frame.
 * - `update(dt)` advances the model by real elapsed seconds; it is only called
 *   while the chapter is on screen.
 */
export interface Simulation<P extends object, M extends object> {
  readonly params: Store<P>
  readonly live: LiveChannel<M>
  readonly paramSpecs: ReadonlyArray<ParamSpec<Extract<keyof P, string>>>
  update(dt: number): void
  reset(): void
  dispose(): void
}
