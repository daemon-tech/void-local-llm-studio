import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useVoidStore } from '../../store/voidStore'

export default function NeuralHub() {
  const hubRef = useRef()
  const coreRef = useRef()
  const ring1Ref = useRef()
  const ring2Ref = useRef()
  const ring3Ref = useRef()
  const ring4Ref = useRef()
  const ring5Ref = useRef()
  const particlesRef = useRef()
  const { workers, projectRoot } = useVoidStore()
  
  // Count active workers
  const activeWorkers = workers.filter(w => w.status === 'working').length
  const totalWorkers = workers.length
  
  // Array of ring refs - created once
  const ringsRef = useMemo(() => [
    ring1Ref, ring2Ref, ring3Ref, ring4Ref, ring5Ref
  ], [])

  useFrame((state) => {
    if (hubRef.current) {
      // Pulsing animation based on activity
      const pulseIntensity = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1
      const activityLevel = activeWorkers / Math.max(totalWorkers, 1)
      const baseScale = 0.8 + activityLevel * 0.3
      hubRef.current.scale.setScalar(baseScale * pulseIntensity)
    }
    
    if (coreRef.current) {
      // Core rotation - faster with more activity
      const speed = 0.01 + activeWorkers * 0.005
      coreRef.current.rotation.x += speed
      coreRef.current.rotation.y += speed * 1.2
      coreRef.current.rotation.z += speed * 0.8
    }
    
    // Rotate rings at different speeds
    ringsRef.forEach((ringRef, i) => {
      if (ringRef.current) {
        const speed = (i + 1) * 0.01 * (i % 2 === 0 ? 1 : -1)
        ringRef.current.rotation.y += speed
        ringRef.current.rotation.x += speed * 0.5
      }
    })
    
    // Rotate particles
    if (particlesRef.current) {
      particlesRef.current.rotation.y += 0.02
      particlesRef.current.rotation.x += 0.01
    }
  })

  // Generate particles around hub
  const particles = useMemo(() => {
    const count = 20
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2
      const radius = 1.5 + Math.random() * 0.5
      const height = (Math.random() - 0.5) * 1.5
      return {
        angle,
        radius,
        height,
        speed: 0.5 + Math.random() * 0.5
      }
    })
  }, [])

  return (
    <group ref={hubRef} position={[0, 4, 0]}>
      {/* Central Core - Pulsing Brain */}
      <group ref={coreRef}>
        {/* Outer shell - Icosahedron */}
        <mesh>
          <icosahedronGeometry args={[0.8, 1]} />
          <meshStandardMaterial
            color="#FFFF00"
            emissive="#FFFF00"
            emissiveIntensity={0.8}
            metalness={0.9}
            roughness={0.1}
            transparent
            opacity={0.7}
          />
        </mesh>
        
        {/* Inner core - Dodecahedron */}
        <mesh>
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial
            color="#FFFFFF"
            emissive="#FFFF00"
            emissiveIntensity={2.0}
            metalness={1.0}
            roughness={0.0}
          />
        </mesh>
        
        {/* Innermost core */}
        <mesh>
          <octahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial
            color="#FFFF00"
            emissive="#FFFF00"
            emissiveIntensity={3.0}
            metalness={1.0}
            roughness={0.0}
          />
        </mesh>
      </group>

      {/* Orbital Rings */}
      {ringsRef.map((ringRef, i) => (
        <mesh
          key={i}
          ref={ringRef}
          rotation={[Math.PI / (i + 2), 0, Math.PI / (i + 3)]}
        >
          <torusGeometry args={[0.9 + i * 0.2, 0.02, 16, 32]} />
          <meshStandardMaterial
            color="#FFFF00"
            emissive="#FFFF00"
            emissiveIntensity={1.0 - i * 0.15}
            transparent
            opacity={0.8 - i * 0.1}
          />
        </mesh>
      ))}

      {/* Energy Particles */}
      <group ref={particlesRef}>
        {particles.map((particle, i) => {
          const x = Math.cos(particle.angle) * particle.radius
          const z = Math.sin(particle.angle) * particle.radius
          return (
            <mesh key={i} position={[x, particle.height, z]}>
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshStandardMaterial
                color="#FFFF00"
                emissive="#FFFF00"
                emissiveIntensity={2.0}
              />
            </mesh>
          )
        })}
      </group>

      {/* Hub Label */}
      <Text
        position={[0, -1.2, 0]}
        fontSize={0.3}
        color="#FFFF00"
        anchorX="center"
        anchorY="middle"
        fontWeight={700}
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        VOID
      </Text>

      {/* Activity Indicator */}
      {projectRoot && (
        <Text
          position={[0, -1.5, 0]}
          fontSize={0.15}
          color="#AAAAAA"
          anchorX="center"
          anchorY="middle"
          fontWeight={500}
          outlineWidth={0.03}
          outlineColor="#000000"
        >
          {projectRoot.split(/[/\\]/).pop() || 'Project'}
        </Text>
      )}

      {/* Status Text */}
      <Text
        position={[0, -1.8, 0]}
        fontSize={0.12}
        color={activeWorkers > 0 ? "#00C000" : "#AAAAAA"}
        anchorX="center"
        anchorY="middle"
        fontWeight={600}
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {activeWorkers > 0 ? `${activeWorkers} ACTIVE` : 'IDLE'}
      </Text>

      {/* Central Light Source */}
      <pointLight
        position={[0, 0, 0]}
        color="#FFFF00"
        intensity={2.0}
        distance={20}
        decay={2}
      />
      
      {/* Additional spotlights */}
      <spotLight
        position={[0, 5, 0]}
        angle={Math.PI / 3}
        penumbra={0.5}
        color="#FFFF00"
        intensity={1.5}
        distance={15}
      />
      
      <spotLight
        position={[0, -2, 0]}
        angle={Math.PI / 4}
        penumbra={0.5}
        color="#FFFF00"
        intensity={1.0}
        distance={10}
      />
    </group>
  )
}
