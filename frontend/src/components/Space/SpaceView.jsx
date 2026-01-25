import { Suspense, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerspectiveCamera, OrbitControls } from '@react-three/drei'
import { useVoidStore } from '../../store/voidStore'
import VoidScene from '../../scenes/VoidScene'
import WorkerSpawnModal from './WorkerSpawnModal'
import WorkerDetailPanel from './WorkerDetailPanel'
import './SpaceView.css'

export default function SpaceView() {
  const { workers, selectedWorker, setSelectedWorker, setWorkers, isConnected } = useVoidStore()
  const [showSpawnModal, setShowSpawnModal] = useState(false)
  const [spawnSuccess, setSpawnSuccess] = useState(false)
  
  // Refresh workers periodically
  useEffect(() => {
    if (!isConnected) return

    const fetchWorkers = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/workers')
        const data = await response.json()
        setWorkers(data.workers || [])
      } catch (error) {
        console.error('Failed to fetch workers:', error)
      }
    }

    fetchWorkers()
    const interval = setInterval(fetchWorkers, 2000)
    return () => clearInterval(interval)
  }, [isConnected, setWorkers])

  const handleSpawn = async (config) => {
    if (!isConnected) {
      throw new Error('Backend not connected. Please start the server.')
    }

    try {
      const response = await fetch('http://localhost:3000/api/workers/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Refresh workers immediately
        try {
          const workersResponse = await fetch('http://localhost:3000/api/workers')
          const workersData = await workersResponse.json()
          setWorkers(workersData.workers || [])
        } catch (err) {
          console.error('Failed to refresh workers:', err)
        }
        
        // Show success message
        setSpawnSuccess(true)
        setTimeout(() => setSpawnSuccess(false), 3000)
      } else {
        const errorMsg = data.message || data.error || 'Unknown error'
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('Failed to spawn worker:', error)
      throw error
    }
  }

  const handleRemove = async (workerId) => {
    if (!confirm('Remove this worker?')) return

    try {
      const response = await fetch(`http://localhost:3000/api/workers/${workerId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        // Workers will update via polling
      }
    } catch (error) {
      console.error('Failed to remove worker:', error)
    }
  }

  const selectedWorkerData = workers.find(w => w.id === selectedWorker)

  return (
    <div className="space-view">
      {/* 3D Canvas - Full screen 3D neural network environment */}
      <Canvas
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        style={{ background: 'linear-gradient(to bottom, #0a0a0c 0%, #0d0d0f 100%)' }}
        onCreated={({ gl }) => {
          gl.setClearColor('#0d0d0f', 1)
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 8, 12]} fov={60} />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={8}
          maxDistance={30}
          target={[0, 2, 0]}
          enableDamping={true}
          dampingFactor={0.05}
        />
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 15, 8]} intensity={0.8} castShadow />
        <directionalLight position={[-10, 10, -8]} intensity={0.4} />
        <pointLight position={[0, 8, 0]} intensity={0.5} color="#FFFF00" distance={30} />
        <fog attach="fog" args={['#0d0d0f', 10, 50]} />
        <Suspense fallback={null}>
          <VoidScene />
        </Suspense>
      </Canvas>

      {/* Overlay UI */}
      <div className="space-overlay">
        {/* Top bar with spawn button */}
        <div className="space-header">
          <h2>Worker Space</h2>
          <button 
            className="space-spawn-btn"
            onClick={() => setShowSpawnModal(true)}
            title="Create a new AI worker"
          >
            <span className="spawn-btn-icon">+</span>
            <span>Create Worker</span>
          </button>
        </div>

        {/* Success notification */}
        {spawnSuccess && (
          <div className="space-success-notification">
            ✅ Worker created successfully!
          </div>
        )}

        {/* Worker Spawn Modal */}
        <WorkerSpawnModal
          isOpen={showSpawnModal}
          onClose={() => setShowSpawnModal(false)}
          onSpawn={handleSpawn}
          isConnected={isConnected}
        />

        {/* Worker Detail Panel */}
        {selectedWorkerData && (
          <WorkerDetailPanel
            worker={selectedWorkerData}
            onClose={() => setSelectedWorker(null)}
            onRemove={async (workerId) => {
              await handleRemove(workerId)
              setSelectedWorker(null)
            }}
          />
        )}

        {/* Stats bar */}
        <div className="space-stats">
          <div className="space-stat">
            <span className="stat-label">Workers</span>
            <span className="stat-value">{workers.length}</span>
          </div>
          <div className="space-stat">
            <span className="stat-label">Active</span>
            <span className="stat-value">
              {workers.filter(w => w.status === 'working' || w.status === 'communicating').length}
            </span>
          </div>
          <div className="space-stat">
            <span className="stat-label">Idle</span>
            <span className="stat-value">
              {workers.filter(w => w.status === 'idle').length}
            </span>
          </div>
        </div>

        {/* Worker list panel */}
        <div className="space-worker-list">
          <h3>Workers</h3>
          <div className="space-worker-list-content">
            {workers.length === 0 ? (
              <div className="space-worker-empty">No workers. Spawn one to start.</div>
            ) : (
              workers.map((worker) => (
                <div
                  key={worker.id}
                  className={`space-worker-list-item ${selectedWorker === worker.id ? 'selected' : ''}`}
                  onClick={() => setSelectedWorker(worker.id)}
                >
                  <div className="space-worker-list-info">
                    <div className="space-worker-list-name">{worker.name || worker.model}</div>
                    <div className="space-worker-list-meta">
                      <span className="space-worker-list-role">{worker.role}</span>
                      <span className={`space-worker-list-status status-${worker.status}`}>
                        {worker.status}
                      </span>
                    </div>
                  </div>
                  <button
                    className="space-worker-list-remove"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(worker.id)
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
