import { useState, useEffect, useRef } from 'react'
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
  const feedRef = useRef(null)

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
            if (latestTask && !feed.find(f => f.id === `${worker.id}-${latestTask.timestamp}`)) {
              setFeed(prev => [{
                id: `task-${worker.id}-${latestTask.timestamp}`,
                workerId: worker.id,
                workerName: worker.name || worker.model,
                type: 'task',
                content: latestTask.task,
                result: latestTask.result,
                timestamp: latestTask.timestamp,
                status: worker.status
              }, ...prev].slice(0, 100)) // Keep last 100 items
            }
          }
          
          // Add activity log entries
          if (worker.activityLog && worker.activityLog.length > 0) {
            const latestActivity = worker.activityLog[worker.activityLog.length - 1]
            if (latestActivity && !feed.find(f => f.id === `activity-${worker.id}-${latestActivity.timestamp}`)) {
              const activityType = latestActivity.type === 'file_created' ? 'result' :
                                   latestActivity.type === 'file_deleted' ? 'result' :
                                   latestActivity.type === 'command_executed' ? 'result' :
                                   latestActivity.type === 'task_error' ? 'error' : 'task'
              
              setFeed(prev => [{
                id: `activity-${worker.id}-${latestActivity.timestamp}`,
                workerId: worker.id,
                workerName: worker.name || worker.model,
                type: activityType,
                content: latestActivity.message,
                context: latestActivity.details ? JSON.stringify(latestActivity.details) : undefined,
                timestamp: latestActivity.timestamp,
                status: worker.status
              }, ...prev].slice(0, 100))
            }
          }
        })
      } catch (error) {
        console.error('Failed to poll updates:', error)
      }
    }

    pollUpdates()
    const interval = setInterval(pollUpdates, 2000)
    return () => clearInterval(interval)
  }, [isConnected, feed])

  // Auto-scroll feed to bottom
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
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
    setTaskInput('')

    try {
      // Add to feed immediately
      const jobId = Date.now()
      setActiveJobs(prev => [...prev, {
        id: jobId,
        task: taskText,
        workers: selectedWorkers,
        status: 'starting',
        timestamp: Date.now()
      }])

      setFeed(prev => [{
        id: `job-${jobId}`,
        type: 'job',
        content: `Assigned to ${selectedWorkers.length} worker(s): ${taskText}`,
        workers: selectedWorkers,
        timestamp: Date.now()
      }, ...prev])

      // Assign task to all selected workers with job sharing
      const response = await fetch('http://localhost:3000/api/workers/tasks/multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          workerIds: selectedWorkers,
          task: taskText,
          shareContext: true
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

      // Add results to feed
      assignments.forEach((result) => {
        if (result.success && result.result) {
          setFeed(prev => [{
            id: `result-${jobId}-${result.workerId}`,
            workerId: result.workerId,
            type: 'result',
            content: `Completed task`,
            result: result.result.result || result.result,
            timestamp: Date.now()
          }, ...prev])
        } else if (result.error) {
          setFeed(prev => [{
            id: `error-${jobId}-${result.workerId}`,
            workerId: result.workerId,
            type: 'error',
            content: `Failed: ${result.error}`,
            timestamp: Date.now()
          }, ...prev])
        }
      })

    } catch (error) {
      console.error('Task assignment failed:', error)
      setFeed(prev => [{
        id: `error-${Date.now()}`,
        type: 'error',
        content: `Failed to assign task: ${error.message}`,
        timestamp: Date.now()
      }, ...prev])
    } finally {
      setLoading(false)
    }
  }

  const getWorkerStatusColor = (status) => {
    switch (status) {
      case 'working': return 'var(--accent)'
      case 'communicating': return 'var(--status-green)'
      case 'error': return 'var(--status-red)'
      default: return 'var(--text-muted)'
    }
  }

  return (
    <div className="agent-panel">
      <div className="agent-panel-header">
        <div>
          <h3>AI Agents</h3>
          <span className="agent-panel-subtitle">Select workers to collaborate</span>
        </div>
        <button
          className="agent-create-project-btn"
          onClick={() => setShowProjectWizard(true)}
          title="Create new project with autonomous setup"
        >
          + Project
        </button>
      </div>

      {/* Worker Selection */}
      <div className="agent-worker-selection">
        <div className="agent-worker-list">
          {workers.length === 0 ? (
            <div className="agent-no-workers">
              No workers available. Spawn workers in the Space tab.
            </div>
          ) : (
            workers.map(worker => (
              <div
                key={worker.id}
                className={`agent-worker-item ${selectedWorkers.includes(worker.id) ? 'selected' : ''} ${worker.status === 'working' ? 'working' : ''}`}
                onClick={() => toggleWorkerSelection(worker.id)}
              >
                <div className="agent-worker-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedWorkers.includes(worker.id)}
                    onChange={() => toggleWorkerSelection(worker.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="agent-worker-info">
                  <div className="agent-worker-name">
                    {worker.name || worker.model}
                    {worker.status === 'working' && <span className="agent-worker-badge working">WORKING</span>}
                    {worker.status === 'communicating' && <span className="agent-worker-badge communicating">COMM</span>}
                  </div>
                  <div className="agent-worker-meta">
                    <span className="agent-worker-role">{worker.role}</span>
                    <span 
                      className="agent-worker-status"
                      style={{ color: getWorkerStatusColor(worker.status) }}
                    >
                      {worker.status}
                    </span>
                  </div>
                </div>
                <button
                  className="agent-worker-detail-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedWorkerDetail(worker)
                  }}
                  title="View details"
                >
                  ⓘ
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Task Input */}
      <div className="agent-task-section">
        <label className="agent-task-label">Task / Request</label>
        <textarea
          className="agent-task-input"
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          placeholder="Describe what you want the workers to do..."
          rows={4}
          disabled={loading || selectedWorkers.length === 0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleSubmit()
            }
          }}
        />
        <button
          className="agent-submit-btn"
          onClick={handleSubmit}
          disabled={loading || !taskInput.trim() || selectedWorkers.length === 0}
        >
          {loading ? 'Processing...' : `Assign to ${selectedWorkers.length} Worker(s)`}
        </button>
      </div>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <div className="agent-jobs-section">
          <h4>Active Jobs</h4>
          <div className="agent-jobs-list">
            {activeJobs.map(job => (
              <div key={job.id} className="agent-job-item">
                <div className="agent-job-header">
                  <span className="agent-job-status">{job.status}</span>
                  <span className="agent-job-workers">{job.workers.length} worker(s)</span>
                </div>
                <div className="agent-job-task">{job.task}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Feed */}
      <div className="agent-feed-section">
        <div className="agent-feed-header-section">
          <h4>Live Activity Feed</h4>
          <span className="agent-feed-count">{feed.length} events</span>
        </div>
        <div className="agent-feed" ref={feedRef}>
          {feed.length === 0 ? (
            <div className="agent-feed-empty">
              <p>No activity yet</p>
              <p className="agent-feed-empty-hint">Assign tasks to workers to see live updates</p>
            </div>
          ) : (
            feed.map(item => (
              <div key={item.id} className={`agent-feed-item ${item.type}`}>
                <div className="agent-feed-header">
                  <div className="agent-feed-header-left">
                    <span className={`agent-feed-type-badge ${item.type}`}>
                      {item.type === 'job' && '📋'}
                      {item.type === 'task' && '⚡'}
                      {item.type === 'result' && '✅'}
                      {item.type === 'error' && '❌'}
                      {item.type.toUpperCase()}
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
            ))
          )}
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
          // This will be handled by the IDE component
          window.dispatchEvent(new CustomEvent('openProject', { detail: { path: projectPath } }))
        }}
      />
    </div>
  )
}
