import { useState } from 'react'
import './LLMSelector.css'

export default function LLMSelector({ onSelect, onClose }) {
  const [llmType, setLlmType] = useState('ollama')
  const [ollamaModel, setOllamaModel] = useState('qwen2.5-coder')
  const [openaiModel, setOpenaiModel] = useState('gpt-4-turbo-preview')
  const [openaiKey, setOpenaiKey] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')

  const handleSubmit = () => {
    const config = {
      type: llmType,
      model: llmType === 'ollama' ? ollamaModel : openaiModel,
      ...(llmType === 'ollama' 
        ? { baseUrl: ollamaUrl }
        : { apiKey: openaiKey }
      )
    }
    onSelect(config)
  }

  return (
    <div className="llm-selector-overlay" onClick={onClose}>
      <div className="llm-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="llm-selector-header">
          <h2>Select LLM Configuration</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="llm-selector-content">
          <div className="llm-type-selector">
            <label>
              <input
                type="radio"
                value="ollama"
                checked={llmType === 'ollama'}
                onChange={(e) => setLlmType(e.target.value)}
              />
              <span>Ollama (Local)</span>
            </label>
            <label>
              <input
                type="radio"
                value="openai"
                checked={llmType === 'openai'}
                onChange={(e) => setLlmType(e.target.value)}
              />
              <span>OpenAI (Cloud)</span>
            </label>
          </div>

          {llmType === 'ollama' ? (
            <div className="llm-config">
              <label>
                Ollama Base URL:
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                />
              </label>
              <label>
                Model:
                <select value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)}>
                  <option value="qwen2.5-coder">qwen2.5-coder</option>
                  <option value="deepseek-coder">deepseek-coder</option>
                  <option value="codellama">codellama</option>
                  <option value="mistral">mistral</option>
                  <option value="llama2">llama2</option>
                </select>
              </label>
            </div>
          ) : (
            <div className="llm-config">
              <label>
                OpenAI API Key:
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </label>
              <label>
                Model:
                <select value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)}>
                  <option value="gpt-4-turbo-preview">GPT-4 Turbo</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </label>
            </div>
          )}

          <div className="llm-selector-actions">
            <button className="btn-primary" onClick={handleSubmit}>
              Use This LLM
            </button>
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
