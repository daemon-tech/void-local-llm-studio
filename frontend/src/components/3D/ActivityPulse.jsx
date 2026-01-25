import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function ActivityPulse({ from, to, color = '#FFFF00', speed = 2.0, onComplete }) {
  const pulseRef = useRef()
  const glowRef = useRef()
  const progressRef = useRef(0)
  const completedRef = useRef(false)
  const fromPos = useMemo(() => {
    if (!Array.isArray(from) || from.length !== 3) return new THREE.Vector3(0, 0, 0)
    return new THREE.Vector3(...from)
  }, [from])
  const toPos = useMemo(() => {
    if (!Array.isArray(to) || to.length !== 3) return new THREE.Vector3(0, 0, 0)
    return new THREE.Vector3(...to)
  }, [to])

  useFrame((state, delta) => {
    if (completedRef.current) return
    
    if (pulseRef.current && progressRef.current < 1) {
      progressRef.current += delta * speed
      
      if (progressRef.current >= 1) {
        progressRef.current = 1
        completedRef.current = true
        if (onComplete) {
          onComplete()
        }
        return
      }
      
      // Interpolate X and Z positions horizontally
      const currentPos = new THREE.Vector3()
      currentPos.x = fromPos.x + (toPos.x - fromPos.x) * progressRef.current
      currentPos.z = fromPos.z + (toPos.z - fromPos.z) * progressRef.current
      
      // Create very high arc - start from worker Y, arc way up high, end at hub
      const startY = fromPos.y // Start from worker position
      const endY = toPos.y // End at hub position
      const peakHeight = 50.0 // EXTREMELY high arc - way above everything
      // Parabolic arc: start at worker, peak very high in middle, end at hub
      const progress = progressRef.current
      // Use sine wave to create smooth arc that peaks at midpoint
      const arcY = startY + (endY - startY) * progress + Math.sin(progress * Math.PI) * peakHeight
      currentPos.y = arcY
      
      if (pulseRef.current) {
        pulseRef.current.position.copy(currentPos)
      }
      if (glowRef.current) {
        glowRef.current.position.copy(currentPos)
      }
      
      // Scale pulse as it travels
      const scale = 0.3 + progressRef.current * 0.7
      if (pulseRef.current) {
        pulseRef.current.scale.setScalar(scale)
      }
      if (glowRef.current) {
        glowRef.current.scale.setScalar(scale * 1.5)
      }
      
      // Fade out
      if (pulseRef.current && pulseRef.current.material) {
        pulseRef.current.material.opacity = 1 - progressRef.current * 0.5
      }
      if (glowRef.current && glowRef.current.material) {
        glowRef.current.material.opacity = (1 - progressRef.current) * 0.4
      }
    }
  })

  if (completedRef.current) return null

  return (
    <group>
      {/* Main pulse sphere - made bigger for visibility */}
      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={5.0}
          transparent
          opacity={1}
        />
      </mesh>
      
      {/* Glow effect - made bigger */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3.0}
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  )
}
