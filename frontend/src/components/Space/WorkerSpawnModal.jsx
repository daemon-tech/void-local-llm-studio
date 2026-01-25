import { useState, useEffect } from 'react'
import './WorkerSpawnModal.css'

const ROLE_PRESETS = {
  coder: {
    name: 'Coder',
    description: 'Write clean, efficient code. Focus on implementation details, syntax, and best practices.',
    icon: '💻',
    color: '#a78bfa'
  },
  architect: {
    name: 'Architect',
    description: 'Design system architecture, plan structure, and break down complex problems into components.',
    icon: '🏗️',
    color: '#3b82f6'
  },
  reviewer: {
    name: 'Reviewer',
    description: 'Analyze code quality, find bugs, suggest improvements, and ensure best practices.',
    icon: '🔍',
    color: '#10b981'
  },
  tester: {
    name: 'Tester',
    description: 'Write comprehensive tests, identify edge cases, and ensure code reliability.',
    icon: '🧪',
    color: '#f59e0b'
  },
  optimizer: {
    name: 'Optimizer',
    description: 'Analyze code for bottlenecks, optimize algorithms, and improve efficiency.',
    icon: '⚡',
    color: '#ef4444'
  },
  researcher: {
    name: 'Researcher',
    description: 'Investigate solutions, compare approaches, and provide technical insights.',
    icon: '📚',
    color: '#8b5cf6'
  },
  debugger: {
    name: 'Debugger',
    description: 'Find and fix bugs in code. Read error messages, analyze code, identify root causes.',
    icon: '🐛',
    color: '#ec4899'
  }
}

const POPULAR_MODELS = [
  'qwen2.5-coder',
  'deepseek-coder',
  'codellama',
  'mistral',
  'llama2',
  'qwen2.5',
  'phi3',
  'gemma2'
]

export default function WorkerSpawnModal({ isOpen, onClose, onSpawn, isConnected }) {
  const [step, setStep] = useState(1) // 1: Basic, 2: Advanced, 3: Preview
  const [loading, setLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [availableModels, setAvailableModels] = useState([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [errors, setErrors] = useState({})
  
  const [config, setConfig] = useState({
    name: '',
    model: 'qwen2.5-coder',
    baseUrl: 'http://localhost:11434',
    role: 'coder',
    temperature: 0.7,
    customName: false
  })

  // Fetch available models when modal opens
  useEffect(() => {
    if (isOpen && isConnected) {
      fetchAvailableModels()
    }
  }, [isOpen, isConnected, config.baseUrl])

  const fetchAvailableModels = async () => {
    setLoadingModels(true)
    try {
      const response = await fetch(`http://localhost:3000/api/ollama/models?baseUrl=${encodeURIComponent(config.baseUrl)}`)
      const data = await response.json()
      
      if (data.success && data.models) {
        setAvailableModels(data.models.map(m => m.name))
        setErrors(prev => ({ ...prev, models: null }))
      } else {
        setErrors(prev => ({ ...prev, models: data.error || 'Failed to fetch models' }))
      }
    } catch (error) {
      console.error('Failed to fetch models:', error)
      setErrors(prev => ({ ...prev, models: error.message }))
    } finally {
      setLoadingModels(false)
    }
  }

  const testConnection = async () => {
    setTestingConnection(true)
    setConnectionStatus(null)
    
    try {
      const response = await fetch('http://localhost:3000/api/ollama/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: config.baseUrl })
      })
      
      const data = await response.json()
      
      if (data.online) {
        setConnectionStatus({ success: true, message: 'Connection successful!' })
        setErrors(prev => ({ ...prev, baseUrl: null }))
      } else {
        setConnectionStatus({ success: false, message: data.error || 'Connection failed' })
        setErrors(prev => ({ ...prev, baseUrl: data.error || 'Connection failed' }))
      }
    } catch (error) {
      setConnectionStatus({ success: false, message: error.message })
      setErrors(prev => ({ ...prev, baseUrl: error.message }))
    } finally {
      setTestingConnection(false)
    }
  }

  const validateConfig = () => {
    const newErrors = {}
    
    if (!config.model || config.model.trim() === '') {
      newErrors.model = 'Model is required'
    }
    
    if (!config.baseUrl || config.baseUrl.trim() === '') {
      newErrors.baseUrl = 'Ollama URL is required'
    } else {
      try {
        new URL(config.baseUrl)
      } catch {
        newErrors.baseUrl = 'Invalid URL format'
      }
    }
    
    if (config.temperature < 0 || config.temperature > 2) {
      newErrors.temperature = 'Temperature must be between 0 and 2'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSpawn = async () => {
    if (!validateConfig()) {
      setStep(1)
      return
    }

    setLoading(true)
    try {
      await onSpawn({
        name: config.customName && config.name ? config.name : undefined,
        model: config.model,
        baseUrl: config.baseUrl,
        role: config.role
      })
      handleClose()
    } catch (error) {
      console.error('Spawn error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep(1)
    setConfig({
      name: '',
      model: 'qwen2.5-coder',
      baseUrl: 'http://localhost:11434',
      role: 'coder',
      temperature: 0.7,
      customName: false
    })
    setErrors({})
    setConnectionStatus(null)
    onClose()
  }

  const selectPreset = (role) => {
    setConfig(prev => ({ ...prev, role }))
  }

  if (!isOpen) return null

  return (
    <div className="worker-spawn-modal-overlay" onClick={handleClose}>
      <div 
        className="worker-spawn-modal" 
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="worker-spawn-modal-header">
          <h2>Create New Worker</h2>
          <button 
            className="worker-spawn-modal-close" 
            onClick={(e) => {
              e.stopPropagation()
              handleClose()
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            ×
          </button>
        </div>

        <div className="worker-spawn-modal-steps">
          <div className={`step-indicator ${step >= 1 ? 'active' : ''}`}>
            <span>1</span> Basic
          </div>
          <div className={`step-indicator ${step >= 2 ? 'active' : ''}`}>
            <span>2</span> Advanced
          </div>
          <div className={`step-indicator ${step >= 3 ? 'active' : ''}`}>
            <span>3</span> Preview
          </div>
        </div>

        <div className="worker-spawn-modal-content">
          {/* Step 1: Basic Configuration */}
          {step === 1 && (
            <div className="spawn-step">
              <h3>Select Role</h3>
              <div className="role-presets">
                {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
                  <div
                    key={key}
                    className={`role-preset ${config.role === key ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      selectPreset(key)
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    title={preset.description}
                    style={{ borderColor: config.role === key ? preset.color : undefined }}
                  >
                    <div className="role-preset-icon">{preset.icon}</div>
                    <div className="role-preset-info">
                      <div className="role-preset-name">{preset.name}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="spawn-form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={config.customName}
                    onChange={(e) => {
                      e.stopPropagation()
                      setConfig(prev => ({ ...prev, customName: e.target.checked }))
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>Use custom name</span>
                </label>
                {config.customName && (
                  <input
                    type="text"
                    placeholder="Worker name (optional)"
                    value={config.name}
                    onChange={(e) => {
                      e.stopPropagation()
                      setConfig(prev => ({ ...prev, name: e.target.value }))
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={errors.name ? 'error' : ''}
                    style={{ marginTop: '8px' }}
                  />
                )}
              </div>

              <div className="spawn-form-group">
                <label>Model</label>
                <div className="model-selector">
                  <select
                    value={config.model}
                    onChange={(e) => {
                      e.stopPropagation()
                      setConfig(prev => ({ ...prev, model: e.target.value }))
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={errors.model ? 'error' : ''}
                  >
                    {availableModels.length > 0 ? (
                      availableModels.map(model => (
                        <option key={model} value={model}>{model}</option>
                      ))
                    ) : (
                      POPULAR_MODELS.map(model => (
                        <option key={model} value={model}>{model}</option>
                      ))
                    )}
                  </select>
                  <button 
                    className="refresh-models-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      fetchAvailableModels()
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    disabled={loadingModels}
                    title="Refresh models list"
                  >
                    {loadingModels ? '⟳' : '↻'}
                  </button>
                </div>
                {errors.model && <div className="error-message">{errors.model}</div>}
                {errors.models && <div className="error-message">{errors.models}</div>}
                {loadingModels && <div className="loading-message">Loading models...</div>}
              </div>
            </div>
          )}

          {/* Step 2: Advanced Configuration */}
          {step === 2 && (
            <div className="spawn-step">
              <h3>Advanced Settings</h3>
              
              <div className="spawn-form-group">
                <label>Ollama Base URL</label>
                <div className="url-input-group">
                  <input
                    type="text"
                    placeholder="http://localhost:11434"
                    value={config.baseUrl}
                    onChange={(e) => {
                      setConfig(prev => ({ ...prev, baseUrl: e.target.value }))
                      setConnectionStatus(null)
                    }}
                    className={errors.baseUrl ? 'error' : ''}
                  />
                  <button
                    className="test-connection-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      testConnection()
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    disabled={testingConnection}
                  >
                    {testingConnection ? 'Testing...' : 'Test'}
                  </button>
                </div>
                {errors.baseUrl && <div className="error-message">{errors.baseUrl}</div>}
                {connectionStatus && (
                  <div className={`connection-status ${connectionStatus.success ? 'success' : 'error'}`}>
                    {connectionStatus.message}
                  </div>
                )}
              </div>

              <div className="spawn-form-group">
                <label>
                  Temperature: {config.temperature}
                  <span className="label-hint">(Controls randomness: 0 = deterministic, 2 = very creative)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                />
                {errors.temperature && <div className="error-message">{errors.temperature}</div>}
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div className="spawn-step">
              <h3>Preview Configuration</h3>
              <div className="preview-card">
                <div className="preview-row">
                  <span className="preview-label">Name:</span>
                  <span className="preview-value">
                    {config.customName && config.name ? config.name : `${ROLE_PRESETS[config.role].name} Worker`}
                  </span>
                </div>
                <div className="preview-row">
                  <span className="preview-label">Role:</span>
                  <span className="preview-value">
                    <span className="role-badge" style={{ backgroundColor: ROLE_PRESETS[config.role].color + '20', color: ROLE_PRESETS[config.role].color }}>
                      {ROLE_PRESETS[config.role].icon} {ROLE_PRESETS[config.role].name}
                    </span>
                  </span>
                </div>
                <div className="preview-row">
                  <span className="preview-label">Model:</span>
                  <span className="preview-value">{config.model}</span>
                </div>
                <div className="preview-row">
                  <span className="preview-label">Ollama URL:</span>
                  <span className="preview-value">{config.baseUrl}</span>
                </div>
                <div className="preview-row">
                  <span className="preview-label">Temperature:</span>
                  <span className="preview-value">{config.temperature}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="worker-spawn-modal-actions">
          {step > 1 && (
            <button 
              className="btn-secondary" 
              onClick={(e) => {
                e.stopPropagation()
                setStep(step - 1)
              }}
            >
              Back
            </button>
          )}
          <div className="spacer" />
          {step < 3 ? (
            <button 
              className="btn-primary" 
              onClick={(e) => {
                e.stopPropagation()
                if (validateConfig()) {
                  setStep(step + 1)
                }
              }}
            >
              Next
            </button>
          ) : (
            <button 
              className="btn-primary" 
              onClick={(e) => {
                e.stopPropagation()
                handleSpawn()
              }}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Worker'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
