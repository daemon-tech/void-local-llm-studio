import { useState, useEffect, useRef } from 'react'
import './WorkerDetailPopup.css'

export default function WorkerDetailPopup({ worker, onClose }) {
  const [workerData, setWorkerData] = useState(worker)
  const [chatHistory, setChatHistory] = useState([])
  const chatEndRef = useRef(null)

  useEffect(() => {
    // Poll for worker updates
    const pollWorker = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/workers/${worker.id}`)
        if (response.ok) {
          const data = await response.json()
          setWorkerData(data)
          
          // Update chat history from tasks and communications
          const history = []
          if (data.tasks) {
            data.tasks.forEach(task => {
              history.push({
                role: 'user',
                content: task.task,
                timestamp: task.timestamp
              })
              if (task.result) {
                history.push({
                  role: 'assistant',
                  content: task.result,
                  timestamp: task.timestamp
                })
              }
            })
          }
          if (data.communications) {
            data.communications.forEach(comm => {
              if (comm.message) {
                history.push({
                  role: comm.from ? 'assistant' : 'user',
                  content: comm.message,
                  timestamp: comm.timestamp
                })
              }
            })
          }
          setChatHistory(history.sort((a, b) => a.timestamp - b.timestamp))
        }
      } catch (error) {
        console.error('Failed to poll worker:', error)
      }
    }

    pollWorker()
    const interval = setInterval(pollWorker, 2000)
    return () => clearInterval(interval)
  }, [worker.id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const getStatusColor = (status) => {
    switch (status) {
      case 'working': return 'var(--accent)'
      case 'communicating': return 'var(--status-green)'
      case 'error': return 'var(--status-red)'
      default: return 'var(--text-muted)'
    }
  }

  return (
    <div className="worker-detail-popup-overlay" onClick={onClose}>
      <div className="worker-detail-popup" onClick={(e) => e.stopPropagation()}>
        <div className="worker-detail-popup-header">
          <div className="worker-detail-popup-title">
            <div 
              className="worker-detail-popup-status-dot"
              style={{ backgroundColor: getStatusColor(workerData.status) }}
            />
            <div>
              <h3>{workerData.name || workerData.model}</h3>
              <span className="worker-detail-popup-role">{workerData.role}</span>
            </div>
          </div>
          <button className="worker-detail-popup-close" onClick={onClose}>×</button>
        </div>

        <div className="worker-detail-popup-content">
          {/* Stats */}
          <div className="worker-detail-popup-stats">
            <div className="worker-detail-popup-stat">
              <span className="stat-label">Status</span>
              <span className="stat-value" style={{ color: getStatusColor(workerData.status) }}>
                {workerData.status?.toUpperCase()}
              </span>
            </div>
            <div className="worker-detail-popup-stat">
              <span className="stat-label">Tasks</span>
              <span className="stat-value">{workerData.tasks?.length || 0}</span>
            </div>
            <div className="worker-detail-popup-stat">
              <span className="stat-label">Model</span>
              <span className="stat-value">{workerData.model}</span>
            </div>
          </div>

          {/* Chat History */}
          <div className="worker-detail-popup-chat">
            <h4>Activity History</h4>
            <div className="worker-detail-popup-chat-messages">
              {chatHistory.length === 0 ? (
                <div className="worker-detail-popup-chat-empty">
                  No activity yet
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div key={idx} className={`worker-detail-popup-chat-message ${msg.role}`}>
                    <span className="worker-detail-popup-chat-role">
                      {msg.role === 'user' ? 'Task' : 'Worker'}
                    </span>
                    <div className="worker-detail-popup-chat-content">
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
