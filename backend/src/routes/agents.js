import express from 'express'
import { spawnAgentSwarm, getActiveSwarms, getSwarmResult, chatWithSwarm } from '../services/agentService.js'

const router = express.Router()

// Spawn autonomous agent swarm
router.post('/spawn', async (req, res) => {
  try {
    const { project, llmConfig } = req.body
    
    if (!project) {
      return res.status(400).json({ 
        success: false,
        error: 'Project description is required' 
      })
    }

    if (!llmConfig) {
      return res.status(400).json({
        success: false,
        error: 'LLM configuration is required. Please select an LLM first.'
      })
    }

    // Spawn agent swarm asynchronously with custom LLM config
    const swarmId = await spawnAgentSwarm(project, llmConfig)
    
    res.json({
      success: true,
      swarmId,
      message: 'Agent swarm spawned successfully',
      project
    })
  } catch (error) {
    console.error('Agent spawn error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to spawn agent swarm',
      message: error.message || 'Unknown error occurred. Check backend logs for details.'
    })
  }
})


// Get active swarms (must come before /:swarmId to avoid route conflicts)
router.get('/active', (req, res) => {
  try {
    const swarms = getActiveSwarms()
    res.json({
      swarms,
      count: swarms.length
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get active swarms',
      message: error.message
    })
  }
})

// Chat with swarm (must come before /:swarmId to avoid route conflicts)
router.post('/:swarmId/chat', async (req, res) => {
  try {
    const { swarmId } = req.params
    const { message } = req.body
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const result = await chatWithSwarm(swarmId, message)
    
    res.json({
      success: true,
      response: result.response,
      agent: result.agent
    })
  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({
      error: 'Failed to chat with swarm',
      message: error.message
    })
  }
})

// Get swarm result by ID (must come after /active and /:swarmId/chat to avoid conflicts)
router.get('/:swarmId', (req, res) => {
  try {
    const { swarmId } = req.params
    const result = getSwarmResult(swarmId)
    
    if (!result) {
      return res.status(404).json({ error: 'Swarm not found' })
    }
    
    res.json(result)
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get swarm result',
      message: error.message
    })
  }
})

export default router
