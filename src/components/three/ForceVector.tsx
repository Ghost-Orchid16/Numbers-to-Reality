import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { ConeGeometry, CylinderGeometry, MeshBasicMaterial, Quaternion, Vector3, type Group, type Mesh } from 'three'
import type { VectorState } from './vectorState'

const UP = new Vector3(0, 1, 0)

/**
 * An arrow for a vector quantity. Its state is read every frame from a
 * mutable object, so a moving, growing vector costs no React renders.
 */
export function ForceVector({ color, state }: { color: string; state: VectorState }) {
  const groupRef = useRef<Group>(null)
  const shaftRef = useRef<Mesh>(null)
  const headRef = useRef<Mesh>(null)

  const assets = useMemo(() => {
    const shaft = new CylinderGeometry(0.5, 0.5, 1, 12, 1)
    shaft.translate(0, 0.5, 0)
    const head = new ConeGeometry(1, 1, 16, 1)
    head.translate(0, 0.5, 0)
    // Drawn on top of geometry so vectors stay readable against the rocket.
    const material = new MeshBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
    return { shaft, head, material }
  }, [color])

  useEffect(
    () => () => {
      assets.shaft.dispose()
      assets.head.dispose()
      assets.material.dispose()
    },
    [assets],
  )

  const q = useMemo(() => new Quaternion(), [])
  const dir = useMemo(() => new Vector3(), [])

  useFrame(() => {
    const group = groupRef.current
    const shaft = shaftRef.current
    const head = headRef.current
    if (!group || !shaft || !head) return
    const len = state.length
    dir.copy(state.direction)
    const visible = state.opacity > 0.01 && len > 1e-6 && dir.lengthSq() > 0
    group.visible = visible
    if (!visible) return
    dir.normalize()
    q.setFromUnitVectors(UP, dir)
    group.position.copy(state.origin)
    group.quaternion.copy(q)
    const t = state.thickness
    // Head: 4.5 shaft-widths long, but never more than 40% of a short arrow.
    const headLength = Math.min(t * 4.5, len * 0.4)
    const headRadius = Math.max(headLength * 0.42, t * 1.1)
    shaft.scale.set(t, Math.max(len - headLength, 0), t)
    head.position.set(0, Math.max(len - headLength, 0), 0)
    head.scale.set(headRadius, headLength, headRadius)
    assets.material.opacity = state.opacity
  })

  return (
    <group ref={groupRef} renderOrder={20}>
      <mesh ref={shaftRef} geometry={assets.shaft} material={assets.material} renderOrder={20} />
      <mesh ref={headRef} geometry={assets.head} material={assets.material} renderOrder={20} />
    </group>
  )
}
