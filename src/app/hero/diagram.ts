/** Mountain top radius (planet radius = 1), exaggerated as in Newton's drawing. */
export const LAUNCH_RADIUS = 1.15

export interface DiagramLayout {
  width: number
  height: number
  /** Planet centre and radius in CSS pixels. */
  cx: number
  cy: number
  radius: number
}

/** Places the diagram: right of the title on wide screens, below it on tall ones. */
export function layoutDiagram(width: number, height: number): DiagramLayout {
  const landscape = width > height * 1.05
  if (landscape) {
    const radius = Math.min(height * 0.12, width * 0.075)
    return { width, height, cx: width * 0.73, cy: height * 0.42, radius }
  }
  const radius = Math.min(width * 0.13, height * 0.075)
  return { width, height, cx: width * 0.5, cy: height * 0.5, radius }
}

/** Screen position of a normalised diagram point. */
export function toScreen(layout: DiagramLayout, x: number, y: number): [number, number] {
  return [layout.cx + x * layout.radius, layout.cy - y * layout.radius]
}
