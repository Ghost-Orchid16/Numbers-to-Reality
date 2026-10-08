import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, Color, Matrix3, ShaderMaterial, Vector3, type Matrix4, type Mesh } from 'three'
import { createPlanetSurfaceUniforms, PLANET_SURFACE_GLSL } from '../../components/three/earth/planetSurface'
import { PLANET_RADIUS } from '../../sim/rocket/vehicle'

const CAP_RADIUS = 600_000

/**
 * Spherical cap centred on the pad, with rings spaced logarithmically from
 * metres to hundreds of kilometres. Vertices are stored relative to the pad so
 * float32 precision holds near the rocket.
 */
function createCapGeometry(R: number, maxArc: number, rings: number, segments: number): BufferGeometry {
  const first = 3
  const growth = Math.log(maxArc / first) / (rings - 1)
  const positions = new Float32Array((rings * segments + 1) * 3)
  // Centre vertex.
  positions[0] = 0
  positions[1] = 0
  positions[2] = 0
  let v = 1
  for (let i = 0; i < rings; i++) {
    const arc = first * Math.exp(growth * i)
    const theta = arc / R
    const horizontal = R * Math.sin(theta)
    // R·cos θ − R written to avoid cancellation: −2R·sin²(θ/2)
    const drop = -2 * R * Math.sin(theta / 2) ** 2
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2
      positions[v * 3] = horizontal * Math.cos(a)
      positions[v * 3 + 1] = drop
      positions[v * 3 + 2] = horizontal * Math.sin(a)
      v++
    }
  }
  const indices: number[] = []
  for (let j = 0; j < segments; j++) indices.push(0, 1 + ((j + 1) % segments), 1 + j)
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = 1 + i * segments + j
      const b = 1 + i * segments + ((j + 1) % segments)
      const c = 1 + (i + 1) * segments + j
      const d = 1 + (i + 1) * segments + ((j + 1) % segments)
      indices.push(a, b, d, a, d, c)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(positions, 3))
  g.setIndex(indices)
  g.computeBoundingSphere()
  return g
}

const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  #include <fog_pars_vertex>
  uniform vec3 uPad;
  varying vec3 vLocal;
  varying vec3 vPlanet;
  void main() {
    vLocal = position;
    vPlanet = uPad + position;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
    #include <fog_vertex>
  }
`

const fragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  #include <fog_pars_fragment>
  ${PLANET_SURFACE_GLSL}
  uniform mat3 uGeoFromWorld;
  uniform float uOpacity;
  uniform float uGrid;
  uniform vec3 uGlowPos;
  uniform vec3 uGlowColor;
  uniform float uGlowIntensity;
  uniform float uAmbient;
  uniform vec3 uGridColor;
  varying vec3 vLocal;
  varying vec3 vPlanet;

  float gridLine(vec2 p, float spacing) {
    vec2 g = p / spacing;
    vec2 w = fwidth(g);
    vec2 d = abs(fract(g - 0.5) - 0.5) / max(w, vec2(1e-5));
    return 1.0 - smoothstep(0.5, 1.5, min(d.x, d.y));
  }

  void main() {
    #include <logdepthbuf_fragment>
    vec3 geo = normalize(uGeoFromWorld * vPlanet);
    vec3 base = planetSurface(geo) * uAmbient;

    // Engineering grid: 10 m, 100 m and 1 km lines, fading with distance from the pad.
    float dist = length(vLocal.xz);
    float g10 = gridLine(vLocal.xz, 10.0) * (1.0 - smoothstep(60.0, 220.0, dist));
    float g100 = gridLine(vLocal.xz, 100.0) * (1.0 - smoothstep(700.0, 2500.0, dist));
    float g1k = gridLine(vLocal.xz, 1000.0) * (1.0 - smoothstep(6000.0, 20000.0, dist));
    float grid = max(max(g10 * 0.35, g100 * 0.6), g1k * 0.45) * uGrid;
    vec3 color = base + uGridColor * grid;

    // Light from the engine plume and the pad floodlights pooling on the ground.
    float r2 = dot(vLocal - uGlowPos, vLocal - uGlowPos);
    color += uGlowColor * uGlowIntensity / (1.0 + r2 / 2500.0);

    float edge = 1.0 - smoothstep(${(CAP_RADIUS * 0.55).toFixed(1)}, ${(CAP_RADIUS * 0.98).toFixed(1)}, dist);
    gl_FragColor = vec4(color, edge * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

interface GroundCapProps {
  rotation: Matrix4
  /** Per-frame lighting and visibility. */
  state: { opacity: number; grid: number; glow: number; glowHeight: number; ambient: number }
}

/** The ground around the launch site, seamless with the globe beyond it. */
export function GroundCap({ rotation, state }: GroundCapProps) {
  const meshRef = useRef<Mesh>(null)
  const geometry = useMemo(() => createCapGeometry(PLANET_RADIUS, CAP_RADIUS, 96, 128), [])
  const material = useMemo(() => {
    const geoFromWorld = new Matrix3().setFromMatrix4(rotation).transpose()
    return new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        ...createPlanetSurfaceUniforms(),
        uGraticuleStrength: { value: 0 },
        uGeoFromWorld: { value: geoFromWorld },
        uPad: { value: new Vector3(0, PLANET_RADIUS, 0) },
        uOpacity: { value: 1 },
        uGrid: { value: 1 },
        uGlowPos: { value: new Vector3() },
        uGlowColor: { value: new Color('#ff8a3a') },
        uGridColor: { value: new Color('#1c2838') },
        uGlowIntensity: { value: 0 },
        uAmbient: { value: 1 },
        fogColor: { value: new Color() },
        fogDensity: { value: 0 },
        fogNear: { value: 1 },
        fogFar: { value: 2 },
      },
      transparent: true,
      depthWrite: false,
      fog: true,
    })
  }, [rotation])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(() => {
    const u = material.uniforms
    u.uOpacity.value = state.opacity
    u.uGrid.value = state.grid
    u.uGlowIntensity.value = state.glow
    u.uAmbient.value = state.ambient
    ;(u.uGlowPos.value as Vector3).set(0, state.glowHeight, 0)
    if (meshRef.current) meshRef.current.visible = state.opacity > 0.001
  })

  return <mesh ref={meshRef} geometry={geometry} material={material} position={[0, PLANET_RADIUS, 0]} renderOrder={-1} />
}
