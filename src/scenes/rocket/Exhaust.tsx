import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, CanvasTexture, Color, CylinderGeometry, DoubleSide, ShaderMaterial, SpriteMaterial, type Mesh, type Sprite } from 'three'
import { NOZZLE_EXIT } from './RocketModel'
import { useRocketScene } from './sceneState'

const plumeVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform float uLength;
  uniform float uRadius;
  uniform float uExpansion;
  uniform float uTime;
  varying float vS;
  varying vec3 vViewNormal;
  varying vec3 vViewPos;
  void main() {
    float s = -position.y;
    vS = s;
    // Sea level: slim, slightly necked flame. Vacuum: a wide, under-expanded bell.
    float seaLevel = 1.0 + 0.45 * s - 0.3 * smoothstep(0.0, 0.2, s) * (1.0 - s);
    float vacuum = 1.0 + 24.0 * pow(s, 0.55);
    float r = uRadius * mix(seaLevel, vacuum, uExpansion);
    r *= 1.0 + 0.035 * sin(uTime * 37.0 + s * 23.0) * s;
    vec3 p = vec3(position.x * r, -s * uLength, position.z * r);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vViewPos = mv.xyz;
    vViewNormal = normalize(normalMatrix * vec3(position.x, 0.0, position.z));
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`

const plumeFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uThrottle;
  uniform float uExpansion;
  uniform float uSunlit;
  uniform float uTime;
  uniform vec3 uCore;
  uniform vec3 uMid;
  uniform vec3 uOuter;
  uniform vec3 uSunGlow;
  varying float vS;
  varying vec3 vViewNormal;
  varying vec3 vViewPos;

  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
  }

  void main() {
    #include <logdepthbuf_fragment>
    float s = vS;
    float facing = abs(dot(normalize(vViewNormal), normalize(-vViewPos)));
    float body = pow(facing, 1.4);

    float core = exp(-s * 10.0) * (1.0 - 0.6 * uExpansion);
    float flame = exp(-s * (2.4 + 2.0 * uExpansion));
    // Shock diamonds: standing waves in an over-expanded jet near sea level.
    float diamonds = pow(0.5 + 0.5 * cos(s * 50.0), 10.0) * exp(-s * 5.5) * (1.0 - uExpansion);
    float flicker = 0.85 + 0.3 * noise(s * 14.0 - uTime * 28.0);

    vec3 color = uCore * core * 2.0
      + mix(uMid, uOuter, smoothstep(0.0, 0.65, s)) * flame * flicker
      + uCore * diamonds * 1.2;
    color *= body;

    // High up, the thin expanded plume catches sunlight above the Earth's shadow.
    float halo = (1.0 - smoothstep(0.05, 1.0, s)) * uExpansion * uSunlit * pow(facing, 0.6);
    color += uSunGlow * halo * 0.3;

    color *= smoothstep(0.0, 0.025, s) * (1.0 - smoothstep(0.7, 1.0, s));
    gl_FragColor = vec4(color * uThrottle, 1.0);
  }
`

/** Radial gradient for the glare around the engines. */
function createGlowTexture(): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,248,230,1)')
  g.addColorStop(0.12, 'rgba(255,214,150,0.75)')
  g.addColorStop(0.35, 'rgba(255,150,70,0.22)')
  g.addColorStop(1, 'rgba(255,120,40,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

/**
 * Engine plume and glare, in the rocket's local frame (nozzles at the bottom).
 * The glare keeps a minimum on-screen size, so from 1,000 km away the rocket
 * still reads as a bright point — as it does in long-exposure launch photos.
 */
export function Exhaust() {
  const { state } = useRocketScene()
  const plumeRef = useRef<Mesh>(null)
  const glowRef = useRef<Sprite>(null)

  const assets = useMemo(() => {
    const geometry = new CylinderGeometry(1, 1, 1, 32, 40, true)
    geometry.translate(0, -0.5, 0)
    const material = new ShaderMaterial({
      vertexShader: plumeVertex,
      fragmentShader: plumeFragment,
      uniforms: {
        uLength: { value: 50 },
        uRadius: { value: 1.9 },
        uExpansion: { value: 0 },
        uThrottle: { value: 0 },
        uSunlit: { value: 0 },
        uTime: { value: 0 },
        uCore: { value: new Color('#fff3dc') },
        uMid: { value: new Color('#ffb547') },
        uOuter: { value: new Color('#ff5a2a') },
        uSunGlow: { value: new Color('#bcd6ff') },
      },
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    })
    const glowTexture = createGlowTexture()
    const glowMaterial = new SpriteMaterial({ map: glowTexture, blending: AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })
    return { geometry, material, glowTexture, glowMaterial }
  }, [])

  useEffect(
    () => () => {
      for (const value of Object.values(assets)) value.dispose()
    },
    [assets],
  )

  useFrame(({ clock }) => {
    const u = assets.material.uniforms
    const throttle = state.throttle
    const expansion = state.plumeExpansion
    u.uThrottle.value = throttle > 0 ? 0.35 + 0.65 * throttle : 0
    u.uExpansion.value = expansion
    u.uSunlit.value = state.rocketSunlight
    u.uTime.value = clock.elapsedTime
    // The visible jet lengthens as the surrounding air thins.
    u.uLength.value = 55 + 700 * expansion * expansion
    if (plumeRef.current) plumeRef.current.visible = throttle > 0
    const glow = glowRef.current
    if (glow) {
      glow.visible = throttle > 0
      // Never smaller than ~1.2% of the view, so it stays visible from orbit distances.
      const size = Math.max(26 * (0.6 + 0.4 * throttle), state.cameraDistance * 0.012)
      glow.scale.set(size, size, 1)
      assets.glowMaterial.opacity = Math.min(1, 0.55 + 0.45 * throttle)
    }
  })

  return (
    <group position={[0, NOZZLE_EXIT, 0]}>
      <mesh ref={plumeRef} geometry={assets.geometry} material={assets.material} renderOrder={8} frustumCulled={false} />
      <sprite ref={glowRef} material={assets.glowMaterial} position={[0, -1.5, 0]} renderOrder={9} />
    </group>
  )
}
