import { Html } from '@react-three/drei'
import './WorkerInfoPopup.css'

export default function WorkerInfoPopup3D({ worker, position, onClose }) {
  if (!worker || !position) return null

  return (
    <Html
      position={[position[0], position[1] + 0.8, position[2]]}
      center
      distanceFactor={10}
      transform
      occlude
      style={{
        pointerEvents: 'auto',
        transform: 'translateX(30px)'
      }}
    >
      <div
        className="worker-info-popup"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="worker-info-popup-header">
          <h3>{worker.name || worker.model}</h3>
          <button 
            className="worker-info-popup-close"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
          >
            ×
          </button>
        </div>
        <div className="worker-info-popup-content">
          <div className="worker-info-popup-detail">
            <span className="popup-label">Role:</span>
            <span className="popup-value">{worker.role}</span>
          </div>
          <div className="worker-info-popup-detail">
            <span className="popup-label">Status:</span>
            <span className={`popup-value status-${worker.status}`}>
              {worker.status}
            </span>
          </div>
          <div className="worker-info-popup-detail">
            <span className="popup-label">Model:</span>
            <span className="popup-value">{worker.model}</span>
          </div>
          <div className="worker-info-popup-detail">
            <span className="popup-label">Tasks:</span>
            <span className="popup-value">{worker.tasks || 0}</span>
          </div>
        </div>
      </div>
    </Html>
  )
}
