import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Color, FrontSide, ShaderMaterial, type Matrix4, type Mesh, type Vector3 } from 'three'
import { createPlanetSurfaceUniforms, PLANET_SURFACE_GLSL } from './planetSurface'

const globeVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vGeoNormal;
  varying vec3 vWorldNormal;
  void main() {
    vGeoNormal = normalize(position);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`

const globeFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  ${PLANET_SURFACE_GLSL}
  uniform vec3 uSunDir;
  uniform float uOpacity;
  varying vec3 vGeoNormal;
  varying vec3 vWorldNormal;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 base = planetSurface(normalize(vGeoNormal));
    float sun = dot(normalize(vWorldNormal), uSunDir);
    float day = smoothstep(-0.1, 0.3, sun);
    vec3 color = mix(base * 0.22, base * 2.4, day);
    // A faint warm band along the terminator.
    color += vec3(0.3, 0.1, 0.03) * 0.012 * exp(-pow(sun / 0.04, 2.0));
    gl_FragColor = vec4(color, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const atmosphereVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vViewNormal;
  varying vec3 vViewPos;
  varying vec3 vWorldNormal;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    vViewNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`

const atmosphereFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  uniform float uOpacity;
  varying vec3 vViewNormal;
  varying vec3 vViewPos;
  varying vec3 vWorldNormal;
  void main() {
    #include <logdepthbuf_fragment>
    float facing = abs(dot(normalize(vViewNormal), normalize(-vViewPos)));
    float rim = pow(1.0 - facing, 3.4);
    float lit = smoothstep(-0.35, 0.45, dot(normalize(vWorldNormal), uSunDir));
    vec3 color = uColor * rim * (0.08 + 0.7 * lit) * uOpacity;
    gl_FragColor = vec4(color, 1.0);
  }
`

interface EarthGlobeProps {
  radius: number
  /** Orientation of the geography (geo frame → world). */
  rotation: Matrix4
  /** Unit vector toward the Sun, world space. */
  sunDirection: Vector3
  /** Called every frame; return the globe's opacity (0 hides it). */
  opacity?: () => number
  /** Atmosphere shell thickness as a fraction of the radius. */
  atmosphere?: number
  segments?: number
}

export function EarthGlobe({ radius, rotation, sunDirection, opacity, atmosphere = 0.018, segments = 192 }: EarthGlobeProps) {
  const globeRef = useRef<Mesh>(null)
  const atmoRef = useRef<Mesh>(null)

  const globeMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: globeVertex,
        fragmentShader: globeFragment,
        uniforms: { ...createPlanetSurfaceUniforms(), uSunDir: { value: sunDirection }, uOpacity: { value: 1 } },
        side: FrontSide,
      }),
    [sunDirection],
  )

  const atmosphereMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        uniforms: { uColor: { value: new Color('#5b8fd6') }, uSunDir: { value: sunDirection }, uOpacity: { value: 1 } },
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: FrontSide,
      }),
    [sunDirection],
  )

  useEffect(
    () => () => {
      globeMaterial.dispose()
      atmosphereMaterial.dispose()
    },
    [globeMaterial, atmosphereMaterial],
  )

  useFrame(() => {
    const o = opacity ? opacity() : 1
    globeMaterial.uniforms.uOpacity.value = o
    globeMaterial.transparent = o < 0.999
    atmosphereMaterial.uniforms.uOpacity.value = o
    if (globeRef.current) globeRef.current.visible = o > 0.001
    if (atmoRef.current) atmoRef.current.visible = o > 0.001
  })

  return (
    <group matrixAutoUpdate={false} matrix={rotation}>
      <mesh ref={globeRef} material={globeMaterial} renderOrder={-2}>
        <sphereGeometry args={[radius, segments * 2, segments]} />
      </mesh>
      <mesh ref={atmoRef} material={atmosphereMaterial} renderOrder={5}>
        <sphereGeometry args={[radius * (1 + atmosphere), 128, 64]} />
      </mesh>
    </group>
  )
}
