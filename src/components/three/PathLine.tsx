import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { InstancedInterleavedBuffer, InterleavedBufferAttribute, Vector3 } from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { PathLineMaterial, type PathLineOptions } from './pathLineMaterial'

/**
 * Writes per-segment attributes (time or distance pairs) for a polyline of
 * `count` points into an instanced buffer: [a0, a1, a1, a2, …].
 */
function segmentPairs(values: Float32Array, count: number): Float32Array {
  const pairs = new Float32Array(Math.max(0, count - 1) * 2)
  for (let i = 0; i < count - 1; i++) {
    pairs[2 * i] = values[i]
    pairs[2 * i + 1] = values[i + 1]
  }
  return pairs
}

function setPairAttribute(geometry: LineGeometry, name: string, values: Float32Array, count: number) {
  const buffer = new InstancedInterleavedBuffer(segmentPairs(values, count), 2, 1)
  geometry.setAttribute(`${name}Start`, new InterleavedBufferAttribute(buffer, 1, 0))
  geometry.setAttribute(`${name}End`, new InterleavedBufferAttribute(buffer, 1, 1))
}

/** Cumulative arc length along a polyline, for distance-based dashes. */
function arcLengths(points: Float32Array, count: number): Float32Array {
  const d = new Float32Array(count)
  for (let i = 1; i < count; i++) {
    const dx = points[3 * i] - points[3 * i - 3]
    const dy = points[3 * i + 1] - points[3 * i - 2]
    const dz = points[3 * i + 2] - points[3 * i - 1]
    d[i] = d[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz)
  }
  return d
}

export interface PathData {
  /** xyz triplets, relative to `origin`. */
  points: Float32Array
  /** One time per point (timeline mode). */
  times?: Float32Array
  count: number
  /** Increment to rebuild the GPU buffers. */
  version: number
}

interface TimelinePathProps extends Omit<PathLineOptions, 'mode'> {
  data: PathData
  origin?: Vector3
  /** Current time; segments after it are dimmed. */
  playhead: () => number
  /** Dash period in world units, e.g. scaled with camera distance. */
  dashPeriod?: () => number
  /** Per-frame visibility multiplier (0 hides the path). */
  visibility?: () => number
  renderOrder?: number
}

/** A path drawn bright up to the playhead and dim (dashed) beyond it. */
export function TimelinePath({ data, origin, playhead, dashPeriod, visibility, renderOrder = 2, color, width, opacity = 1, dimOpacity, dashDim }: TimelinePathProps) {
  const size = useThree((s) => s.size)
  const material = useMemo(
    () => new PathLineMaterial({ color, width, opacity, dimOpacity, dashDim, mode: 'timeline' }),
    [color, width, opacity, dimOpacity, dashDim],
  )
  const line = useMemo(() => new Line2(new LineGeometry(), material), [material])

  useEffect(() => {
    const geometry = new LineGeometry()
    if (data.count >= 2) {
      geometry.setPositions(data.points.subarray(0, data.count * 3))
      setPairAttribute(geometry, 'instanceTime', data.times ?? new Float32Array(data.count), data.count)
      setPairAttribute(geometry, 'instanceDistance', arcLengths(data.points, data.count), data.count)
    }
    const old = line.geometry
    line.geometry = geometry
    line.visible = data.count >= 2
    old.dispose()
  }, [line, data])

  useEffect(() => {
    material.resolution.set(size.width, size.height)
  }, [material, size.width, size.height])

  useEffect(
    () => () => {
      line.geometry.dispose()
      material.dispose()
    },
    [line, material],
  )

  useFrame(() => {
    material.pathUniforms.uPlayhead.value = playhead()
    if (dashPeriod) material.pathUniforms.uDashPeriod.value = dashPeriod()
    if (visibility) {
      const v = visibility()
      material.opacity = opacity * v
      line.visible = v > 0.01 && data.count >= 2
    }
  })

  return <primitive object={line} position={origin ?? [0, 0, 0]} renderOrder={renderOrder} />
}

interface DynamicPathProps extends Omit<PathLineOptions, 'mode'> {
  /** Maximum number of points the path can hold. */
  capacity: number
  /**
   * Called every frame to write points (xyz, relative to the planet centre)
   * into `out`; returns the number of points written.
   */
  update: (out: Float32Array) => number
  innerRadius: number
  dashPeriod?: () => number
  renderOrder?: number
}

/**
 * A path rewritten every frame in place (no allocation), e.g. a predicted
 * orbit. Parts inside `innerRadius` are dimmed and dashed.
 */
export function DynamicPath({ capacity, update, innerRadius, dashPeriod, renderOrder = 3, color, width, opacity, dimOpacity, dashDim }: DynamicPathProps) {
  const size = useThree((s) => s.size)
  const material = useMemo(
    () => new PathLineMaterial({ color, width, opacity, dimOpacity, dashDim, mode: 'radial' }),
    [color, width, opacity, dimOpacity, dashDim],
  )
  const buffers = useMemo(() => {
    const geometry = new LineGeometry()
    const positions = new InstancedInterleavedBuffer(new Float32Array((capacity - 1) * 6), 6, 1)
    geometry.setAttribute('instanceStart', new InterleavedBufferAttribute(positions, 3, 0))
    geometry.setAttribute('instanceEnd', new InterleavedBufferAttribute(positions, 3, 3))
    const distances = new InstancedInterleavedBuffer(new Float32Array((capacity - 1) * 2), 2, 1)
    geometry.setAttribute('instanceDistanceStart', new InterleavedBufferAttribute(distances, 1, 0))
    geometry.setAttribute('instanceDistanceEnd', new InterleavedBufferAttribute(distances, 1, 1))
    const times = new InstancedInterleavedBuffer(new Float32Array((capacity - 1) * 2), 2, 1)
    geometry.setAttribute('instanceTimeStart', new InterleavedBufferAttribute(times, 1, 0))
    geometry.setAttribute('instanceTimeEnd', new InterleavedBufferAttribute(times, 1, 1))
    return { geometry, positions, distances, scratch: new Float32Array(capacity * 3) }
  }, [capacity])
  const assets = useMemo(() => {
    const line = new Line2(buffers.geometry, material)
    line.frustumCulled = false
    return { ...buffers, material, line }
  }, [buffers, material])

  useEffect(() => {
    material.pathUniforms.uInnerRadius.value = innerRadius
  }, [material, innerRadius])

  useEffect(() => {
    assets.material.resolution.set(size.width, size.height)
  }, [assets, size.width, size.height])

  useEffect(() => () => buffers.geometry.dispose(), [buffers])
  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    const { scratch, positions, distances, geometry, line } = assets
    const n = Math.min(update(scratch), capacity)
    line.visible = n >= 2
    if (n < 2) return
    const seg = positions.array as Float32Array
    const dist = distances.array as Float32Array
    let total = 0
    for (let i = 0; i < n - 1; i++) {
      const a = 3 * i
      const b = 3 * (i + 1)
      seg[6 * i] = scratch[a]
      seg[6 * i + 1] = scratch[a + 1]
      seg[6 * i + 2] = scratch[a + 2]
      seg[6 * i + 3] = scratch[b]
      seg[6 * i + 4] = scratch[b + 1]
      seg[6 * i + 5] = scratch[b + 2]
      const len = Math.hypot(scratch[b] - scratch[a], scratch[b + 1] - scratch[a + 1], scratch[b + 2] - scratch[a + 2])
      dist[2 * i] = total
      total += len
      dist[2 * i + 1] = total
    }
    positions.needsUpdate = true
    distances.needsUpdate = true
    geometry.instanceCount = n - 1
    if (dashPeriod) material.pathUniforms.uDashPeriod.value = dashPeriod()
  })

  return <primitive object={assets.line} renderOrder={renderOrder} />
}
