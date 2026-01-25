import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function RainEffect({ count = 1000 }) {
  const rainRef = useRef()
  
  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count)
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50
      positions[i * 3 + 1] = Math.random() * 50
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50
      velocities[i] = 0.5 + Math.random() * 0.5
    }
    
    return { positions, velocities }
  }, [count])

  useFrame((state, delta) => {
    if (rainRef.current) {
      const positions = rainRef.current.geometry.attributes.position.array
      
      for (let i = 0; i < count; i++) {
        positions[i * 3 + 1] -= velocities[i] * delta * 10
        
        if (positions[i * 3 + 1] < -25) {
          positions[i * 3 + 1] = 25
        }
      }
      
      rainRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  return (
    <points ref={rainRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        color="#00ffff"
        transparent
        opacity={0.6}
      />
    </points>
  )
}
