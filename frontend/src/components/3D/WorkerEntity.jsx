import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useVoidStore } from '../../store/voidStore'

export default function WorkerEntity({ worker, position }) {
  const groupRef = useRef()
  const coreRef = useRef()
  const ring1Ref = useRef()
  const ring2Ref = useRef()
  const particlesRef = useRef()
  const { selectedWorker, setSelectedWorker, setSelectedWorkerPosition } = useVoidStore()
  const isSelected = selectedWorker === worker.id

  // Status colors - ENDFIELDTOOLS palette
  const statusColor = useMemo(() => {
    switch (worker.status) {
      case 'idle': return '#AAAAAA'
      case 'working': return '#FFFF00'
      case 'communicating': return '#00C000'
      case 'error': return '#C00000'
      default: return '#AAAAAA'
    }
  }, [worker.status])

  // Store current world position for popup positioning
  const currentPositionRef = useRef([...position])

  // Dynamic animations
  useFrame((state) => {
    if (groupRef.current) {
      // Floating animation
      const baseY = position[1] || 0
      const animatedY = baseY + Math.sin(state.clock.elapsedTime * 0.8) * 0.08
      groupRef.current.position.y = animatedY
      groupRef.current.position.x = position[0] || 0
      groupRef.current.position.z = position[2] || 0
      
      // Update current position for popup
      currentPositionRef.current = [
        groupRef.current.position.x,
        groupRef.current.position.y + 0.8,
        groupRef.current.position.z
      ]
      
      // Core rotation - faster when working
      if (coreRef.current) {
        const speed = worker.status === 'working' ? 0.02 : 0.005
        coreRef.current.rotation.x += speed
        coreRef.current.rotation.y += speed * 1.3
        coreRef.current.rotation.z += speed * 0.7
      }
      
      // Orbital rings rotation
      if (ring1Ref.current) {
        ring1Ref.current.rotation.y += worker.status === 'working' ? 0.03 : 0.01
      }
      if (ring2Ref.current) {
        ring2Ref.current.rotation.y -= worker.status === 'working' ? 0.02 : 0.008
        ring2Ref.current.rotation.x += 0.005
      }
      
      // Particle rotation
      if (particlesRef.current) {
        particlesRef.current.rotation.y += 0.015
      }
    }
  })

  const handleClick = (e) => {
    e.stopPropagation()
    const currentPos = currentPositionRef.current || [
      position[0],
      (position[1] || 0) + 0.8,
      position[2]
    ]
    setSelectedWorker(worker.id)
    setSelectedWorkerPosition(currentPos)
  }

  const clickProps = {
    onClick: handleClick,
    onPointerOver: (e) => {
      e.stopPropagation()
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      document.body.style.cursor = 'default'
    }
  }

  return (
    <group
      ref={groupRef}
      position={position}
      {...clickProps}
    >
      {/* Base platform - hexagonal tech base */}
      <mesh 
        position={[0, 0, 0]} 
        receiveShadow
        {...clickProps}
      >
        <cylinderGeometry args={[0.6, 0.6, 0.05, 6]} />
        <meshStandardMaterial
          color="#1A1A1A"
          emissive={statusColor}
          emissiveIntensity={worker.status === 'working' ? 0.3 : 0.1}
          roughness={0.8}
          metalness={0.3}
        />
      </mesh>

      {/* Energy column from base */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 0.3, 8]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={worker.status === 'working' ? 1.0 : 0.5}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Core geometric structure - octahedron */}
      <group ref={coreRef} position={[0, 0.5, 0]} {...clickProps}>
        <mesh>
          <octahedronGeometry args={[0.25, 0]} />
          <meshStandardMaterial
            color={statusColor}
            emissive={statusColor}
            emissiveIntensity={isSelected ? 2.0 : (worker.status === 'working' ? 1.5 : 0.9)}
            metalness={0.95}
            roughness={0.05}
          />
        </mesh>
        
        {/* Inner core */}
        <mesh>
          <octahedronGeometry args={[0.15, 0]} />
          <meshStandardMaterial
            color="#FFFFFF"
            emissive={statusColor}
            emissiveIntensity={isSelected ? 2.5 : 1.8}
            metalness={1.0}
            roughness={0.0}
          />
        </mesh>
      </group>

      {/* Orbital ring 1 - horizontal */}
      <mesh ref={ring1Ref} position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.35, 0.015, 16, 32]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={worker.status === 'working' ? 1.2 : 0.6}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Orbital ring 2 - tilted */}
      <mesh ref={ring2Ref} position={[0, 0.5, 0]} rotation={[Math.PI / 3, 0, Math.PI / 4]}>
        <torusGeometry args={[0.4, 0.012, 16, 32]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={worker.status === 'working' ? 1.0 : 0.5}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Energy particles - small orbiting spheres */}
      <group ref={particlesRef} position={[0, 0.5, 0]}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const angle = (i / 6) * Math.PI * 2
          const radius = 0.45
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * radius, Math.sin(angle * 2) * 0.2, Math.sin(angle) * radius]}
            >
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshStandardMaterial
                color={statusColor}
                emissive={statusColor}
                emissiveIntensity={worker.status === 'working' ? 2.0 : 1.0}
              />
            </mesh>
          )
        })}
      </group>

      {/* Worker label */}
      <Text
        position={[0, 1.0, 0]}
        fontSize={0.12}
        color={isSelected ? '#FFFF00' : statusColor}
        anchorX="center"
        anchorY="middle"
        maxWidth={2}
        fontWeight={isSelected ? 700 : 600}
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {worker.name || worker.model || 'Worker'}
      </Text>

      {/* Role indicator badge */}
      {worker.role && (
        <Text
          position={[0, 0.85, 0]}
          fontSize={0.08}
          color={statusColor}
          anchorX="center"
          anchorY="middle"
          fontWeight={500}
          outlineWidth={0.015}
          outlineColor="#000000"
        >
          {worker.role.toUpperCase()}
        </Text>
      )}

      {/* Connection lines to other workers (when communicating) - energy beams */}
      {Array.isArray(worker.communicatingWith) && worker.communicatingWith.length > 0 && (
        <>
          {worker.communicatingWith.map((targetId) => {
            const allWorkers = useVoidStore.getState().workers
            const targetWorker = allWorkers.find(w => w.id === targetId)
            if (!targetWorker || !targetWorker.position) return null
            
            const targetPos = targetWorker.position
            const dx = targetPos[0] - position[0]
            const dy = (targetPos[1] || 0) - (position[1] || 0)
            const dz = targetPos[2] - position[2]
            const distance = Math.sqrt(dx * dx + dz * dz)
            if (distance < 0.1) return null
            
            const midX = (position[0] + targetPos[0]) / 2
            const midY = ((position[1] || 0) + (targetPos[1] || 0)) / 2 + 0.5
            const midZ = (position[2] + targetPos[2]) / 2
            const angle = Math.atan2(dx, dz)
            const verticalAngle = Math.atan2(dy, distance)

            return (
              <mesh
                key={targetId}
                position={[midX, midY, midZ]}
                rotation={[0, angle, verticalAngle]}
              >
                <cylinderGeometry args={[0.015, 0.015, distance, 8]} />
                <meshStandardMaterial
                  color="#00C000"
                  emissive="#00C000"
                  emissiveIntensity={1.5}
                  transparent
                  opacity={0.8}
                />
              </mesh>
            )
          })}
        </>
      )}

      {/* Selection highlight - pulsing energy field */}
      {isSelected && (
        <>
          <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.65, 0.7, 32]} />
            <meshStandardMaterial
              color="#FFFF00"
              emissive="#FFFF00"
              emissiveIntensity={1.2}
              transparent
              opacity={0.7}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Outer selection ring */}
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.55, 16, 16]} />
            <meshStandardMaterial
              color="#FFFF00"
              emissive="#FFFF00"
              emissiveIntensity={0.5}
              transparent
              opacity={0.15}
              wireframe
            />
          </mesh>
        </>
      )}

      {/* Status-based light emission */}
      <pointLight
        position={[0, 0.5, 0]}
        color={statusColor}
        intensity={worker.status === 'working' ? 1.0 : 0.6}
        distance={4}
        decay={2}
      />
      
      {/* Additional spot light for working state */}
      {worker.status === 'working' && (
        <spotLight
          position={[0, 1.0, 0]}
          angle={Math.PI / 4}
          penumbra={0.5}
          color={statusColor}
          intensity={0.8}
          distance={3}
        />
      )}
    </group>
  )
}
