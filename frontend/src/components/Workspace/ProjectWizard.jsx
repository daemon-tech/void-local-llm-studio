import { useState } from 'react'
import { useVoidStore } from '../../store/voidStore'
import './ProjectWizard.css'

export default function ProjectWizard({ isOpen, onClose, onProjectCreate, onProjectOpen }) {
  const { workers, isConnected } = useVoidStore()
  const [step, setStep] = useState(1)
  const [projectName, setProjectName] = useState('')
  const [projectType, setProjectType] = useState('web')
  const [projectPath, setProjectPath] = useState('')
  const [selectedWorkers, setSelectedWorkers] = useState([])
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  if (!isOpen) return null

  const projectTypes = [
    { id: 'web', name: 'Web App', icon: '🌐', description: 'React, Vue, or vanilla web application' },
    { id: 'node', name: 'Node.js', icon: '📦', description: 'Node.js backend or full-stack application' },
    { id: 'python', name: 'Python', icon: '🐍', description: 'Python application or API' },
    { id: 'react', name: 'React', icon: '⚛️', description: 'React application with modern tooling' },
    { id: 'next', name: 'Next.js', icon: '▲', description: 'Next.js full-stack framework' },
    { id: 'api', name: 'REST API', icon: '🔌', description: 'RESTful API server' },
    { id: 'library', name: 'Library', icon: '📚', description: 'Reusable code library' },
    { id: 'custom', name: 'Custom', icon: '⚙️', description: 'Custom project structure' }
  ]

  const toggleWorker = (workerId) => {
    setSelectedWorkers(prev =>
      prev.includes(workerId)
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    )
  }

  const handleCreate = async () => {
    if (!projectName.trim() || !projectPath.trim() || selectedWorkers.length === 0) {
      alert('Please fill in all required fields')
      return
    }

    setCreating(true)
    try {
      // Create project structure via backend
      const response = await fetch('http://localhost:3000/api/files/project/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          type: projectType,
          path: projectPath,
          description,
          workerIds: selectedWorkers
        })
      })

      const data = await response.json()
      
      if (data.success) {
        // Assign autonomous setup task to workers
        const setupTask = `Create a new ${projectType} project called "${projectName}"${description ? `: ${description}` : ''}. Set up the project structure, install dependencies, and create initial files.`
        
        await fetch('http://localhost:3000/api/workers/tasks/multi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workerIds: selectedWorkers,
            task: setupTask,
            shareContext: true
          })
        })

        // Open the project in IDE
        if (onProjectOpen) {
          onProjectOpen(data.projectPath)
        }
        if (onProjectCreate) {
          onProjectCreate(data.projectPath)
        }
        onClose()
      } else {
        throw new Error(data.error || 'Failed to create project')
      }
    } catch (error) {
      console.error('Project creation failed:', error)
      alert(`Failed to create project: ${error.message}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="project-wizard-overlay" onClick={onClose}>
      <div className="project-wizard" onClick={(e) => e.stopPropagation()}>
        <div className="project-wizard-header">
          <h2>Create New Project</h2>
          <button className="project-wizard-close" onClick={onClose}>×</button>
        </div>

        <div className="project-wizard-content">
          {step === 1 && (
            <div className="project-wizard-step">
              <h3>Project Details</h3>
              <div className="project-wizard-field">
                <label>Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="my-awesome-project"
                  autoFocus
                />
              </div>
              <div className="project-wizard-field">
                <label>Project Path</label>
                <input
                  type="text"
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="C:\\Projects\\my-project or /home/user/projects/my-project"
                />
              </div>
              <div className="project-wizard-field">
                <label>Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this project should do..."
                  rows={3}
                />
              </div>
              <button
                className="project-wizard-next"
                onClick={() => setStep(2)}
                disabled={!projectName.trim() || !projectPath.trim()}
              >
                Next: Choose Type →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="project-wizard-step">
              <h3>Project Type</h3>
              <div className="project-type-grid">
                {projectTypes.map(type => (
                  <div
                    key={type.id}
                    className={`project-type-card ${projectType === type.id ? 'selected' : ''}`}
                    onClick={() => setProjectType(type.id)}
                  >
                    <span className="project-type-icon">{type.icon}</span>
                    <span className="project-type-name">{type.name}</span>
                    <span className="project-type-desc">{type.description}</span>
                  </div>
                ))}
              </div>
              <div className="project-wizard-actions">
                <button className="project-wizard-back" onClick={() => setStep(1)}>
                  ← Back
                </button>
                <button
                  className="project-wizard-next"
                  onClick={() => setStep(3)}
                >
                  Next: Select Workers →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="project-wizard-step">
              <h3>Select Workers</h3>
              <p className="project-wizard-hint">
                Choose workers to autonomously set up and configure your project
              </p>
              <div className="project-wizard-workers">
                {workers.length === 0 ? (
                  <div className="project-wizard-no-workers">
                    No workers available. Spawn workers in the Space tab first.
                  </div>
                ) : (
                  workers.map(worker => (
                    <div
                      key={worker.id}
                      className={`project-wizard-worker ${selectedWorkers.includes(worker.id) ? 'selected' : ''}`}
                      onClick={() => toggleWorker(worker.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedWorkers.includes(worker.id)}
                        onChange={() => toggleWorker(worker.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="project-wizard-worker-info">
                        <span className="project-wizard-worker-name">{worker.name || worker.model}</span>
                        <span className="project-wizard-worker-role">{worker.role}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="project-wizard-actions">
                <button className="project-wizard-back" onClick={() => setStep(2)}>
                  ← Back
                </button>
                <button
                  className="project-wizard-create"
                  onClick={handleCreate}
                  disabled={creating || selectedWorkers.length === 0}
                >
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
