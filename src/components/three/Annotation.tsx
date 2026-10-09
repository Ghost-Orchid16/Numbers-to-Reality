import type { ReactNode } from 'react'
import type { LabelRegistry } from './labelRegistry'

/** DOM overlay above a `SimulationCanvas` that holds the scene's annotations. */
export function AnnotationLayer({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {children}
    </div>
  )
}

interface AnnotationProps {
  /** Key the scene uses to place it: `registry.target(id)`. */
  id: string
  registry: LabelRegistry
  /** Text colour; use the quantity's text tone so the label matches its mark. */
  color?: string
  className?: string
  children: ReactNode
}

/**
 * A label pinned to a point in the 3D scene. React renders it once; each frame
 * the scene writes the target position and opacity, and
 * `LabelRegistry.update` moves the element.
 */
export function Annotation({ id, registry, color, className, children }: AnnotationProps) {
  return (
    <div
      ref={registry.ref(id)}
      className={`absolute left-0 top-0 whitespace-nowrap rounded-[3px] bg-void/75 px-1.5 py-0.5 leading-none will-change-transform ${className ?? ''}`}
      style={{ color, visibility: 'hidden' }}
    >
      {children}
    </div>
  )
}
