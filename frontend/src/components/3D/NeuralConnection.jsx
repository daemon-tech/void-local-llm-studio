import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function NeuralConnection({ from, to, active = false, strength = 0.5 }) {
  const lineRef = useRef()
  const pulseRef = useRef()
  
  // Calculate connection geometry
  const { points, distance } = useMemo(() => {
    const fromPos = new THREE.Vector3(...from)
    const toPos = new THREE.Vector3(...to)
    const dist = fromPos.distanceTo(toPos)
    
    const points = [
      new THREE.Vector3(...from),
      new THREE.Vector3(...to)
    ]
    
    return { points, distance: dist }
  }, [from, to])

  useFrame((state) => {
    if (lineRef.current && lineRef.current.material) {
      // Pulsing glow for active connections
      if (active) {
        const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.3 + 0.7
        lineRef.current.material.opacity = 0.3 + pulse * 0.4
        // Update color intensity for pulsing effect
        const intensity = pulse * strength
        lineRef.current.material.color.setRGB(intensity, intensity, 0)
      } else {
        lineRef.current.material.opacity = 0.2
        lineRef.current.material.color.setRGB(0.2, 0.2, 0)
      }
    }
    
    // Animate pulse along connection
    if (pulseRef.current && active) {
      const progress = (state.clock.elapsedTime * 0.5) % 1
      const fromPos = new THREE.Vector3(...from)
      const toPos = new THREE.Vector3(...to)
      pulseRef.current.position.lerpVectors(fromPos, toPos, progress)
    }
  })

  const geometry = useMemo(() => {
    const curve = new THREE.LineCurve3(
      new THREE.Vector3(...from),
      new THREE.Vector3(...to)
    )
    return new THREE.BufferGeometry().setFromPoints(curve.getPoints(50))
  }, [from, to])

  const lineMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: '#FFFF00',
      transparent: true,
      opacity: active ? 0.6 : 0.2,
      linewidth: active ? 3 : 1
    })
  }, [active])

  const glowMaterial = useMemo(() => {
    if (!active) return null
    return new THREE.LineBasicMaterial({
      color: '#FFFF00',
      transparent: true,
      opacity: 0.3,
      linewidth: 5
    })
  }, [active])

  return (
    <group>
      {/* Main connection line */}
      <line ref={lineRef} geometry={geometry} material={lineMaterial} />
      
      {/* Glow effect for active connections */}
      {active && glowMaterial && (
        <line geometry={geometry} material={glowMaterial} />
      )}
      
      {/* Traveling pulse */}
      {active && (
        <mesh ref={pulseRef}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial
            color="#FFFF00"
            emissive="#FFFF00"
            emissiveIntensity={3.0}
          />
        </mesh>
      )}
    </group>
  )
}
