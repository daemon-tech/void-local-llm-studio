import { useState } from 'react'
import { useVoidStore } from '../../store/voidStore'
import './WorkerControl.css'

export default function WorkerControl() {
  const { selectedWorker, workers, isConnected } = useVoidStore()
  const [taskInput, setTaskInput] = useState('')
  const [targetWorker, setTargetWorker] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [loading, setLoading] = useState(false)

  const worker = workers.find(w => w.id === selectedWorker)
  const otherWorkers = workers.filter(w => w.id !== selectedWorker)

  const handleAssignTask = async () => {
    if (!taskInput.trim() || !worker || loading) return

    setLoading(true)
    try {
      const response = await fetch(`http://localhost:3000/api/workers/${worker.id}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: taskInput })
      })
      const data = await response.json()
      
      if (data.success) {
        setTaskInput('')
        // Refresh file tree to show changes
        const fileResponse = await fetch('http://localhost:3000/api/files')
        if (fileResponse.ok) {
          const fileData = await fileResponse.json()
          useVoidStore.getState().setProjectFiles(fileData.files || [])
        }
        alert('Task completed! Worker may have created/modified files.')
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Task assignment failed:', error)
      alert(`Failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !targetWorker || !worker || loading) return

    setLoading(true)
    try {
      const response = await fetch(`http://localhost:3000/api/workers/${worker.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetWorkerId: targetWorker,
          message: messageInput,
          data: {} // Can include shared code/data here
        })
      })
      const data = await response.json()
      
      if (data.success) {
        setMessageInput('')
        setTargetWorker('')
        alert('Message sent! Workers are communicating.')
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Message send failed:', error)
      alert(`Failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!worker) {
    return (
      <div className="worker-control">
        <div className="worker-control-empty">
          Select a worker to control it
        </div>
      </div>
    )
  }

  return (
    <div className="worker-control">
      <div className="worker-control-header">
        <h4>{worker.name || worker.model}</h4>
        <span className="worker-control-role">{worker.role}</span>
      </div>

      <div className="worker-control-section">
        <label>Assign Task</label>
        <textarea
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          placeholder="Describe the coding task..."
          rows={3}
          disabled={loading}
        />
        <button
          onClick={handleAssignTask}
          disabled={loading || !taskInput.trim()}
          className="btn-task"
        >
          {loading ? 'Working...' : 'Assign Task'}
        </button>
      </div>

      <div className="worker-control-section">
        <label>Send Message to Another Worker</label>
        <select
          value={targetWorker}
          onChange={(e) => setTargetWorker(e.target.value)}
          disabled={loading || otherWorkers.length === 0}
        >
          <option value="">Select worker...</option>
          {otherWorkers.map(w => (
            <option key={w.id} value={w.id}>
              {w.name || w.model} ({w.role})
            </option>
          ))}
        </select>
        <textarea
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Message or request..."
          rows={2}
          disabled={loading || !targetWorker}
        />
        <button
          onClick={handleSendMessage}
          disabled={loading || !messageInput.trim() || !targetWorker}
          className="btn-message"
        >
          {loading ? 'Sending...' : 'Send Message'}
        </button>
      </div>
    </div>
  )
}
