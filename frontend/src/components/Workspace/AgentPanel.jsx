import { useState, useEffect, useRef, useMemo } from 'react'
import { useVoidStore } from '../../store/voidStore'
import WorkerDetailPopup from './WorkerDetailPopup'
import ProjectWizard from './ProjectWizard'
import './AgentPanel.css'

export default function AgentPanel({ onTaskSubmit }) {
  const { workers, isConnected } = useVoidStore()
  const [selectedWorkers, setSelectedWorkers] = useState([])
  const [taskInput, setTaskInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeJobs, setActiveJobs] = useState([])
  const [feed, setFeed] = useState([])
  const [selectedWorkerDetail, setSelectedWorkerDetail] = useState(null)
  const [showProjectWizard, setShowProjectWizard] = useState(false)
  const [debugUntilWorks, setDebugUntilWorks] = useState(true) // Auto-retry is now default
  const [pendingPermissions, setPendingPermissions] = useState([])
  const [activeView, setActiveView] = useState('chat') // 'chat', 'feed', 'workflow'
  const feedRef = useRef(null)
  const chatRef = useRef(null)


  // Poll for worker updates and active jobs
  useEffect(() => {
    if (!isConnected) return

    const pollUpdates = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/workers')
        const data = await response.json()
        const updatedWorkers = data.workers || []
        
        // Update feed with worker activity
        updatedWorkers.forEach(worker => {
          // Add task updates
          if (worker.status === 'working' && worker.tasks && worker.tasks.length > 0) {
            const latestTask = worker.tasks[worker.tasks.length - 1]
            if (latestTask && !feed.find(f => f.id === `task-${worker.id}-${latestTask.timestamp}`)) {
              setFeed(prev => [{
                id: `task-${worker.id}-${latestTask.timestamp}`,
                jobId: `job-${latestTask.timestamp}`,
                workerId: worker.id,
                workerName: worker.name || worker.model,
                type: 'task',
                role: 'user',
                content: latestTask.task,
                result: latestTask.result,
                timestamp: latestTask.timestamp,
                status: worker.status
              }, ...prev].slice(0, 500)) // Increased capacity
            }
          }
          
          // Add activity log entries with enhanced types
          if (worker.activityLog && worker.activityLog.length > 0) {
            const latestActivity = worker.activityLog[worker.activityLog.length - 1]
            if (latestActivity && !feed.find(f => f.id === `activity-${worker.id}-${latestActivity.timestamp}`)) {
              // Enhanced activity type mapping
              let activityType = 'task'
              let role = 'assistant'
              if (latestActivity.type === 'thinking' || latestActivity.type === 'reasoning') {
                activityType = 'thinking'
                role = 'assistant'
              } else if (latestActivity.type === 'file_created') {
                activityType = 'result'
                role = 'assistant'
              } else if (latestActivity.type === 'file_deleted') {
                activityType = 'result'
                role = 'assistant'
              } else if (latestActivity.type === 'command_executed') {
                activityType = 'command'
                role = 'assistant'
              } else if (latestActivity.type === 'task_error') {
                activityType = 'error'
                role = 'assistant'
              } else if (latestActivity.type === 'task_completed') {
                activityType = 'result'
                role = 'assistant'
              } else if (latestActivity.type === 'task_started') {
                activityType = 'task'
                role = 'user'
              }
              
              setFeed(prev => [{
                id: `activity-${worker.id}-${latestActivity.timestamp}`,
                jobId: `job-${latestActivity.timestamp}`,
                workerId: worker.id,
                workerName: worker.name || worker.model,
                type: activityType,
                role: role,
                activityType: latestActivity.type,
                content: latestActivity.message,
                context: latestActivity.details ? JSON.stringify(latestActivity.details, null, 2) : undefined,
                timestamp: latestActivity.timestamp,
                status: worker.status
              }, ...prev].slice(0, 500))
            }
          }
        })
      } catch (error) {
        console.error('Failed to poll updates:', error)
      }
    }

    pollUpdates()
    const interval = setInterval(pollUpdates, 1500) // Faster polling
    return () => clearInterval(interval)
  }, [isConnected, feed])

  // Poll for pending permissions
  useEffect(() => {
    if (!isConnected) return

    const pollPermissions = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/workers/permissions/pending')
        const data = await response.json()
        if (data.success) {
          setPendingPermissions(data.permissions || [])
        }
      } catch (error) {
        console.error('Failed to poll permissions:', error)
      }
    }

    pollPermissions()
    const interval = setInterval(pollPermissions, 1500)
    return () => clearInterval(interval)
  }, [isConnected])

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [feed])

  const toggleWorkerSelection = (workerId) => {
    setSelectedWorkers(prev => 
      prev.includes(workerId)
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    )
  }

  const handleSubmit = async () => {
    if (!taskInput.trim() || selectedWorkers.length === 0 || loading) return

    setLoading(true)
    const taskText = taskInput.trim()
    const jobId = `job-${Date.now()}`
    setTaskInput('')

    try {
      // Add user message to feed immediately
      setFeed(prev => [{
        id: `user-${jobId}`,
        jobId: jobId,
        type: 'task',
        role: 'user',
        content: taskText,
        timestamp: Date.now(),
        workers: selectedWorkers
      }, ...prev])

      // Add to active jobs
      setActiveJobs(prev => [...prev, {
        id: jobId,
        task: taskText,
        workers: selectedWorkers,
        status: 'starting',
        timestamp: Date.now()
      }])

      // Assign task to all selected workers with job sharing
      const response = await fetch('http://localhost:3000/api/workers/tasks/multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
          workerIds: selectedWorkers,
          task: taskText,
          shareContext: true,
          debugUntilWorks: debugUntilWorks, // Auto-retry is default (true)
          maxIterations: 15
        })
      })
      
      const multiResult = await response.json()
      const assignments = multiResult.results || []

      // Update job status
      setActiveJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { ...job, status: 'completed', results: assignments }
          : job
      ))

      // Refresh file tree if task was successful
      if (onTaskSubmit) {
        onTaskSubmit()
      }

    } catch (error) {
      console.error('Task assignment failed:', error)
      setFeed(prev => [{
        id: `error-${Date.now()}`,
        jobId: jobId,
        type: 'error',
        role: 'system',
        content: `Failed to assign task: ${error.message}`,
        timestamp: Date.now()
      }, ...prev])
    } finally {
      setLoading(false)
    }
  }

  const getWorkerStatusColor = (status) => {
    switch (status) {
      case 'working': return '#FFFF00'
      case 'communicating': return '#00AAFF'
      case 'error': return '#C00000'
      default: return '#AAAAAA'
    }
  }

  // Group feed by conversations
  const conversations = useMemo(() => {
    const grouped = {}
    feed.forEach(item => {
      const jobId = item.jobId || item.workerId || 'general'
      if (!grouped[jobId]) {
        grouped[jobId] = []
      }
      grouped[jobId].push(item)
    })
    return Object.values(grouped).map(conv => ({
      id: conv[0]?.jobId || conv[0]?.workerId || 'general',
      items: conv.sort((a, b) => a.timestamp - b.timestamp),
      latestTimestamp: Math.max(...conv.map(i => i.timestamp)),
      task: conv.find(i => i.role === 'user')?.content || 'General conversation'
    })).sort((a, b) => b.latestTimestamp - a.latestTimestamp)
  }, [feed])

  return (
    <div className="agent-panel">
      {/* Header with view switcher */}
      <div className="agent-panel-header">
        <div className="agent-panel-header-left">
          <h3>AI Agents</h3>
          <div className="agent-view-tabs">
            <button 
              className={`agent-view-tab ${activeView === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveView('chat')}
            >
              Chat
            </button>
            <button 
              className={`agent-view-tab ${activeView === 'feed' ? 'active' : ''}`}
              onClick={() => setActiveView('feed')}
            >
              Feed
            </button>
            <button 
              className={`agent-view-tab ${activeView === 'workflow' ? 'active' : ''}`}
              onClick={() => setActiveView('workflow')}
            >
              Workflow
            </button>
          </div>
        </div>
        <button
          className="agent-create-project-btn"
          onClick={() => setShowProjectWizard(true)}
          title="Create new project"
        >
          + Project
        </button>
      </div>

      {/* Permission Requests - Always visible */}
      {pendingPermissions.length > 0 && (
        <div className="agent-permissions-section">
          <h4 className="agent-permissions-title">⚠️ Permission Requests ({pendingPermissions.length})</h4>
          {pendingPermissions.map(permission => {
            const worker = workers.find(w => w.id === permission.workerId)
            return (
              <div key={permission.id} className="agent-permission-item">
                <div className="agent-permission-header">
                  <span className="agent-permission-worker">{worker?.name || permission.workerId}</span>
                  <span className="agent-permission-type">{permission.type}</span>
                </div>
                <div className="agent-permission-description">{permission.description}</div>
                <div className="agent-permission-command">
                  <code>{permission.command}</code>
                </div>
                <div className="agent-permission-actions">
                  <button
                    className="agent-permission-grant"
                    onClick={async () => {
                      try {
                        const response = await fetch(`http://localhost:3000/api/workers/permissions/${permission.id}/grant`, {
                          method: 'POST'
                        })
                        const data = await response.json()
                        if (data.success) {
                          setPendingPermissions(prev => prev.filter(p => p.id !== permission.id))
                          setFeed(prev => [{
                            id: `permission-granted-${permission.id}`,
                            type: 'result',
                            role: 'system',
                            content: `✅ Permission granted: ${permission.description}`,
                            timestamp: Date.now()
                          }, ...prev])
                        }
                      } catch (error) {
                        console.error('Failed to grant permission:', error)
                      }
                    }}
                  >
                    Grant
                  </button>
                  <button
                    className="agent-permission-deny"
                    onClick={async () => {
                      try {
                        const response = await fetch(`http://localhost:3000/api/workers/permissions/${permission.id}/deny`, {
                          method: 'POST'
                        })
                        const data = await response.json()
                        if (data.success) {
                          setPendingPermissions(prev => prev.filter(p => p.id !== permission.id))
                          setFeed(prev => [{
                            id: `permission-denied-${permission.id}`,
                            type: 'error',
                            role: 'system',
                            content: `❌ Permission denied: ${permission.description}`,
                            timestamp: Date.now()
                          }, ...prev])
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
            )
          })}
        </div>
      )}

      {/* Worker Selection - Compact */}
      <div className="agent-worker-selection-compact">
        {workers.length === 0 ? (
          <div className="agent-no-workers">
            No workers. Spawn in Space tab.
          </div>
        ) : (
          <div className="agent-worker-chips">
            {workers.map(worker => (
              <div
                key={worker.id}
                className={`agent-worker-chip ${selectedWorkers.includes(worker.id) ? 'selected' : ''} ${worker.status === 'working' ? 'working' : ''}`}
                onClick={() => toggleWorkerSelection(worker.id)}
                title={`${worker.name || worker.model} - ${worker.role} (${worker.status})`}
              >
                <span className="agent-worker-chip-name">{worker.name || worker.model}</span>
                {worker.status === 'working' && <span className="agent-worker-chip-badge">●</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area - Chat View (Cursor-style) */}
      {activeView === 'chat' && (
        <div className="agent-chat-container">
          <div className="agent-chat-messages" ref={chatRef}>
            {conversations.length === 0 ? (
              <div className="agent-chat-empty">
                <div className="agent-chat-empty-icon">💬</div>
                <h3>Start a conversation</h3>
                <p>Select workers and describe what you want them to do.</p>
                <p className="agent-chat-empty-hint">The AI will work autonomously, iterating until the task is complete.</p>
              </div>
            ) : (
              conversations.map(conv => (
                <div key={conv.id} className="agent-conversation">
                  <div className="agent-conversation-header">
                    <span className="agent-conversation-title">{conv.task}</span>
                    <span className="agent-conversation-time">
                      {new Date(conv.latestTimestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="agent-conversation-messages">
                    {conv.items.map(item => {
                      const isUser = item.role === 'user'
                      const getIcon = () => {
                        if (item.activityType === 'thinking' || item.activityType === 'reasoning') return '💭'
                        if (item.activityType === 'command_executed') return '⚙️'
                        if (item.type === 'result') return '✅'
                        if (item.type === 'error') return '❌'
                        if (item.type === 'command') return '💻'
                        return isUser ? '👤' : '🤖'
                      }
                      
                      return (
                        <div key={item.id} className={`agent-chat-message ${isUser ? 'user' : 'assistant'} ${item.activityType || item.type}`}>
                          <div className="agent-chat-message-avatar">
                            {getIcon()}
                          </div>
                          <div className="agent-chat-message-content">
                            <div className="agent-chat-message-header">
                              <span className="agent-chat-message-author">
                                {isUser ? 'You' : (item.workerName || 'AI Agent')}
                              </span>
                              <span className="agent-chat-message-time">
                                {new Date(item.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="agent-chat-message-text">
                              {item.content}
                            </div>
                            {item.context && (
                              <details className="agent-chat-message-details">
                                <summary>Details</summary>
                                <pre>{item.context}</pre>
                              </details>
                            )}
                            {item.result && (
                              <details className="agent-chat-message-details">
                                <summary>Result</summary>
                                <pre>{typeof item.result === 'string' ? item.result : JSON.stringify(item.result, null, 2)}</pre>
                              </details>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Feed View */}
      {activeView === 'feed' && (
        <div className="agent-feed-view">
          <div className="agent-feed" ref={feedRef}>
            {feed.length === 0 ? (
              <div className="agent-feed-empty">
                <p>No activity yet</p>
                <p className="agent-feed-empty-hint">Assign tasks to see live updates</p>
              </div>
            ) : (
              feed.map(item => {
                const getIcon = () => {
                  if (item.activityType === 'thinking' || item.activityType === 'reasoning') return '💭'
                  if (item.activityType === 'command_executed') return '⚙️'
                  if (item.type === 'job') return '📋'
                  if (item.type === 'task') return '⚡'
                  if (item.type === 'result') return '✅'
                  if (item.type === 'error') return '❌'
                  if (item.type === 'command') return '💻'
                  return '📝'
                }
                
                const getTypeLabel = () => {
                  if (item.activityType === 'thinking') return 'THINKING'
                  if (item.activityType === 'reasoning') return 'REASONING'
                  if (item.activityType === 'command_executed') return 'COMMAND'
                  return item.type.toUpperCase()
                }
                
                return (
                  <div key={item.id} className={`agent-feed-item ${item.type} ${item.activityType || ''} ${item.status || ''}`}>
                    <div className="agent-feed-header">
                      <div className="agent-feed-header-left">
                        <span className={`agent-feed-type-badge ${item.type} ${item.activityType || ''}`}>
                          {getIcon()} {getTypeLabel()}
                        </span>
                        {item.workerName && (
                          <span className="agent-feed-worker">
                            <span className="agent-feed-worker-icon">🤖</span>
                            {item.workerName}
                          </span>
                        )}
                      </div>
                      <span className="agent-feed-time">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="agent-feed-content">
                      {item.content}
                      {item.status && (
                        <span className={`agent-feed-status agent-feed-status-${item.status}`}>
                          {item.status}
                        </span>
                      )}
                    </div>
                    {item.result && (
                      <details className="agent-feed-result">
                        <summary className="agent-feed-result-summary">
                          <span>View Details</span>
                          <span className="agent-feed-result-icon">▼</span>
                        </summary>
                        <div className="agent-feed-result-content">
                          <pre>{typeof item.result === 'string' ? item.result : JSON.stringify(item.result, null, 2)}</pre>
                        </div>
                      </details>
                    )}
                    {item.context && (
                      <div className="agent-feed-context">
                        <span className="agent-feed-context-label">Context:</span>
                        <span className="agent-feed-context-value">{item.context}</span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Workflow View */}
      {activeView === 'workflow' && (
        <div className="agent-workflow-view">
          <div className="agent-workflow-list">
            {activeJobs.length === 0 ? (
              <div className="agent-workflow-empty">
                <p>No active workflows</p>
                <p className="agent-workflow-empty-hint">Tasks will appear here as workflows</p>
              </div>
            ) : (
              activeJobs.map(job => (
                <div key={job.id} className="agent-workflow-item">
                  <div className="agent-workflow-header">
                    <span className="agent-workflow-status">{job.status}</span>
                    <span className="agent-workflow-workers">{job.workers.length} worker(s)</span>
                  </div>
                  <div className="agent-workflow-task">{job.task}</div>
                  <div className="agent-workflow-timeline">
                    {feed.filter(f => f.jobId === job.id).map(item => (
                      <div key={item.id} className="agent-workflow-step">
                        <span className="agent-workflow-step-icon">
                          {item.type === 'task' ? '⚡' : item.type === 'result' ? '✅' : item.type === 'error' ? '❌' : '📝'}
                        </span>
                        <span className="agent-workflow-step-text">{item.content}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Input Area - Always visible at bottom */}
      <div className="agent-input-section">
        <div className="agent-input-header">
          <div className="agent-input-workers">
            {selectedWorkers.length > 0 ? (
              <span className="agent-input-workers-count">
                {selectedWorkers.length} worker{selectedWorkers.length > 1 ? 's' : ''} selected
              </span>
            ) : (
              <span className="agent-input-workers-hint">Select workers above</span>
            )}
          </div>
          <label className="agent-debug-checkbox-compact">
            <input
              type="checkbox"
              checked={debugUntilWorks}
              onChange={(e) => setDebugUntilWorks(e.target.checked)}
              disabled={loading}
            />
            <span>Auto-retry (default: ON)</span>
          </label>
        </div>
        <div className="agent-input-container">
          <textarea
            className="agent-input"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="Ask the AI agents to do something... (Ctrl+Enter to send)"
            rows={3}
            disabled={loading || selectedWorkers.length === 0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleSubmit()
              }
            }}
          />
          <button
            className="agent-send-btn"
            onClick={handleSubmit}
            disabled={loading || !taskInput.trim() || selectedWorkers.length === 0}
          >
            {loading ? '⏳' : '→'}
          </button>
        </div>
      </div>

      {/* Worker Detail Popup */}
      {selectedWorkerDetail && (
        <WorkerDetailPopup
          worker={selectedWorkerDetail}
          onClose={() => setSelectedWorkerDetail(null)}
        />
      )}

      {/* Project Creation Wizard */}
      <ProjectWizard
        isOpen={showProjectWizard}
        onClose={() => setShowProjectWizard(false)}
        onProjectCreate={(projectPath) => {
          if (onTaskSubmit) {
            onTaskSubmit()
          }
        }}
        onProjectOpen={(projectPath) => {
          window.dispatchEvent(new CustomEvent('openProject', { detail: { path: projectPath } }))
        }}
      />
    </div>
  )
}
