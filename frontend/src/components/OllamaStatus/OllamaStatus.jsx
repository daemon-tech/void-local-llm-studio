import { useEffect } from 'react'
import { useVoidStore } from '../../store/voidStore'
import './OllamaStatus.css'

export default function OllamaStatus() {
  const { ollamaOnline, setOllamaOnline, llmConfig } = useVoidStore()

  useEffect(() => {
    if (llmConfig?.type !== 'ollama') {
      setOllamaOnline(false)
      return
    }

    const checkOllama = async () => {
      try {
        const baseUrl = llmConfig.baseUrl || 'http://localhost:11434'
        
        // First check if backend is available
        try {
          const healthCheck = await fetch('http://localhost:3000/api/health', {
            method: 'GET',
            signal: AbortSignal.timeout(2000)
          })
          if (!healthCheck.ok) {
            // Backend not ready yet
            return
          }
        } catch (healthError) {
          // Backend not available, skip Ollama check
          return
        }
        
        // Backend is available, check Ollama
        const response = await fetch('http://localhost:3000/api/ollama/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseUrl }),
          signal: AbortSignal.timeout(5000)
        })
        
        if (!response.ok) {
          console.warn(`[Ollama Status] Backend check failed: ${response.status}`)
          setOllamaOnline(false)
          return
        }
        
        const data = await response.json()
        
        // Explicitly check for online === true (strict equality)
        const isOnline = data.online === true
        console.log(`[Ollama Status] ${baseUrl}:`, isOnline ? 'ONLINE' : 'OFFLINE', data)
        
        setOllamaOnline(isOnline)
      } catch (error) {
        // Only log if it's not a connection refused (backend not running)
        if (error.name !== 'AbortError' && !error.message.includes('Failed to fetch')) {
          console.warn('[Ollama Status] Check error:', error.message)
        }
        // Don't set offline if backend isn't running - wait for it
        if (error.message && error.message.includes('Failed to fetch')) {
          // Backend not available, don't change status
          return
        }
        setOllamaOnline(false)
      }
    }

    // Check immediately
    checkOllama()
    // Then check every 5 seconds
    const interval = setInterval(checkOllama, 5000)
    return () => clearInterval(interval)
  }, [llmConfig, setOllamaOnline])

  if (llmConfig?.type !== 'ollama') {
    return null
  }

  return (
    <div className="ollama-status">
      <div className={`ollama-status-dot ${ollamaOnline ? 'online' : 'offline'}`} />
      <span className="ollama-status-label">
        {ollamaOnline ? 'Ollama Online' : 'Ollama Offline'}
      </span>
    </div>
  )
}
