import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import grokRouter from './routes/grok.js'
import agentsRouter from './routes/agents.js'
import healthRouter from './routes/health.js'
import ollamaRouter from './routes/ollama.js'
import workersRouter from './routes/workers.js'
import filesRouter from './routes/files.js'
import terminalRouter from './routes/terminal.js'
import { setWebSocketServer } from './utils/websocket.js'

dotenv.config()

console.log('📦 Starting Void backend...')

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Routes
console.log('📡 Setting up routes...')
try {
  app.use('/api/health', healthRouter)
  app.use('/api/ollama', ollamaRouter)
  app.use('/api/grok', grokRouter)
  app.use('/api/agents', agentsRouter)
  app.use('/api/workers', workersRouter)
  app.use('/api/files', filesRouter)
  app.use('/api/terminal', terminalRouter)
  console.log('✅ Routes configured')
} catch (error) {
  console.error('❌ Route setup error:', error)
  process.exit(1)
}

// WebSocket server for real-time updates
const server = createServer(app)
const wss = new WebSocketServer({ server })

// Set WebSocket instance for utilities
setWebSocketServer(wss)

wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket')
  
  ws.on('message', (message) => {
    console.log('Received:', message.toString())
  })
  
  ws.on('close', () => {
    console.log('Client disconnected')
  })
})

server.listen(PORT, () => {
  console.log(`🚀 Void backend running on http://localhost:${PORT}`)
  console.log(`📡 WebSocket server ready`)
}).on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please stop the other process or use a different port.`)
  } else {
    console.error('❌ Server error:', error)
  }
  process.exit(1)
})

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  // Don't exit - let the process continue
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  // Don't exit - let the process continue
})
