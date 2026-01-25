import { useEffect, useState } from 'react'
import { useVoidStore } from '../../store/voidStore'
import SwarmChat from '../Chat/SwarmChat'
import './HUD.css'

export default function AgentPanel() {
  const { activeSwarms, setActiveSwarms, setSelectedSwarm, swarmResults, isConnected, setSwarmResult } = useVoidStore()
  const [expandedSwarm, setExpandedSwarm] = useState(null)
  const [showChat, setShowChat] = useState(false)
  const [chatSwarmId, setChatSwarmId] = useState(null)

  useEffect(() => {
    if (!isConnected) return

    const fetchSwarms = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/agents/active')
        const data = await response.json()
        setActiveSwarms(data.swarms || [])
        
        // Fetch results for completed swarms
        data.swarms?.forEach(async (swarm) => {
          if (swarm.status === 'completed' && !swarmResults[swarm.id]) {
            try {
              const resultResponse = await fetch(`http://localhost:3000/api/agents/${swarm.id}`)
              const resultData = await resultResponse.json()
              setSwarmResult(swarm.id, resultData)
            } catch (error) {
              console.error('Failed to fetch swarm result:', error)
            }
          }
        })
      } catch (error) {
        console.error('Failed to fetch swarms:', error)
      }
    }

    fetchSwarms()
    const interval = setInterval(fetchSwarms, 3000) // Poll every 3 seconds
    return () => clearInterval(interval)
  }, [isConnected, setActiveSwarms, swarmResults, setSwarmResult])

  const handleViewSwarm = async (swarmId) => {
    if (swarmResults[swarmId]) {
      setExpandedSwarm(expandedSwarm === swarmId ? null : swarmId)
    } else {
      try {
        const response = await fetch(`http://localhost:3000/api/agents/${swarmId}`)
        const data = await response.json()
        setSwarmResult(swarmId, data)
        setExpandedSwarm(swarmId)
      } catch (error) {
        console.error('Failed to fetch swarm result:', error)
        alert('Failed to load swarm details')
      }
    }
  }

  const handleOpenChat = (swarmId) => {
    setChatSwarmId(swarmId)
    setShowChat(true)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#00ff00'
      case 'running': return '#00ffff'
      case 'error': return '#ff00ff'
      default: return '#ffff00'
    }
  }

  return (
    <div className="panel" style={{ maxWidth: '350px', maxHeight: '500px', overflowY: 'auto' }}>
      <div className="panel-title">Agent Swarms</div>
      
      <div className="metric-item">
        <span className="metric-label">Active Swarms</span>
        <span className="metric-value">{activeSwarms.length}</span>
      </div>
      
      {activeSwarms.length === 0 ? (
        <div style={{ marginTop: '10px', fontSize: '11px', opacity: 0.7, fontStyle: 'italic' }}>
          No active swarms. Click "Spawn Swarm" to start.
        </div>
      ) : (
        <div style={{ marginTop: '10px' }}>
          {activeSwarms.map((swarm) => {
            const result = swarmResults[swarm.id]
            const isExpanded = expandedSwarm === swarm.id
            return (
              <div key={swarm.id} style={{ marginBottom: '10px', border: '1px solid rgba(0, 255, 255, 0.3)', borderRadius: '4px', padding: '8px' }}>
                <div className="metric-item" style={{ fontSize: '11px', cursor: 'pointer' }} onClick={() => handleViewSwarm(swarm.id)}>
                  <span className="metric-label" style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {swarm.project?.substring(0, 20) || swarm.id}
                  </span>
                  <span className="metric-value" style={{ color: getStatusColor(swarm.status) }}>
                    {swarm.status}
                  </span>
                </div>
                
                {isExpanded && result && (
                  <div style={{ marginTop: '8px', fontSize: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                    {result.results?.final && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#00ffff' }}>Final Result:</div>
                        <pre style={{ 
                          background: 'rgba(0, 0, 0, 0.5)', 
                          padding: '8px', 
                          borderRadius: '4px',
                          fontSize: '9px',
                          overflow: 'auto',
                          maxHeight: '150px',
                          color: '#00ff00',
                          fontFamily: 'monospace'
                        }}>
                          {result.results.final.substring(0, 500)}
                          {result.results.final.length > 500 && '...'}
                        </pre>
                      </div>
                    )}
                    {result.error && (
                      <div style={{ color: '#ff00ff', fontSize: '10px' }}>
                        Error: {result.error}
                      </div>
                    )}
                    <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '4px' }}>
                      Started: {new Date(swarm.startTime).toLocaleTimeString()}
                      {swarm.endTime && ` | Completed: ${new Date(swarm.endTime).toLocaleTimeString()}`}
                    </div>
                    <button
                      onClick={() => handleOpenChat(swarm.id)}
                      style={{
                        marginTop: '8px',
                        background: 'rgba(0, 255, 0, 0.2)',
                        border: '1px solid #00ff00',
                        color: '#00ff00',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontFamily: 'Orbitron, monospace',
                        textTransform: 'uppercase'
                      }}
                    >
                      💬 Chat
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      
      {showChat && chatSwarmId && (
        <SwarmChat
          swarmId={chatSwarmId}
          onClose={() => {
            setShowChat(false)
            setChatSwarmId(null)
          }}
        />
      )}
    </div>
  )
}
