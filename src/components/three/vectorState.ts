import { Vector3 } from 'three'

export interface VectorState {
  /** Tail position (world). */
  origin: Vector3
  /** Direction (need not be normalised; zero hides the arrow). */
  direction: Vector3
  /** Length in world units. */
  length: number
  /** Shaft thickness in world units (head scales with it). */
  thickness: number
  /** 0–1 visibility (fades the arrow). */
  opacity: number
}

export function createVectorState(): VectorState {
  return { origin: new Vector3(), direction: new Vector3(), length: 0, thickness: 1, opacity: 0 }
}
