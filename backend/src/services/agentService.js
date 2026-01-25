import { ChatOpenAI } from '@langchain/openai'
import { ChatOllama } from '@langchain/community/chat_models/ollama'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { broadcastMetrics } from '../utils/websocket.js'

// Store active swarms
const activeSwarms = new Map()

// Initialize LLM based on environment or user config
function getLLM(config = null) {
  // Use user-provided config if available
  if (config) {
    if (config.type === 'ollama') {
      return new ChatOllama({
        baseUrl: config.baseUrl || 'http://localhost:11434',
        model: config.model || 'qwen2.5-coder',
        temperature: 0.7
      })
    } else if (config.type === 'openai') {
      if (!config.apiKey) {
        throw new Error('OpenAI API key is required')
      }
      return new ChatOpenAI({
        modelName: config.model || 'gpt-4-turbo-preview',
        temperature: 0.7,
        openAIApiKey: config.apiKey
      })
    }
  }
  
  // Fallback to environment variables
  const useOllama = process.env.USE_OLLAMA === 'true'
  
  if (useOllama) {
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5-coder'
    
    return new ChatOllama({
      baseUrl: ollamaBaseUrl,
      model: ollamaModel,
      temperature: 0.7
    })
  } else {
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not set. Either set OPENAI_API_KEY or USE_OLLAMA=true')
    }
    
    return new ChatOpenAI({
      modelName: 'gpt-4-turbo-preview',
      temperature: 0.7,
      openAIApiKey: openaiApiKey
    })
  }
}

// Agent roles with their system prompts
const agentRoles = {
  architect: {
    role: 'Software Architect',
    systemPrompt: 'You are an expert software architect. Your goal is to design system architecture and plan implementation. Break down complex projects into manageable components. Provide detailed project plans with architecture and implementation steps.'
  },
  builder: {
    role: 'Senior Developer',
    systemPrompt: 'You are a senior full-stack developer. Your goal is to write high-quality, production-ready code. Write clean, efficient code in multiple languages (Python, JavaScript, TypeScript, etc.). Provide complete, working code implementations.'
  },
  optimizer: {
    role: 'Performance Optimizer',
    systemPrompt: 'You are a performance optimization specialist. Your goal is to optimize code for performance and efficiency. Identify bottlenecks and optimize code for speed and resource usage. Provide optimized code with performance improvements.'
  },
  tester: {
    role: 'QA Engineer',
    systemPrompt: 'You are a QA engineer. Your goal is to test and validate code quality. Ensure code reliability through comprehensive testing and debugging. Provide tested and validated code ready for deployment.'
  }
}

// Execute a task with a specific agent
async function executeAgentTask(llm, agentRole, taskDescription, previousResults = '') {
  const agent = agentRoles[agentRole]
  const context = previousResults ? `\n\nPrevious work:\n${previousResults}` : ''
  
  const messages = [
    new SystemMessage(agent.systemPrompt),
    new HumanMessage(`${taskDescription}${context}`)
  ]
  
  const response = await llm.invoke(messages)
  return response.content
}

export async function spawnAgentSwarm(projectDescription, llmConfig = null) {
  const swarmId = `swarm-${Date.now()}`
  
  try {
    // Get LLM instance - wrap in try-catch for better error handling
    let llm
    try {
      llm = getLLM(llmConfig)
    } catch (llmError) {
      // Store swarm with error status
      activeSwarms.set(swarmId, {
        status: 'error',
        project: projectDescription,
        startTime: Date.now(),
        error: llmError.message,
        results: {},
        llmConfig: llmConfig
      })
      throw new Error(`LLM configuration error: ${llmError.message}`)
    }
    
    // Store swarm with LLM config
    activeSwarms.set(swarmId, {
      status: 'running',
      project: projectDescription,
      startTime: Date.now(),
      results: {},
      llmConfig: llmConfig,
      chatHistory: []
    })

    // Execute agent tasks sequentially asynchronously
    ;(async () => {
      try {
        let previousResults = ''
        
        // Step 1: Architect plans
        broadcastMetrics({
          activeTasks: activeSwarms.size,
          message: `Swarm ${swarmId}: Architect planning...`
        })
        const plan = await executeAgentTask(
          llm,
          'architect',
          `Analyze and plan the project: ${projectDescription}`,
          previousResults
        )
        previousResults = `Architecture Plan:\n${plan}\n\n`
        
        // Step 2: Builder codes
        broadcastMetrics({
          activeTasks: activeSwarms.size,
          message: `Swarm ${swarmId}: Builder coding...`
        })
        const code = await executeAgentTask(
          llm,
          'builder',
          'Implement the project based on the architecture plan',
          previousResults
        )
        previousResults += `Implementation:\n${code}\n\n`
        
        // Step 3: Optimizer refines
        broadcastMetrics({
          activeTasks: activeSwarms.size,
          message: `Swarm ${swarmId}: Optimizer refining...`
        })
        const optimized = await executeAgentTask(
          llm,
          'optimizer',
          'Review and optimize the implemented code',
          previousResults
        )
        previousResults += `Optimized Code:\n${optimized}\n\n`
        
        // Step 4: Tester validates
        broadcastMetrics({
          activeTasks: activeSwarms.size,
          message: `Swarm ${swarmId}: Tester validating...`
        })
        const tested = await executeAgentTask(
          llm,
          'tester',
          'Test the optimized code and fix any issues',
          previousResults
        )
        
        // Update swarm status
        const swarm = activeSwarms.get(swarmId)
        if (swarm) {
          swarm.status = 'completed'
          swarm.results = {
            plan,
            code,
            optimized,
            tested,
            final: tested
          }
          swarm.endTime = Date.now()
        }
        
        // Broadcast completion
        broadcastMetrics({
          activeTasks: activeSwarms.size,
          message: `Swarm ${swarmId} completed`
        })
      } catch (error) {
        const swarm = activeSwarms.get(swarmId)
        if (swarm) {
          swarm.status = 'error'
          swarm.error = error.message
        }
        console.error(`Swarm ${swarmId} error:`, error)
      }
    })()

    // Update metrics
    broadcastMetrics({
      activeTasks: activeSwarms.size
    })

    return swarmId
  } catch (error) {
    console.error('Error spawning agent swarm:', error)
    throw error
  }
}

export function getActiveSwarms() {
  return Array.from(activeSwarms.entries()).map(([id, swarm]) => ({
    id,
    status: swarm.status,
    project: swarm.project,
    startTime: swarm.startTime,
    endTime: swarm.endTime,
    error: swarm.error
  }))
}

export function getSwarmResult(swarmId) {
  const swarm = activeSwarms.get(swarmId)
  if (!swarm) return null
  
  return {
    id: swarmId,
    status: swarm.status,
    project: swarm.project,
    startTime: swarm.startTime,
    endTime: swarm.endTime,
    results: swarm.results,
    error: swarm.error,
    chatHistory: swarm.chatHistory || []
  }
}

// Chat with swarm agents interactively
export async function chatWithSwarm(swarmId, message) {
  const swarm = activeSwarms.get(swarmId)
  if (!swarm) {
    throw new Error('Swarm not found')
  }

  // Initialize chat history if needed
  if (!swarm.chatHistory) {
    swarm.chatHistory = []
  }

  // Add user message to history
  swarm.chatHistory.push({ role: 'user', content: message })

  try {
    // Get LLM instance
    const llm = getLLM(swarm.llmConfig)
    
    // Determine which agent should respond (round-robin or based on context)
    const agents = ['architect', 'builder', 'optimizer', 'tester']
    const agentIndex = swarm.chatHistory.length % agents.length
    const agentRole = agents[agentIndex]
    const agent = agentRoles[agentRole]

    // Build context from chat history
    const context = swarm.chatHistory
      .slice(-5) // Last 5 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n')

    const messages = [
      new SystemMessage(`${agent.systemPrompt}\n\nYou are part of a swarm working on: ${swarm.project}\n\nPrevious conversation:\n${context}`),
      new HumanMessage(message)
    ]

    const response = await llm.invoke(messages)
    const responseContent = response.content

    // Add agent response to history
    swarm.chatHistory.push({ 
      role: 'assistant', 
      content: responseContent,
      agent: agent.role
    })

    return {
      response: responseContent,
      agent: agent.role
    }
  } catch (error) {
    console.error('Chat error:', error)
    throw error
  }
}
