import { Vector3, type Camera } from 'three'

export interface LabelTarget {
  /** World position the label points at. */
  position: Vector3
  /** 0 hides the label. */
  opacity: number
}

/**
 * Screen-space labels for 3D points. The label elements are ordinary DOM in
 * an overlay above the canvas (rendered once by React); each frame the scene
 * writes target positions and calls `update`, which projects them through the
 * camera and moves the elements with a transform. No extra React roots, no
 * per-frame React work.
 */
export class LabelRegistry {
  private readonly elements = new Map<string, HTMLElement>()
  private readonly refs = new Map<string, (el: HTMLElement | null) => void>()
  private readonly targets = new Map<string, LabelTarget>()
  private readonly projected = new Vector3()
  private readonly lastStyle = new Map<string, string>()

  /** Ref callback for a label element (stable per id, so re-renders don't re-attach). */
  ref(id: string): (el: HTMLElement | null) => void {
    let ref = this.refs.get(id)
    if (!ref) {
      ref = (el) => {
        if (el) this.elements.set(id, el)
        else this.elements.delete(id)
        // A re-attached element starts unstyled; forget what was last written.
        this.lastStyle.delete(id)
      }
      this.refs.set(id, ref)
    }
    return ref
  }

  /** The mutable target for a label (created on first use). */
  target(id: string): LabelTarget {
    let t = this.targets.get(id)
    if (!t) {
      t = { position: new Vector3(), opacity: 0 }
      this.targets.set(id, t)
    }
    return t
  }

  update(camera: Camera, width: number, height: number): void {
    for (const [id, el] of this.elements) {
      const t = this.targets.get(id)
      let style = 'hidden'
      if (t && t.opacity > 0.01) {
        const p = this.projected.copy(t.position).project(camera)
        if (p.z > -1 && p.z < 1) {
          const x = ((p.x + 1) / 2) * width
          const y = ((1 - p.y) / 2) * height
          style = `${x.toFixed(1)},${y.toFixed(1)},${t.opacity.toFixed(2)}`
          if (this.lastStyle.get(id) !== style) {
            el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`
            el.style.opacity = t.opacity.toFixed(2)
            el.style.visibility = 'visible'
          }
        }
      }
      if (style === 'hidden' && this.lastStyle.get(id) !== 'hidden') el.style.visibility = 'hidden'
      this.lastStyle.set(id, style)
    }
  }
}
