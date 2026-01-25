import express from 'express'
import axios from 'axios'

const router = express.Router()

// Grok API proxy endpoint
router.post('/query', async (req, res) => {
  try {
    const { query } = req.body
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' })
    }

    const grokApiKey = process.env.GROK_API_KEY
    if (!grokApiKey) {
      return res.status(500).json({ 
        error: 'Grok API key not configured',
        message: 'Set GROK_API_KEY in your .env file'
      })
    }

    // Call Grok API
    const response = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      {
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful coding assistant in a cyberpunk 3D IDE. Provide concise, actionable code suggestions.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${grokApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const answer = response.data.choices[0]?.message?.content || 'No response'

    res.json({
      success: true,
      query,
      answer,
      tokens: response.data.usage?.total_tokens || 0
    })
  } catch (error) {
    console.error('Grok API error:', error.response?.data || error.message)
    res.status(500).json({
      error: 'Grok API request failed',
      message: error.response?.data?.error?.message || error.message
    })
  }
})

export default router
