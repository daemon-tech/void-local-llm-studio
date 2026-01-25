import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Workspace() {
  const gridRef = useRef()
  
  // Enhanced grid with tech aesthetic
  const gridHelper = useMemo(() => {
    const grid = new THREE.GridHelper(40, 40, '#FFFF00', '#1a1a1a')
    grid.material.opacity = 0.2
    grid.material.transparent = true
    return grid
  }, [])

  // Animated tech grid lines
  useFrame((state) => {
    if (gridRef.current) {
      // Subtle pulsing
      const pulse = Math.sin(state.clock.elapsedTime * 0.5) * 0.1 + 0.9
      if (gridRef.current.material) {
        gridRef.current.material.opacity = 0.2 * pulse
      }
    }
  })

  return (
    <group>
      {/* Tech grid floor */}
      <primitive ref={gridRef} object={gridHelper} />
      
      {/* Floor plane with tech pattern */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial
          color="#0a0a0c"
          emissive="#000000"
          emissiveIntensity={0}
          roughness={0.9}
          metalness={0.2}
        />
      </mesh>
      
      {/* Tech grid lines - radial pattern */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2
        return (
          <mesh
            key={i}
            rotation={[-Math.PI / 2, angle, 0]}
            position={[0, 0.01, 0]}
          >
            <planeGeometry args={[20, 0.02]} />
            <meshStandardMaterial
              color="#FFFF00"
              emissive="#FFFF00"
              emissiveIntensity={0.3}
              transparent
              opacity={0.1}
            />
          </mesh>
        )
      })}
      
      {/* Ambient tech glow from center */}
      <pointLight position={[0, 5, 0]} intensity={0.3} color="#FFFF00" distance={25} />
      
      {/* Additional accent lights */}
      <pointLight position={[10, 3, 10]} intensity={0.2} color="#FFFF00" distance={15} />
      <pointLight position={[-10, 3, -10]} intensity={0.2} color="#FFFF00" distance={15} />
    </group>
  )
}
