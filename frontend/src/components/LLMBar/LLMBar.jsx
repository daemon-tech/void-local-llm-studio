import { useState } from 'react'
import { useVoidStore } from '../../store/voidStore'
import LLMSelector from '../LLMSelector/LLMSelector'
import './LLMBar.css'

export default function LLMBar() {
  const { isConnected, llmConfig } = useVoidStore()
  const [open, setOpen] = useState(false)

  const label = llmConfig
    ? `${llmConfig.type === 'ollama' ? 'Ollama' : 'OpenAI'} · ${llmConfig.model || '—'}`
    : 'Select LLM'

  return (
    <header className="llm-bar">
      <div className="llm-bar-left">
        <span className="llm-bar-logo">void</span>
        <button
          type="button"
          className="llm-bar-model"
          onClick={() => setOpen(true)}
        >
          {label}
        </button>
      </div>
      <div className="llm-bar-right">
        <span className={`llm-bar-dot ${isConnected ? 'on' : ''}`} />
        <span className="llm-bar-status">{isConnected ? 'Connected' : 'Offline'}</span>
      </div>
      {open && (
        <LLMSelector
          onSelect={(config) => {
            useVoidStore.getState().setLlmConfig(config)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </header>
  )
}
