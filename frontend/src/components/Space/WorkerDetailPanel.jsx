import { useState, useEffect, useRef } from 'react'
import { useVoidStore } from '../../store/voidStore'
import ProjectWizard from '../Workspace/ProjectWizard'
import './WorkerDetailPanel.css'

export default function WorkerDetailPanel({ worker, onClose, onRemove }) {
  const { workerChatHistory, addWorkerMessage, isConnected } = useVoidStore()
  const [inputMessage, setInputMessage] = useState('')
  const [activityLog, setActivityLog] = useState([])
  const [taskInput, setTaskInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [debugUntilWorks, setDebugUntilWorks] = useState(false)
  const [showProjectWizard, setShowProjectWizard] = useState(false)
  const [pendingPermissions, setPendingPermissions] = useState([])
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

  // Poll for pending permissions
  useEffect(() => {
    if (!isConnected || !worker) return

    const pollPermissions = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/workers/permissions/pending')
        const data = await response.json()
        if (data.success) {
          // Filter permissions for this worker
          const workerPermissions = (data.permissions || []).filter(p => p.workerId === worker.id)
          setPendingPermissions(workerPermissions)
        }
      } catch (error) {
        console.error('Failed to poll permissions:', error)
      }
    }

    pollPermissions()
    const interval = setInterval(pollPermissions, 1500)
    return () => clearInterval(interval)
  }, [isConnected, worker])

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

  const handleAssignTask = async () => {
    if (!taskInput.trim() || !worker || loading) return

    setLoading(true)
    const taskText = taskInput.trim()
    setTaskInput('')

    try {
      const response = await fetch(`http://localhost:3000/api/workers/${worker.id}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          task: taskText,
          debugUntilWorks: debugUntilWorks,
          maxIterations: 10
        })
      })
      
      const data = await response.json()
      if (data.success) {
        // Task assigned successfully
        addWorkerMessage(worker.id, {
          id: Date.now(),
          type: 'system',
          content: `Task assigned: ${taskText}`,
          timestamp: new Date()
        })
      } else {
        throw new Error(data.error || 'Failed to assign task')
      }
    } catch (error) {
      console.error('Task assignment failed:', error)
      addWorkerMessage(worker.id, {
        id: Date.now(),
        type: 'error',
        content: `Failed to assign task: ${error.message}`,
        timestamp: new Date()
      })
    } finally {
      setLoading(false)
    }
  }

  const handleProjectOpen = (projectPath) => {
    // Dispatch event to notify IDE to open project
    window.dispatchEvent(new CustomEvent('openProject', { detail: { path: projectPath } }))
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
              <span className="stat-value">{worker.tasks?.length || 0}</span>
            </div>
            <div className="worker-detail-stat">
              <span className="stat-label">Model</span>
              <span className="stat-value">{worker.model}</span>
            </div>
          </div>
          <div className="worker-connected-indicator">
            <span className="connected-dot"></span>
            <span>Connected to shared workspace</span>
          </div>
        </div>

        {/* Permission Requests */}
        {pendingPermissions.length > 0 && (
          <div className="worker-detail-section worker-permissions-section">
            <h3>Permission Requests</h3>
            {pendingPermissions.map(permission => (
              <div key={permission.id} className="worker-permission-item">
                <div className="worker-permission-header">
                  <span className="worker-permission-type">{permission.type}</span>
                </div>
                <div className="worker-permission-description">{permission.description}</div>
                <div className="worker-permission-command">
                  <code>{permission.command}</code>
                </div>
                <div className="worker-permission-actions">
                  <button
                    className="worker-permission-grant"
                    onClick={async () => {
                      try {
                        const response = await fetch(`http://localhost:3000/api/workers/permissions/${permission.id}/grant`, {
                          method: 'POST'
                        })
                        const data = await response.json()
                        if (data.success) {
                          setPendingPermissions(prev => prev.filter(p => p.id !== permission.id))
                        }
                      } catch (error) {
                        console.error('Failed to grant permission:', error)
                      }
                    }}
                  >
                    Grant
                  </button>
                  <button
                    className="worker-permission-deny"
                    onClick={async () => {
                      try {
                        const response = await fetch(`http://localhost:3000/api/workers/permissions/${permission.id}/deny`, {
                          method: 'POST'
                        })
                        const data = await response.json()
                        if (data.success) {
                          setPendingPermissions(prev => prev.filter(p => p.id !== permission.id))
                        }
                      } catch (error) {
                        console.error('Failed to deny permission:', error)
                      }
                    }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Task Assignment */}
        <div className="worker-detail-section worker-task-section">
          <div className="worker-task-header">
            <h3>Assign Task</h3>
            <button
              className="worker-create-project-btn"
              onClick={() => setShowProjectWizard(true)}
              title="Create new project"
            >
              + Project
            </button>
          </div>
          <textarea
            className="worker-task-input"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="Describe what you want this worker to do autonomously..."
            rows={3}
            disabled={loading || worker.status === 'error'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleAssignTask()
              }
            }}
          />
          <div className="worker-task-options">
            <label className="worker-debug-checkbox">
              <input
                type="checkbox"
                checked={debugUntilWorks}
                onChange={(e) => setDebugUntilWorks(e.target.checked)}
                disabled={loading}
              />
              <span>Debug until it works</span>
            </label>
          </div>
          <button
            className="worker-task-submit"
            onClick={handleAssignTask}
            disabled={loading || !taskInput.trim() || worker.status === 'error'}
          >
            {loading ? 'Processing...' : 'Assign Task'}
          </button>
        </div>

        {/* Live Activity Feed */}
        <div className="worker-detail-section">
          <h3>Live Activity</h3>
          <div className="worker-activity-log">
            {activityLog.length === 0 ? (
              <div className="activity-empty">No activity yet...</div>
            ) : (
              activityLog.map((activity, idx) => (
                <div key={idx} className={`activity-item activity-${activity.type || 'info'}`}>
                  <span className="activity-time">
                    {new Date(activity.timestamp || Date.now()).toLocaleTimeString()}
                  </span>
                  <span className="activity-message">{activity.message || activity}</span>
                  {activity.details && (
                    <details className="activity-details">
                      <summary>Details</summary>
                      <pre>{JSON.stringify(activity.details, null, 2)}</pre>
                    </details>
                  )}
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

      {/* Project Wizard */}
      {showProjectWizard && (
        <ProjectWizard
          onClose={() => setShowProjectWizard(false)}
          onProjectOpen={handleProjectOpen}
        />
      )}
    </div>
  )
}
