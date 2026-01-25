import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useVoidStore } from '../../store/voidStore'
import * as THREE from 'three'

export default function DroneSwarm() {
  const dronesRef = useRef([])
  const { activeSwarms } = useVoidStore()
  
  // Create drones based on active swarms (each swarm = 4 agents: architect, builder, optimizer, tester)
  const agentCount = activeSwarms.length * 4
  const drones = activeSwarms.flatMap((swarm, swarmIndex) => {
    const roles = ['Architect', 'Builder', 'Optimizer', 'Tester']
    return roles.map((role, roleIndex) => ({
      id: `${swarm.id}-${role}`,
      swarmId: swarm.id,
      role,
      swarmIndex,
      roleIndex,
      status: swarm.status
    }))
  })

  useFrame((state) => {
    dronesRef.current.forEach((drone, i) => {
      if (drone && drones[i]) {
        const time = state.clock.elapsedTime
        const droneData = drones[i]
        const baseRadius = 8
        const swarmOffset = droneData.swarmIndex * 2
        const roleOffset = droneData.roleIndex * 0.3
        
        // Orbit around center with swarm-specific patterns
        const angle = (time * 0.3 + swarmOffset + roleOffset) % (Math.PI * 2)
        const radius = baseRadius + swarmOffset + Math.sin(time + i) * 1
        
        drone.position.x = Math.cos(angle) * radius
        drone.position.z = Math.sin(angle) * radius
        drone.position.y = 3 + Math.sin(time * 1.5 + i) * 2 + swarmOffset * 0.5
        
        // Rotate to face direction of travel
        drone.rotation.y = angle + Math.PI / 2
        drone.rotation.x = Math.sin(time * 0.5 + i) * 0.1
        drone.rotation.z = Math.cos(time * 0.3 + i) * 0.05
      }
    })
  })

  if (drones.length === 0) return null

  return (
    <group>
      {drones.map((droneData, i) => {
        const statusColor = droneData.status === 'completed' ? '#00ff00' : 
                           droneData.status === 'error' ? '#ff00ff' : '#00ffff'
        
        return (
          <group
            key={droneData.id}
            ref={(el) => (dronesRef.current[i] = el)}
          >
            {/* Main satellite body - hexagonal prism */}
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.8, 0.8, 0.4, 6]} />
              <meshStandardMaterial
                color={statusColor}
                emissive={statusColor}
                emissiveIntensity={0.6}
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
            
            {/* Top panel */}
            <mesh position={[0, 0.25, 0]}>
              <boxGeometry args={[1, 0.1, 1]} />
              <meshStandardMaterial
                color="#1a1a1a"
                emissive={statusColor}
                emissiveIntensity={0.3}
              />
            </mesh>
            
            {/* Antenna array */}
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.3]} />
              <meshStandardMaterial
                color={statusColor}
                emissive={statusColor}
                emissiveIntensity={1}
              />
            </mesh>
            
            {/* Solar panels (4 sides) */}
            {[0, 1, 2, 3].map((side) => {
              const angle = (side * Math.PI) / 2
              return (
                <mesh
                  key={side}
                  position={[
                    Math.cos(angle) * 0.6,
                    0,
                    Math.sin(angle) * 0.6
                  ]}
                  rotation={[0, angle, 0]}
                >
                  <boxGeometry args={[0.6, 0.3, 0.05]} />
                  <meshStandardMaterial
                    color="#003366"
                    emissive="#0066ff"
                    emissiveIntensity={0.4}
                  />
                </mesh>
              )
            })}
            
            {/* Central processing core (glowing) */}
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshStandardMaterial
                color={statusColor}
                emissive={statusColor}
                emissiveIntensity={1.5}
              />
            </mesh>
            
            {/* Status indicator lights */}
            <pointLight
              position={[0, 0.5, 0]}
              color={statusColor}
              intensity={1}
              distance={5}
            />
            
            {/* Orbital trail effect */}
            <mesh position={[0, -0.3, 0]}>
              <ringGeometry args={[0.3, 0.5, 16]} />
              <meshStandardMaterial
                color={statusColor}
                transparent
                opacity={0.3}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
