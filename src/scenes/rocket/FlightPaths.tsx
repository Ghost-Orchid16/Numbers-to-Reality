import { useMemo } from 'react'
import { Vector3 } from 'three'
import { DynamicPath, TimelinePath, type PathData } from '../../components/three/PathLine'
import { QUANTITY_COLORS, SCENE_COLORS } from '../../design/quantities'
import { useStore } from '../../hooks/useStore'
import { sampleConic } from '../../sim/rocket/orbit'
import { PLANET_RADIUS } from '../../sim/rocket/vehicle'
import { useRocketScene } from './sceneState'

const PAD = new Vector3(0, PLANET_RADIUS, 0)
const MAX_POINTS = 6000
const ORBIT_SEGMENTS = 720

/**
 * The computed trajectory (flown part bright, the rest dashed) and the
 * predicted orbit: where gravity alone would take the rocket if the engines
 * stopped right now. During ascent that orbit is a small ellipse that dives
 * through the planet; reaching orbit means growing it until it clears.
 */
export function FlightPaths() {
  const { sim, state } = useRocketScene()
  const version = useStore(sim.flightInfo, (f) => f.version)

  const trajectory: PathData = useMemo(() => {
    const s = sim.flight.samples
    const stride = Math.max(1, Math.ceil(s.count / MAX_POINTS))
    const n = Math.ceil(s.count / stride)
    const points = new Float32Array(n * 3)
    const times = new Float32Array(n)
    let k = 0
    for (let i = 0; i < s.count; i += stride) {
      points[3 * k] = s.x[i] - PAD.x
      points[3 * k + 1] = s.y[i] - PAD.y
      points[3 * k + 2] = 0
      times[k] = s.t[i]
      k++
    }
    return { points, times, count: k, version }
  }, [sim, version])

  const conic = useMemo(() => new Float64Array((ORBIT_SEGMENTS + 1) * 2), [])

  return (
    <>
      <TimelinePath
        data={trajectory}
        origin={PAD}
        color={SCENE_COLORS.path}
        width={1.6}
        dimOpacity={0.4}
        playhead={() => state.time}
        dashPeriod={() => state.cameraDistance * 0.03}
        visibility={() => state.emphasis.path}
      />
      <DynamicPath
        capacity={ORBIT_SEGMENTS + 1}
        color={QUANTITY_COLORS.velocity}
        width={1.3}
        opacity={0.9}
        dimOpacity={0.35}
        innerRadius={PLANET_RADIUS}
        dashPeriod={() => state.cameraDistance * 0.02}
        update={(out) => {
          const s = sim.live.value
          const show = state.emphasis.orbit
          if (show < 0.05 || s.onPad || s.landed || s.speed < 50) return 0
          const n = sampleConic(s.orbit, ORBIT_SEGMENTS, PLANET_RADIUS * 14, conic)
          for (let i = 0; i < n; i++) {
            out[3 * i] = conic[2 * i]
            out[3 * i + 1] = conic[2 * i + 1]
            out[3 * i + 2] = 0
          }
          return n
        }}
      />
    </>
  )
}
