import { useState, useRef, useEffect } from 'react'
import { useVoidStore } from '../../store/voidStore'
import './CodeChat.css'

export default function CodeChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [aiStatus, setAiStatus] = useState(null)
  const endRef = useRef(null)
  const { isConnected, llmConfig, workers } = useVoidStore()

  // Monitor worker activity
  useEffect(() => {
    const activeWorkers = workers.filter(w => w.status === 'working' || w.status === 'communicating')
    if (activeWorkers.length > 0) {
      const workerNames = activeWorkers.map(w => w.name || w.model).join(', ')
      setAiStatus(`${workerNames} ${activeWorkers.length === 1 ? 'is' : 'are'} working...`)
    } else {
      setAiStatus(null)
    }
  }, [workers])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const history = messages
    .filter((m) => m.role !== 'error')
    .reduce((acc, m) => {
      if (m.role === 'user') acc.push({ user: m.content, assistant: '' })
      else if (m.role === 'assistant' && acc.length) acc[acc.length - 1].assistant = m.content
      return acc
    }, [])

  const send = async () => {
    const text = input.trim()
    if (!text || loading || !isConnected) return

    setError(null)
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)

    const body = { message: text, history }
    if (llmConfig?.type === 'ollama') {
      body.model = llmConfig.model || 'qwen2.5-coder'
      body.baseUrl = llmConfig.baseUrl || 'http://localhost:11434'
    }

    try {
      const res = await fetch('http://localhost:3000/api/ollama/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Request failed')
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response || '' },
      ])
    } catch (e) {
      setError(e.message)
      setMessages((prev) => [
        ...prev,
        { role: 'error', content: e.message },
      ])
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="code-chat">
      <div className="code-chat-messages">
        {messages.length === 0 && (
          <div className="code-chat-empty">
            <p>Ask for code, refactors, or explanations.</p>
            <p className="muted">
              {llmConfig?.type === 'ollama'
                ? `Ollama · ${llmConfig.model || 'qwen2.5-coder'}`
                : 'Ollama · qwen2.5-coder'}
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`code-chat-msg ${m.role}`}>
            <span className="code-chat-role">
              {m.role === 'user' ? 'You' : m.role === 'error' ? 'Error' : 'AI'}
            </span>
            <pre className="code-chat-content">{m.content}</pre>
          </div>
        ))}
        {loading && (
          <div className="code-chat-msg assistant">
            <span className="code-chat-role">AI</span>
            <div className="code-chat-thinking">
              <div className="code-chat-spinner"></div>
              <span>Thinking...</span>
            </div>
          </div>
        )}
        
        {aiStatus && !loading && (
          <div className="code-chat-status">
            <div className="code-chat-status-indicator"></div>
            <span>{aiStatus}</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="code-chat-banner error">
          {error}
        </div>
      )}
      {!isConnected && (
        <div className="code-chat-banner warn">
          Backend not connected. Start the server.
        </div>
      )}

      <div className="code-chat-input-wrap">
        <textarea
          className="code-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Code question or request..."
          disabled={loading || !isConnected}
          rows={2}
        />
        <button
          className="code-chat-send"
          onClick={send}
          disabled={loading || !input.trim() || !isConnected}
        >
          Send
        </button>
      </div>
    </div>
  )
}
