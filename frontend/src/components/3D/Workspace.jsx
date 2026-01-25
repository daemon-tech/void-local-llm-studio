import { useMemo } from 'react'
import * as THREE from 'three'

export default function Workspace() {
  const gridHelper = useMemo(() => {
    const grid = new THREE.GridHelper(30, 30, '#2a2a2a', '#1a1a1a')
    return grid
  }, [])

  return (
    <group>
      {/* Floor grid */}
      <primitive object={gridHelper} />
      
      {/* Floor plane with subtle glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial
          color="#0f0f11"
          emissive="#0a0a0c"
          emissiveIntensity={0.1}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>
      
      {/* Ambient glow from center */}
      <pointLight position={[0, 3, 0]} intensity={0.2} color="#a78bfa" distance={15} />
    </group>
  )
}
