import { useState, useEffect, useRef } from 'react'
import { useVoidStore } from '../../store/voidStore'
import './WorkerDetailPanel.css'

export default function WorkerDetailPanel({ worker, onClose, onRemove }) {
  const { workerChatHistory, addWorkerMessage } = useVoidStore()
  const [inputMessage, setInputMessage] = useState('')
  const [activityLog, setActivityLog] = useState([])
  const messagesEndRef = useRef(null)
  const logEndRef = useRef(null)
  
  // Load chat history from store - reactive to store changes
  const messages = worker ? (workerChatHistory[worker.id] || []) : []

  // Scroll to bottom of messages when they change
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Scroll to bottom of activity log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activityLog])

  // Fetch worker activity/logs periodically
  useEffect(() => {
    if (!worker) return

    const fetchActivity = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/workers/${worker.id}/activity`)
        const data = await response.json()
        if (data.success && data.activity) {
          setActivityLog(data.activity || [])
        }
      } catch (error) {
        console.error('Failed to fetch activity:', error)
      }
    }

    fetchActivity()
    const interval = setInterval(fetchActivity, 2000)
    return () => clearInterval(interval)
  }, [worker])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputMessage.trim() || !worker) return

    const messageToSend = inputMessage
    setInputMessage('')

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: messageToSend,
      timestamp: new Date()
    }

    // Save user message to store
    addWorkerMessage(worker.id, userMessage)

    try {
      const response = await fetch(`http://localhost:3000/api/workers/${worker.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend })
      })

      const data = await response.json()
      if (data.success) {
        const aiMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          content: data.response || 'Message received',
          timestamp: new Date()
        }
        // Save AI response to store
        addWorkerMessage(worker.id, aiMessage)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      const errorMessage = {
        id: Date.now() + 1,
        type: 'error',
        content: 'Failed to send message. Please try again.',
        timestamp: new Date()
      }
      // Save error message to store
      addWorkerMessage(worker.id, errorMessage)
    }
  }

  if (!worker) return null

  const statusColor = {
    idle: '#71717a',
    working: '#a78bfa',
    communicating: '#22c55e',
    error: '#ef4444'
  }[worker.status] || '#71717a'

  return (
    <div className="worker-detail-panel">
      <div className="worker-detail-header">
        <div className="worker-detail-title">
          <div className="worker-detail-status-indicator" style={{ backgroundColor: statusColor }} />
          <div>
            <h2>{worker.name || worker.model}</h2>
            <span className="worker-detail-subtitle">{worker.role} • {worker.model}</span>
          </div>
        </div>
        <div className="worker-detail-actions">
          {onRemove && (
            <button 
              className="worker-detail-remove" 
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                if (confirm(`Remove worker "${worker.name || worker.model}"?`)) {
                  onRemove(worker.id)
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              title="Remove worker"
              aria-label="Remove worker"
            >
              Remove
            </button>
          )}
          <button 
            className="worker-detail-close" 
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onClose()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Close panel"
            aria-label="Close panel"
          >
            ×
          </button>
        </div>
      </div>

      <div className="worker-detail-content">
        {/* Stats Section */}
        <div className="worker-detail-section">
          <h3>Status</h3>
          <div className="worker-detail-stats">
            <div className="worker-detail-stat">
              <span className="stat-label">Status</span>
              <span className="stat-value" style={{ color: statusColor }}>
                {worker.status}
              </span>
            </div>
            <div className="worker-detail-stat">
              <span className="stat-label">Tasks Completed</span>
              <span className="stat-value">{worker.tasks || 0}</span>
            </div>
            <div className="worker-detail-stat">
              <span className="stat-label">Model</span>
              <span className="stat-value">{worker.model}</span>
            </div>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="worker-detail-section">
          <h3>Live Activity</h3>
          <div className="worker-activity-log">
            {activityLog.length === 0 ? (
              <div className="activity-empty">No activity yet...</div>
            ) : (
              activityLog.map((activity, idx) => (
                <div key={idx} className="activity-item">
                  <span className="activity-time">
                    {new Date(activity.timestamp || Date.now()).toLocaleTimeString()}
                  </span>
                  <span className="activity-message">{activity.message || activity}</span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* Chat Interface */}
        <div className="worker-detail-section worker-detail-chat">
          <h3>Chat</h3>
          <div className="worker-chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">Send a message to interact with this worker...</div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`chat-message chat-message-${msg.type}`}>
                  <div className="chat-message-content">{msg.content}</div>
                  <div className="chat-message-time">
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <form 
            className="worker-chat-input" 
            onSubmit={handleSendMessage}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => {
                e.stopPropagation()
                setInputMessage(e.target.value)
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Type instructions or ask questions..."
              disabled={worker.status === 'error'}
            />
            <button 
              type="submit" 
              disabled={!inputMessage.trim() || worker.status === 'error'}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
