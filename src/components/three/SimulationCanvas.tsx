import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, type RootState } from '@react-three/fiber'
import { useMemo, useState, type ReactNode } from 'react'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { detectQuality, supportsWebGL } from '../../hooks/useQuality'

interface SimulationCanvasProps {
  /** Run the render loop. Off-screen chapters pass false and cost nothing per frame. */
  active: boolean
  /** Accessible description of what the scene shows. */
  label: string
  children: ReactNode
  className?: string
  /** One scene spanning metres to thousands of kilometres needs a logarithmic depth buffer. */
  logarithmicDepth?: boolean
  fov?: number
  near?: number
  far?: number
  onCreated?: (state: RootState) => void
  /** Rendered instead of the canvas when WebGL is unavailable. */
  fallback?: ReactNode
}

/**
 * The shared WebGL viewport for every chapter: one canvas per simulation,
 * paused while off screen, with resolution that adapts to the device's
 * measured frame rate.
 */
export function SimulationCanvas({
  active,
  label,
  children,
  className,
  logarithmicDepth = false,
  fov = 40,
  near = 0.1,
  far = 1000,
  onCreated,
  fallback,
}: SimulationCanvasProps) {
  const quality = useMemo(() => detectQuality(), [])
  const [dpr, setDpr] = useState(() => Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio, quality.maxDpr))
  const webgl = useMemo(() => supportsWebGL(), [])

  if (!webgl) {
    return (
      <div role="img" aria-label={label} className={className}>
        {fallback ?? (
          <p className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
            This simulation needs WebGL 2, which this browser does not provide. The numbers alongside still come from the live model.
          </p>
        )}
      </div>
    )
  }

  return (
    <div role="img" aria-label={label} className={className}>
      <Canvas
        frameloop={active ? 'always' : 'never'}
        dpr={dpr}
        camera={{ fov, near, far, position: [0, 0, 10] }}
        gl={{
          antialias: true,
          alpha: false,
          stencil: false,
          powerPreference: 'high-performance',
          logarithmicDepthBuffer: logarithmicDepth,
        }}
        onCreated={(state) => {
          state.gl.toneMapping = ACESFilmicToneMapping
          state.gl.toneMappingExposure = 1
          state.gl.outputColorSpace = SRGBColorSpace
          onCreated?.(state)
        }}
      >
        <PerformanceMonitor
          bounds={() => [45, 58]}
          flipflops={3}
          onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))}
          onIncline={() => setDpr((d) => Math.min(quality.maxDpr, d + 0.25))}
        />
        {children}
      </Canvas>
    </div>
  )
}
