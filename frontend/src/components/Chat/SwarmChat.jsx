import { useState, useEffect, useRef } from 'react'
import { useVoidStore } from '../../store/voidStore'
import './SwarmChat.css'

export default function SwarmChat({ swarmId, onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const { isConnected } = useVoidStore()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !isConnected) return

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch(`http://localhost:3000/api/agents/${swarmId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      })

      const data = await response.json()
      
      const aiMessage = {
        role: 'assistant',
        content: data.response || data.error || 'No response',
        agent: data.agent,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, aiMessage])
    } catch (error) {
      const errorMessage = {
        role: 'error',
        content: `Error: ${error.message}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="swarm-chat-overlay" onClick={onClose}>
      <div className="swarm-chat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="swarm-chat-header">
          <h3>Swarm Chat - {swarmId}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="swarm-chat-messages">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <p>Start chatting with the swarm agents...</p>
              <p className="chat-hint">Ask questions, give instructions, or request modifications</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                <div className="message-header">
                  <span className="message-role">
                    {msg.role === 'user' ? '👤 You' : msg.agent ? `🤖 ${msg.agent}` : '🤖 Agent'}
                  </span>
                  <span className="message-time">
                    {msg.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className="message-content">{msg.content}</div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="chat-message loading">
              <div className="message-content">
                <span className="typing-indicator">●</span>
                <span className="typing-indicator">●</span>
                <span className="typing-indicator">●</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="swarm-chat-input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            disabled={isLoading || !isConnected}
            rows={2}
          />
          <button 
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || !isConnected}
            className="send-btn"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
