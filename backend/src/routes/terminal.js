import express from 'express'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'
import { getProjectRoot } from './files.js'

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Determine shell based on OS
const isWindows = os.platform() === 'win32'
const shell = isWindows ? 'cmd.exe' : '/bin/bash'
const shellFlag = isWindows ? '/c' : '-c'

// Security: Block dangerous commands
const DANGEROUS_PATTERNS = [
  /rm\s+-rf/i,
  /format\s+[cd]:/i,
  /del\s+\/f/i,
  /sudo\s+/i,
  /chmod\s+777/i,
  /chown\s+/i,
  /mkfs/i,
  /dd\s+if=/i,
  /shutdown/i,
  /reboot/i
]

function isDangerousCommand(command) {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(command))
}

// Execute command with proper shell (Windows CMD or Unix shell)
router.post('/execute', async (req, res) => {
  try {
    const { command } = req.body
    
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'Command is required' })
    }

    // Security check
    if (isDangerousCommand(command)) {
      return res.status(403).json({ 
        error: 'Command not allowed for security reasons',
        blocked: true
      })
    }

    // Set up proper shell execution
    const PROJECT_ROOT = getProjectRoot()
    const commandParts = isWindows 
      ? [shellFlag, command]  // cmd.exe /c "command"
      : [shellFlag, command]  // bash -c "command"

    let output = ''
    let errorOutput = ''
    let exitCode = 0

    return new Promise((resolve) => {
      const process = spawn(shell, commandParts, {
        cwd: PROJECT_ROOT,
        env: { ...process.env, FORCE_COLOR: '0' },
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      // Collect stdout
      process.stdout.on('data', (data) => {
        output += data.toString()
      })

      // Collect stderr
      process.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      // Handle process completion
      process.on('close', (code) => {
        exitCode = code || 0
        const finalOutput = output || errorOutput || ''
        
        res.json({
          success: exitCode === 0,
          output: finalOutput,
          error: exitCode !== 0 ? errorOutput : null,
          exitCode
        })
        resolve()
      })

      // Handle errors
      process.on('error', (err) => {
        res.json({
          success: false,
          error: err.message || 'Process spawn failed',
          output: output || errorOutput,
          exitCode: -1
        })
        resolve()
      })

      // Timeout after 60 seconds
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGTERM')
          res.json({
            success: false,
            error: 'Command execution timeout (60s)',
            output: output || errorOutput,
            exitCode: -1,
            timeout: true
          })
          resolve()
        }
      }, 60000)
    })
  } catch (error) {
    res.json({
      success: false,
      error: error.message || 'Command execution failed',
      output: '',
      exitCode: -1
    })
  }
})

// Get current working directory
router.get('/cwd', (req, res) => {
  res.json({ cwd: getProjectRoot() })
})

// Change directory (for future use)
router.post('/cd', async (req, res) => {
  // Note: This is informational - actual cd is handled by shell context
  const { path: newPath } = req.body
  res.json({ 
    message: 'Directory change handled by shell context',
    suggestedPath: newPath 
  })
})

// Get shared terminal history (all worker commands)
router.get('/history', async (req, res) => {
  try {
    const { getCommandHistory, getRecentCommands } = await import('../services/terminalService.js')
    const { since } = req.query
    
    if (since) {
      const sinceTimestamp = parseInt(since, 10)
      const recent = getRecentCommands(sinceTimestamp)
      res.json({ success: true, commands: recent })
    } else {
      const limit = parseInt(req.query.limit || '100', 10)
      const history = getCommandHistory(limit)
      res.json({ success: true, commands: history })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router
