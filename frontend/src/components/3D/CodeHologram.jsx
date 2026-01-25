import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

export default function CodeHologram({ position, code, status = 'idle' }) {
  const groupRef = useRef()
  const color = status === 'error' ? '#ff00ff' : status === 'success' ? '#00ff00' : '#00ffff'

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime) * 0.2
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1
    }
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Hologram glow effect */}
      <mesh>
        <planeGeometry args={[4, 3]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Code text */}
      <Text
        position={[0, 0, 0.1]}
        fontSize={0.3}
        color={color}
        anchorX="center"
        anchorY="middle"
        maxWidth={3.5}
      >
        {code || '// Code hologram'}
      </Text>
      
      {/* Border frame */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(4, 3)]} />
        <lineBasicMaterial color={color} />
      </lineSegments>
    </group>
  )
}
