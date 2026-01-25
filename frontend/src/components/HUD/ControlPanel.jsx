import { useState } from 'react'
import { useVoidStore } from '../../store/voidStore'
import LLMSelector from '../LLMSelector/LLMSelector'
import SwarmChat from '../Chat/SwarmChat'
import './HUD.css'

export default function ControlPanel() {
  const { rainEnabled, toggleRain, triggerNeonPulse, isConnected, setLlmConfig } = useVoidStore()
  const [showLLMSelector, setShowLLMSelector] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [selectedSwarmId, setSelectedSwarmId] = useState(null)

  const handleGrokQuery = async () => {
    const query = prompt('Enter your code query:')
    if (query && isConnected) {
      try {
        const response = await fetch('http://localhost:3000/api/grok/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        })
        const data = await response.json()
        console.log('Grok response:', data)
        triggerNeonPulse()
      } catch (error) {
        console.error('Grok query failed:', error)
      }
    }
  }

  const handleLLMSelect = (config) => {
    setLlmConfig(config)
    setShowLLMSelector(false)
  }

  const handleSpawnAgent = async () => {
    // First check if LLM is configured
    const { llmConfig } = useVoidStore.getState()
    if (!llmConfig) {
      setShowLLMSelector(true)
      return
    }

    const project = prompt('Describe the project for the agent swarm:')
    if (project && isConnected) {
      try {
        const response = await fetch('http://localhost:3000/api/agents/spawn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            project,
            llmConfig: llmConfig
          })
        })
        const data = await response.json()
        if (data.success) {
          setSelectedSwarmId(data.swarmId)
          setShowChat(true)
          triggerNeonPulse()
        } else {
          alert(`Failed to spawn swarm: ${data.error || 'Unknown error'}`)
        }
      } catch (error) {
        console.error('Agent spawn failed:', error)
        alert(`Failed to spawn swarm: ${error.message}`)
      }
    }
  }

  const handleOpenChat = async () => {
    if (!isConnected) {
      alert('Backend not connected')
      return
    }
    try {
      const response = await fetch('http://localhost:3000/api/agents/active')
      const data = await response.json()
      if (data.swarms && data.swarms.length > 0) {
        // Use the first active swarm, or let user select
        setSelectedSwarmId(data.swarms[0].id)
        setShowChat(true)
      } else {
        alert('No active swarms. Spawn a swarm first.')
      }
    } catch (error) {
      console.error('Failed to fetch swarms:', error)
      alert('Failed to fetch active swarms')
    }
  }

  const handleViewActiveSwarms = async () => {
    if (!isConnected) {
      alert('Backend not connected')
      return
    }
    try {
      const response = await fetch('http://localhost:3000/api/agents/active')
      const data = await response.json()
      if (data.swarms && data.swarms.length > 0) {
        const swarmList = data.swarms.map(s => 
          `- ${s.project?.substring(0, 30) || s.id}: ${s.status}`
        ).join('\n')
        alert(`Active Swarms (${data.count}):\n\n${swarmList}\n\nCheck the Agent Swarms panel for details.`)
      } else {
        alert('No active swarms. Click "Spawn Swarm" to start one.')
      }
    } catch (error) {
      console.error('Failed to fetch swarms:', error)
      alert('Failed to fetch active swarms')
    }
  }

  return (
    <div className="panel" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      <button
        onClick={handleGrokQuery}
        style={{
          background: 'rgba(0, 255, 255, 0.2)',
          border: '2px solid var(--neon-cyan)',
          color: 'var(--neon-cyan)',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontFamily: 'Orbitron, monospace',
          fontSize: '12px',
          textTransform: 'uppercase',
          transition: 'all 0.3s'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(0, 255, 255, 0.4)'
          e.target.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.5)'
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(0, 255, 255, 0.2)'
          e.target.style.boxShadow = 'none'
        }}
      >
        Ask Grok
      </button>
      
      <button
        onClick={handleSpawnAgent}
        style={{
          background: 'rgba(255, 0, 255, 0.2)',
          border: '2px solid var(--neon-pink)',
          color: 'var(--neon-pink)',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontFamily: 'Orbitron, monospace',
          fontSize: '12px',
          textTransform: 'uppercase',
          transition: 'all 0.3s'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(255, 0, 255, 0.4)'
          e.target.style.boxShadow = '0 0 15px rgba(255, 0, 255, 0.5)'
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(255, 0, 255, 0.2)'
          e.target.style.boxShadow = 'none'
        }}
      >
        Spawn Swarm
      </button>
      
      <button
        onClick={() => setShowLLMSelector(true)}
        style={{
          background: 'rgba(255, 255, 0, 0.2)',
          border: '2px solid #ffff00',
          color: '#ffff00',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontFamily: 'Orbitron, monospace',
          fontSize: '12px',
          textTransform: 'uppercase',
          transition: 'all 0.3s'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(255, 255, 0, 0.4)'
          e.target.style.boxShadow = '0 0 15px rgba(255, 255, 0, 0.5)'
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(255, 255, 0, 0.2)'
          e.target.style.boxShadow = 'none'
        }}
      >
        Select LLM
      </button>
      
      <button
        onClick={handleOpenChat}
        style={{
          background: 'rgba(0, 255, 0, 0.2)',
          border: '2px solid #00ff00',
          color: '#00ff00',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontFamily: 'Orbitron, monospace',
          fontSize: '12px',
          textTransform: 'uppercase',
          transition: 'all 0.3s'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(0, 255, 0, 0.4)'
          e.target.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.5)'
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(0, 255, 0, 0.2)'
          e.target.style.boxShadow = 'none'
        }}
      >
        Chat
      </button>
      
      {showLLMSelector && (
        <LLMSelector 
          onSelect={handleLLMSelect}
          onClose={() => setShowLLMSelector(false)}
        />
      )}
      
      {showChat && selectedSwarmId && (
        <SwarmChat 
          swarmId={selectedSwarmId}
          onClose={() => {
            setShowChat(false)
            setSelectedSwarmId(null)
          }}
        />
      )}
      
      <button
        onClick={toggleRain}
        style={{
          background: 'rgba(157, 0, 255, 0.2)',
          border: '2px solid var(--neon-purple)',
          color: 'var(--neon-purple)',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontFamily: 'Orbitron, monospace',
          fontSize: '12px',
          textTransform: 'uppercase',
          transition: 'all 0.3s'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(157, 0, 255, 0.4)'
          e.target.style.boxShadow = '0 0 15px rgba(157, 0, 255, 0.5)'
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(157, 0, 255, 0.2)'
          e.target.style.boxShadow = 'none'
        }}
      >
        {rainEnabled ? 'Rain: ON' : 'Rain: OFF'}
      </button>
    </div>
  )
}
