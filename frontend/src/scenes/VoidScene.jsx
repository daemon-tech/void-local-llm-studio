import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVoidStore } from '../store/voidStore'
import Workspace from '../components/3D/Workspace'
import WorkerEntity from '../components/3D/WorkerEntity'

export default function VoidScene() {
  const sceneRef = useRef()
  const { workers } = useVoidStore()

  useFrame((state, delta) => {
    // Subtle camera movement for ambiance
    if (sceneRef.current) {
      // Optional: subtle rotation
    }
  })

  return (
    <group ref={sceneRef}>
      {/* Office workspace floor and environment */}
      <Workspace />
      
      {/* Worker entities - each represents an LLM */}
      {workers.map((worker) => {
        const pos = Array.isArray(worker.position) && worker.position.length === 3
          ? worker.position
          : [0, 0, 0]
        return (
          <WorkerEntity
            key={worker.id}
            worker={worker}
            position={pos}
          />
        )
      })}
    </group>
  )
}
