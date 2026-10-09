import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Color, InstancedBufferAttribute, InstancedBufferGeometry, PlaneGeometry, ShaderMaterial, Vector3 } from 'three'
import { PLANET_RADIUS } from '../../sim/rocket/vehicle'
import { useRocketScene } from './sceneState'

/** Smoke stops being emitted this long after ignition (s). */
const EMISSION_WINDOW = 24
const LIFETIME = 34

const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec4 aSeed;
  attribute float aEmit;
  uniform float uTime;
  uniform vec3 uNozzle;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vWarm;
  varying float vSeed;

  void main() {
    float age = uTime - aEmit;
    float life = ${LIFETIME.toFixed(1)} * (0.65 + 0.35 * aSeed.w);
    if (age <= 0.0 || age >= life) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    // Two flame-trench exits (north and south) plus a column around the mount.
    float side = aSeed.x < 0.42 ? -1.0 : (aSeed.x < 0.84 ? 1.0 : 0.0);
    float spread = (aSeed.y - 0.5) * 1.3;
    vec3 dir = side == 0.0
      ? normalize(vec3(cos(aSeed.y * 6.283), 0.0, sin(aSeed.y * 6.283)))
      : normalize(vec3(sin(spread), 0.0, side * cos(spread)));
    vec3 start = side == 0.0 ? vec3(0.0, 4.0, 0.0) : vec3(0.0, 1.5, side * 34.0);
    float speed = side == 0.0 ? 14.0 : 30.0 + 40.0 * aSeed.z;
    float tau = 3.2;
    float travel = speed * tau * (1.0 - exp(-age / tau));
    // Buoyant hot gas rises, accelerating at first, then levels off.
    float rise = (side == 0.0 ? 6.0 : 2.5) * age + 0.12 * age * age;
    vec3 center = start + dir * travel + vec3(0.0, min(rise, 220.0), 0.0);
    center += vec3(sin(age * 0.6 + aSeed.y * 9.0), 0.0, cos(age * 0.5 + aSeed.z * 7.0)) * age * 1.5;

    float size = (9.0 + 15.0 * sqrt(age)) * (0.7 + 0.6 * aSeed.z);
    vec4 mv = modelViewMatrix * vec4(center, 1.0);
    float angle = aSeed.w * 6.283 + age * 0.05;
    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    mv.xy += rot * position.xy * size;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>

    vUv = position.xy + 0.5;
    vSeed = aSeed.x;
    vAlpha = smoothstep(0.0, 0.8, age) * (1.0 - smoothstep(life * 0.5, life, age));
    // Glow from the engines, strongest close to the plume and while young.
    float d = distance(center, uNozzle);
    vWarm = exp(-d / 90.0) * exp(-age / 6.0);
  }
`

const fragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uSmoke;
  uniform vec3 uWarm;
  uniform float uGlow;
  uniform float uAmbient;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vWarm;
  varying float vSeed;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    #include <logdepthbuf_fragment>
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float puff = 0.65 + 0.35 * noise(vUv * 4.0 + vSeed * 17.0);
    float a = smoothstep(1.0, 0.25, r) * puff * vAlpha * 0.5;
    if (a < 0.004) discard;
    vec3 color = uSmoke * uAmbient + uWarm * vWarm * uGlow;
    gl_FragColor = vec4(color, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Exhaust smoke and steam from the flame trench. Each puff's position is a
 * closed-form function of mission time, so scrubbing backwards un-billows it.
 */
export function Smoke({ count }: { count: number }) {
  const { state } = useRocketScene()

  const assets = useMemo(() => {
    const quad = new PlaneGeometry(1, 1)
    const geometry = new InstancedBufferGeometry()
    geometry.index = quad.index
    geometry.setAttribute('position', quad.getAttribute('position'))
    const rand = mulberry32(39)
    const seeds = new Float32Array(count * 4)
    const emits = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 4; k++) seeds[i * 4 + k] = rand()
      // Front-loaded: most smoke appears in the first seconds after ignition.
      emits[i] = EMISSION_WINDOW * rand() ** 1.8
    }
    geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4))
    geometry.setAttribute('aEmit', new InstancedBufferAttribute(emits, 1))
    geometry.instanceCount = count
    quad.dispose()
    const material = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uTime: { value: -10 },
        uNozzle: { value: new Vector3() },
        uSmoke: { value: new Color('#8a929c') },
        uWarm: { value: new Color('#ff9a4a') },
        uGlow: { value: 0 },
        uAmbient: { value: 0.3 },
      },
      transparent: true,
      depthWrite: false,
    })
    return { geometry, material }
  }, [count])

  useEffect(
    () => () => {
      assets.geometry.dispose()
      assets.material.dispose()
    },
    [assets],
  )

  useFrame(() => {
    const u = assets.material.uniforms
    u.uTime.value = state.time
    ;(u.uNozzle.value as Vector3).copy(state.rocketPosition).sub(PAD)
    u.uGlow.value = state.throttle * 1.6
    u.uAmbient.value = 0.08 + 0.25 * state.rocketSky
  })

  return <mesh geometry={assets.geometry} material={assets.material} position={[0, PLANET_RADIUS, 0]} frustumCulled={false} renderOrder={7} />
}

const PAD = new Vector3(0, PLANET_RADIUS, 0)
