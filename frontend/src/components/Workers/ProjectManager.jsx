import { useState } from 'react'
import { useVoidStore } from '../../store/voidStore'
import './ProjectManager.css'

export default function ProjectManager() {
  const { workers, isConnected } = useVoidStore()
  const [projectDescription, setProjectDescription] = useState('')
  const [selectedWorkers, setSelectedWorkers] = useState([])
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(true)

  const toggleWorker = (workerId) => {
    setSelectedWorkers(prev =>
      prev.includes(workerId)
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    )
  }

  const handleStartProject = async () => {
    if (!projectDescription.trim() || selectedWorkers.length === 0 || loading) return

    setLoading(true)
    try {
      // Assign project to first worker (architect role if available)
      const architect = workers.find(w => selectedWorkers.includes(w.id) && w.role === 'architect')
      const firstWorker = architect || workers.find(w => selectedWorkers.includes(w.id))
      
      if (!firstWorker) {
        alert('No workers selected')
        return
      }

      // Start with architect planning
      const planResponse = await fetch(`http://localhost:3000/api/workers/${firstWorker.id}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: `Plan and break down this project: ${projectDescription}. Create a detailed architecture and task list.`
        })
      })
      const planData = await planResponse.json()

      if (planData.success && planData.result) {
        // Extract the actual result string from the response object
        const planText = typeof planData.result === 'string' 
          ? planData.result 
          : planData.result.result || String(planData.result || '')
        
        // Share plan with other workers
        const otherWorkers = workers.filter(w => 
          selectedWorkers.includes(w.id) && w.id !== firstWorker.id
        )

        for (const worker of otherWorkers) {
          await fetch(`http://localhost:3000/api/workers/${firstWorker.id}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetWorkerId: worker.id,
              message: `Project plan: ${projectDescription}. Here's the architecture: ${planText.substring(0, 500)}${planText.length > 500 ? '...' : ''}`,
              data: { project: projectDescription, plan: planText }
            })
          })
        }

        alert(`Project started! ${selectedWorkers.length} workers are collaborating.`)
        setProjectDescription('')
        setSelectedWorkers([])
      } else {
        alert('Failed to start project: No result from worker')
      }
    } catch (error) {
      console.error('Project start failed:', error)
      alert(`Failed to start project: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (workers.length === 0) {
    return null
  }

  return (
    <div className={`project-manager ${collapsed ? 'collapsed' : ''}`}>
      <div className="project-manager-header" onClick={() => setCollapsed(!collapsed)}>
        <h4>Collaborative Project</h4>
        <button className="project-manager-toggle">
          {collapsed ? '▼' : '▲'}
        </button>
      </div>
      
      {!collapsed && (
        <div className="project-manager-content">
          <textarea
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            placeholder="Describe a complex coding project..."
            rows={3}
            disabled={loading}
          />
          
          <div className="project-workers">
            <label>Select workers to collaborate:</label>
            {workers.map(worker => (
              <label key={worker.id} className="project-worker-check">
                <input
                  type="checkbox"
                  checked={selectedWorkers.includes(worker.id)}
                  onChange={() => toggleWorker(worker.id)}
                  disabled={loading}
                />
                <span>{worker.name || worker.model} ({worker.role})</span>
              </label>
            ))}
          </div>

          <button
            onClick={handleStartProject}
            disabled={loading || !projectDescription.trim() || selectedWorkers.length === 0}
            className="btn-project"
          >
            {loading ? 'Starting...' : 'Start Collaborative Project'}
          </button>
        </div>
      )}
    </div>
  )
}
