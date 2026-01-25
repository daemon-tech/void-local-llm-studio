import express from 'express'
import axios from 'axios'
import { ChatOllama } from '@langchain/community/chat_models/ollama'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'

const router = express.Router()

const CODING_SYSTEM = `You are a concise coding assistant. You help with code: write, refactor, debug, explain.
Answer with clear, runnable code when relevant. Prefer brevity.`

function getOllama(baseUrl = 'http://localhost:11434', model = 'qwen2.5-coder') {
  return new ChatOllama({
    baseUrl,
    model,
    temperature: 0.5,
  })
}

router.post('/check', async (req, res) => {
  try {
    const { baseUrl } = req.body
    const url = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    
    console.log(`[Ollama Check] Testing connection to: ${url}`)
    
    // Quick check if Ollama is reachable
    try {
      const response = await axios.get(`${url}/api/tags`, {
        timeout: 5000,
        validateStatus: () => true, // Don't throw on any status code
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      // If we get a 200 response, Ollama is definitely online
      if (response.status === 200) {
        console.log(`[Ollama Check] ✅ Online at ${url}`)
        return res.json({ online: true })
      }
      
      // If we get any HTTP response (even errors), the server is reachable
      // This means Ollama service exists but might have issues
      if (response.status >= 200 && response.status < 500) {
        console.log(`[Ollama Check] ⚠️ Server reachable but status ${response.status} at ${url}`)
        // Still consider it online if we got a response
        return res.json({ online: true, warning: `Status ${response.status}` })
      }
      
      console.log(`[Ollama Check] ❌ Unexpected status ${response.status} at ${url}`)
      return res.json({ online: false, status: response.status })
      
    } catch (error) {
      // Network-level errors mean Ollama is truly offline
      if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
        console.log(`[Ollama Check] Connection refused at ${url} - Ollama may not be running`)
        return res.json({ online: false, error: 'Connection refused', code: error.code })
      } 
      
      if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout') || error.code === 'ECONNABORTED') {
        console.log(`[Ollama Check] Timeout connecting to ${url}`)
        return res.json({ online: false, error: 'Connection timeout', code: error.code })
      }
      
      if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
        console.log(`[Ollama Check] DNS/hostname error for ${url}`)
        return res.json({ online: false, error: 'Host not found', code: error.code })
      }
      
      // If axios got a response object, server is reachable
      if (error.response) {
        const status = error.response.status
        console.log(`[Ollama Check] HTTP ${status} from ${url} - server is reachable`)
        // Consider it online if server responded (even with error)
        return res.json({ online: status < 500, status })
      }
      
      // Unknown error - log it but assume offline
      console.log(`[Ollama Check] Unknown error:`, error.code, error.message)
      return res.json({ online: false, error: error.message || 'Unknown error', code: error.code })
    }
  } catch (err) {
    console.error('[Ollama Check] Outer error:', err)
    return res.json({ online: false, error: err.message || 'Unknown error' })
  }
})

// Get available Ollama models
router.get('/models', async (req, res) => {
  try {
    const { baseUrl } = req.query
    const url = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    
    console.log(`[Ollama Models] Fetching models from: ${url}`)
    
    try {
      const response = await axios.get(`${url}/api/tags`, {
        timeout: 5000,
        validateStatus: () => true
      })
      
      if (response.status === 200 && response.data && response.data.models) {
        const models = response.data.models.map(m => ({
          name: m.name,
          size: m.size,
          modified: m.modified_at,
          digest: m.digest
        }))
        
        console.log(`[Ollama Models] ✅ Found ${models.length} models`)
        return res.json({ success: true, models })
      }
      
      return res.json({ success: false, error: 'Invalid response from Ollama', status: response.status })
    } catch (error) {
      console.error('[Ollama Models] Error:', error.message)
      return res.json({ 
        success: false, 
        error: error.message || 'Failed to fetch models',
        code: error.code
      })
    }
  } catch (err) {
    console.error('[Ollama Models] Outer error:', err)
    return res.json({ success: false, error: err.message || 'Unknown error' })
  }
})

router.post('/chat', async (req, res) => {
  try {
    const { message, history = [], model, baseUrl } = req.body
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' })
    }

    const ollama = getOllama(
      baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model || process.env.OLLAMA_MODEL || 'qwen2.5-coder'
    )

    const pairs = Array.isArray(history) ? history.slice(-10) : []
    const messages = [
      new SystemMessage(CODING_SYSTEM),
      ...pairs.flatMap((h) => [
        new HumanMessage(h.user || ''),
        new AIMessage(h.assistant || ''),
      ]),
      new HumanMessage(message),
    ]

    const response = await ollama.invoke(messages)
    const content = typeof response.content === 'string' ? response.content : String(response.content ?? '')

    res.json({ ok: true, response: content })
  } catch (err) {
    console.error('Ollama chat error:', err)
    res.status(500).json({
      ok: false,
      error: err.message || 'Ollama request failed',
    })
  }
})

export default router
