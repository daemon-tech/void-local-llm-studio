import { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVoidStore } from '../store/voidStore'
import Workspace from '../components/3D/Workspace'
import WorkerEntity from '../components/3D/WorkerEntity'
import NeuralHub from '../components/3D/NeuralHub'
import NeuralConnection from '../components/3D/NeuralConnection'
import ActivityPulse from '../components/3D/ActivityPulse'

export default function VoidScene() {
  const sceneRef = useRef()
  const { workers, projectRoot } = useVoidStore()
  const [activityPulses, setActivityPulses] = useState([])
  const hubPosition = [0, 4, 0]

  // Calculate worker positions around hub with better distribution
  const workerPositions = useMemo(() => {
    return workers.map((worker, index) => {
      if (Array.isArray(worker.position) && worker.position.length === 3) {
        return worker.position
      }
      
      // Position workers in a circle around the hub using golden angle for even distribution
      const workerCount = workers.length
      const baseRadius = 5
      const radius = baseRadius + (workerCount > 6 ? 1.5 : 0)
      
      // Use golden angle for better spacing
      const goldenAngle = Math.PI * (3 - Math.sqrt(5))
      const angle = index * goldenAngle
      
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      return [x, 0.5, z]
    })
  }, [workers])

  // Track activity for pulses
  useEffect(() => {
    workers.forEach(worker => {
      if (worker.activityLog && worker.activityLog.length > 0) {
        const latestActivity = worker.activityLog[worker.activityLog.length - 1]
        if (latestActivity) {
          const activityAge = Date.now() - latestActivity.timestamp
          if (activityAge < 500) {
            const workerIndex = workers.findIndex(w => w.id === worker.id)
            const workerPos = workerPositions[workerIndex] || [0, 0, 0]
            
            // Determine pulse color based on activity type
            let pulseColor = '#FFFF00' // Default yellow
            if (latestActivity.type === 'task_error') {
              pulseColor = '#C00000' // Red for errors
            } else if (latestActivity.type === 'file_created') {
              pulseColor = '#00C000' // Green for file creation
            } else if (latestActivity.type === 'thinking' || latestActivity.type === 'reasoning') {
              pulseColor = '#00AAFF' // Blue for thinking/reasoning
            }
            
            const pulse = {
              id: `pulse-${worker.id}-${latestActivity.timestamp}`,
              from: workerPos,
              to: hubPosition,
              color: pulseColor,
              timestamp: latestActivity.timestamp
            }
            
            setActivityPulses(prev => {
              const filtered = prev.filter(p => Date.now() - p.timestamp < 2000)
              return [...filtered, pulse]
            })
          }
        }
      }
    })
  }, [workers, workerPositions])

  useFrame((state, delta) => {
    // Subtle scene animations
  })

  // Ensure we have valid positions
  const validWorkerPositions = useMemo(() => {
    return workerPositions.filter(pos => 
      Array.isArray(pos) && pos.length === 3 && 
      pos.every(coord => typeof coord === 'number' && !isNaN(coord))
    )
  }, [workerPositions])

  // Ensure we always render something
  if (!workers) {
    return (
      <group ref={sceneRef}>
        <Workspace />
        <NeuralHub />
      </group>
    )
  }

  return (
    <group ref={sceneRef}>
      {/* Tech environment floor and grid */}
      <Workspace />
      
      {/* Central Neural Hub - always visible */}
      <NeuralHub />
      
      {/* Worker entities positioned around hub */}
      {workers.length > 0 && workers.map((worker, index) => {
        const pos = workerPositions[index] || [0, 0, 0]
        // Validate position
        if (!Array.isArray(pos) || pos.length !== 3) return null
        if (pos.some(coord => typeof coord !== 'number' || isNaN(coord))) return null
        
        return (
          <WorkerEntity
            key={worker.id}
            worker={worker}
            position={pos}
          />
        )
      })}
      
      {/* Neural connections from workers to hub */}
      {workers.length > 0 && workers.map((worker, index) => {
        const workerPos = workerPositions[index] || [0, 0, 0]
        // Validate position
        if (!Array.isArray(workerPos) || workerPos.length !== 3) return null
        if (workerPos.some(coord => typeof coord !== 'number' || isNaN(coord))) return null
        
        return (
          <NeuralConnection
            key={`conn-${worker.id}`}
            from={workerPos}
            to={hubPosition}
            active={worker.status === 'working' || worker.status === 'communicating'}
            strength={worker.status === 'working' ? 1.0 : worker.status === 'communicating' ? 0.8 : 0.3}
          />
        )
      })}
      
      {/* Activity pulses traveling along connections */}
      {activityPulses.map(pulse => {
        // Validate pulse positions
        if (!Array.isArray(pulse.from) || !Array.isArray(pulse.to)) return null
        if (pulse.from.length !== 3 || pulse.to.length !== 3) return null
        
        return (
          <ActivityPulse
            key={pulse.id}
            from={pulse.from}
            to={pulse.to}
            color={pulse.color}
            speed={2.0}
            onComplete={() => {
              setActivityPulses(prev => prev.filter(p => p.id !== pulse.id))
            }}
          />
        )
      })}
    </group>
  )
}
