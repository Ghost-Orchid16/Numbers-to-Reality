import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, ShaderMaterial, Vector3, type Group } from 'three'
import { PLANET_RADIUS } from '../../sim/rocket/vehicle'
import { SUN_DIRECTION, skyBrightness } from './environment'

const SKY_RADIUS = 5e8

const skyVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`

const skyFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uUp;
  uniform vec3 uSun;
  uniform float uBrightness;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform vec3 uGround;
  varying vec3 vDir;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 d = normalize(vDir);
    float h = dot(d, uUp);
    // Direction toward the Sun projected onto the local horizon.
    vec3 sunH = normalize(uSun - dot(uSun, uUp) * uUp);
    float toward = max(dot(normalize(d - h * uUp), sunH), 0.0);
    float above = max(h, 0.0);

    vec3 color = mix(uZenith, uHorizon, exp(-above * 4.0));
    // Afterglow low in the west, where the Sun went down.
    color += uGlow * pow(toward, 4.0) * exp(-above * 14.0);
    // Below the horizon: haze over the ground.
    if (h < 0.0) color = mix(uHorizon * 0.6, uGround, smoothstep(0.0, 0.2, -h));
    gl_FragColor = vec4(color * uBrightness, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const starVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aMag;
  uniform float uPixelRatio;
  varying float vMag;
  void main() {
    vMag = aMag;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (0.8 + aMag * 1.8) * uPixelRatio;
    #include <logdepthbuf_vertex>
  }
`

const starFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uVisibility;
  varying float vMag;
  void main() {
    #include <logdepthbuf_fragment>
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, r) * (0.25 + 0.75 * vMag) * uVisibility;
    gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a, 1.0);
  }
`

/** Deterministic pseudo-random numbers, so the star field never changes. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function createStarGeometry(count: number): BufferGeometry {
  const rand = mulberry32(1687)
  const positions = new Float32Array(count * 3)
  const mags = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    // Uniform on the sphere.
    const u = rand() * 2 - 1
    const phi = rand() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    const r = SKY_RADIUS * 0.9
    positions[i * 3] = r * s * Math.cos(phi)
    positions[i * 3 + 1] = r * u
    positions[i * 3 + 2] = r * s * Math.sin(phi)
    // Many faint stars, few bright ones.
    mags[i] = Math.pow(rand(), 4)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(positions, 3))
  g.setAttribute('aMag', new BufferAttribute(mags, 1))
  return g
}

/**
 * Sky dome and stars, centred on the camera so they always sit at infinity.
 * The twilight sky darkens with altitude exactly as the model air thins.
 */
export function Sky({ starCount = 2200 }: { starCount?: number }) {
  const groupRef = useRef<Group>(null)
  const up = useMemo(() => new Vector3(0, 1, 0), [])

  const skyMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        uniforms: {
          uUp: { value: up },
          uSun: { value: SUN_DIRECTION },
          uBrightness: { value: 1 },
          uZenith: { value: new Color('#04070f') },
          uHorizon: { value: new Color('#16223a') },
          uGlow: { value: new Color('#4a2716') },
          uGround: { value: new Color('#05070b') },
        },
        side: BackSide,
        depthWrite: false,
      }),
    [up],
  )
  const starMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: starVertex,
        fragmentShader: starFragment,
        uniforms: { uVisibility: { value: 0.3 }, uPixelRatio: { value: 1 } },
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  )
  const starGeometry = useMemo(() => createStarGeometry(starCount), [starCount])

  useEffect(
    () => () => {
      skyMaterial.dispose()
      starMaterial.dispose()
      starGeometry.dispose()
    },
    [skyMaterial, starMaterial, starGeometry],
  )

  useFrame(({ camera, gl }) => {
    const g = groupRef.current
    if (!g) return
    g.position.copy(camera.position)
    const r = camera.position.length()
    up.copy(camera.position).divideScalar(r)
    const brightness = skyBrightness(r - PLANET_RADIUS)
    skyMaterial.uniforms.uBrightness.value = brightness
    starMaterial.uniforms.uVisibility.value = 0.2 + 0.8 * (1 - Math.min(1, brightness * 3))
    starMaterial.uniforms.uPixelRatio.value = gl.getPixelRatio()
  })

  return (
    <group ref={groupRef}>
      <mesh material={skyMaterial} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[SKY_RADIUS, 48, 24]} />
      </mesh>
      <points geometry={starGeometry} material={starMaterial} renderOrder={-9} frustumCulled={false} />
    </group>
  )
}
