import express from 'express'
import { spawnWorker, getWorkers, getWorker, updateWorker, removeWorker, assignTask, sendMessage, getWorkerActivity, executeCommandWithPermission } from '../services/workerService.js'
import * as fileService from '../services/fileService.js'
import * as permissionService from '../services/permissionService.js'

const router = express.Router()

// Spawn a new worker (LLM instance)
router.post('/spawn', async (req, res) => {
  try {
    const { name, model, baseUrl, role } = req.body
    
    console.log('Spawning worker with config:', { name, model, baseUrl, role })

    const worker = await spawnWorker({
      name: name || `Worker-${Date.now()}`,
      model: model || 'qwen2.5-coder',
      baseUrl: baseUrl || 'http://localhost:11434',
      role: role || 'coder'
    })
    
    console.log('Worker spawned successfully:', worker.id)
    
    res.json({
      success: true,
      worker
    })
  } catch (error) {
    console.error('Worker spawn error:', error)
    const errorMessage = error.message || 'Unknown error'
    res.status(500).json({
      success: false,
      error: 'Failed to spawn worker',
      message: errorMessage
    })
  }
})

// Get all workers
router.get('/', (req, res) => {
  try {
    const workers = getWorkers()
    res.json({ workers, count: workers.length })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get workers',
      message: error.message
    })
  }
})

// Get specific worker
router.get('/:workerId', (req, res) => {
  try {
    const { workerId } = req.params
    const worker = getWorker(workerId)
    
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' })
    }
    
    res.json(worker)
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get worker',
      message: error.message
    })
  }
})

// Update worker
router.patch('/:workerId', (req, res) => {
  try {
    const { workerId } = req.params
    const updates = req.body
    
    const worker = updateWorker(workerId, updates)
    
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' })
    }
    
    res.json({ success: true, worker })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update worker',
      message: error.message
    })
  }
})

// Remove worker
router.delete('/:workerId', (req, res) => {
  try {
    const { workerId } = req.params
    const success = removeWorker(workerId)
    
    if (!success) {
      return res.status(404).json({ error: 'Worker not found' })
    }
    
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to remove worker',
      message: error.message
    })
  }
})

// Assign task to worker
router.post('/:workerId/task', async (req, res) => {
  try {
    const { workerId } = req.params
    const { task, context, debugUntilWorks = false, maxIterations = 10 } = req.body
    
    if (!task) {
      return res.status(400).json({ error: 'Task is required' })
    }

    const result = await assignTask(workerId, task, context, { debugUntilWorks, maxIterations })
    
    res.json({
      success: true,
      result
    })
  } catch (error) {
    console.error('Task assignment error:', error)
    res.status(500).json({
      error: 'Failed to assign task',
      message: error.message
    })
  }
})

// Assign task to multiple workers (job sharing)
router.post('/tasks/multi', async (req, res) => {
  try {
    const { workerIds, task, shareContext = true, debugUntilWorks = false, maxIterations = 10 } = req.body
    
    if (!task || !Array.isArray(workerIds) || workerIds.length === 0) {
      return res.status(400).json({ 
        error: 'Task and workerIds array are required' 
      })
    }

    // Assign task to all workers
    const assignments = await Promise.allSettled(
      workerIds.map(async (workerId, index) => {
        // Share context from other workers if enabled
        let context = {}
        if (shareContext && workerIds.length > 1) {
          // Get context from other workers' shared data
          const otherWorkers = workerIds.filter(id => id !== workerId)
          context = {
            collaboratingWith: otherWorkers,
            totalWorkers: workerIds.length,
            workerIndex: index
          }
        }
        
        return await assignTask(workerId, task, context, { debugUntilWorks, maxIterations })
      })
    )

    const results = assignments.map((result, index) => ({
      workerId: workerIds[index],
      success: result.status === 'fulfilled',
      result: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }))

    res.json({
      success: true,
      results,
      totalWorkers: workerIds.length,
      successful: results.filter(r => r.success).length
    })
  } catch (error) {
    console.error('Multi-worker task assignment error:', error)
    res.status(500).json({
      error: 'Failed to assign task to workers',
      message: error.message
    })
  }
})

// Send message between workers (inter-worker communication)
router.post('/:workerId/message', async (req, res) => {
  try {
    const { workerId } = req.params
    const { targetWorkerId, message, data } = req.body
    
    if (!targetWorkerId || !message) {
      return res.status(400).json({ 
        error: 'targetWorkerId and message are required' 
      })
    }

    const result = await sendMessage(workerId, targetWorkerId, message, data)
    
    res.json({
      success: true,
      result
    })
  } catch (error) {
    console.error('Worker message error:', error)
    res.status(500).json({
      error: 'Failed to send message',
      message: error.message
    })
  }
})

// Worker file operations
router.post('/:workerId/files/read', async (req, res) => {
  try {
    const { workerId } = req.params
    const { filePath } = req.body
    
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' })
    }

    const result = await fileService.workerReadFile(filePath)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/:workerId/files/write', async (req, res) => {
  try {
    const { workerId } = req.params
    const { filePath, content } = req.body
    
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' })
    }

    const result = await fileService.workerWriteFile(filePath, content || '')
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/:workerId/files/create', async (req, res) => {
  try {
    const { workerId } = req.params
    const { filePath, content } = req.body
    
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' })
    }

    const result = await fileService.workerCreateFile(filePath, content || '')
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/:workerId/files/delete', async (req, res) => {
  try {
    const { workerId } = req.params
    const { filePath } = req.body
    
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' })
    }

    const result = await fileService.workerDeleteFile(filePath)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/:workerId/files/list', async (req, res) => {
  try {
    const { workerId } = req.params
    const { dirPath = '' } = req.body

    const result = await fileService.workerListFiles(dirPath)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get worker activity/logs
// Get worker activity log
router.get('/:workerId/activity', (req, res) => {
  try {
    const { workerId } = req.params
    const worker = getWorker(workerId)
    
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' })
    }

    // Use activity log if available, otherwise format tasks
    const activity = worker.activityLog && worker.activityLog.length > 0
      ? worker.activityLog.slice(-100).reverse().map(entry => ({
          timestamp: entry.timestamp || Date.now(),
          message: entry.message || entry,
          type: entry.type,
          details: entry.details
        }))
      : (worker.tasks || []).map(task => ({
          timestamp: task.timestamp || Date.now(),
          message: `Task: ${task.task}`,
          type: 'task',
          result: task.result ? task.result.substring(0, 200) : ''
        }))

    res.json({
      success: true,
      activity
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get activity',
      message: error.message
    })
  }
})

// Chat with worker (send instructions/messages)
router.post('/:workerId/chat', async (req, res) => {
  try {
    const { workerId } = req.params
    const { message } = req.body
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    // Use assignTask to process the chat message
    const result = await assignTask(workerId, message)
    
    res.json({
      success: true,
      response: result.result || 'Message processed'
    })
  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({
      error: 'Failed to process chat message',
      message: error.message
    })
  }
})

// Worker terminal access - allows workers to execute commands
router.post('/:workerId/terminal/execute', async (req, res) => {
  try {
    const { workerId } = req.params
    const { command } = req.body
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' })
    }

    // Import terminal execution logic
    const { spawn } = await import('child_process')
    const os = await import('os')
    const path = await import('path')
    const { fileURLToPath } = await import('url')
    
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const PROJECT_ROOT = process.env.PROJECT_ROOT || path.join(__dirname, '../../workspace')
    
    const isWindows = os.platform() === 'win32'
    const shell = isWindows ? 'cmd.exe' : '/bin/bash'
    const shellFlag = isWindows ? '/c' : '-c'

    return new Promise((resolve) => {
      let output = ''
      let errorOutput = ''

      const process = spawn(shell, [shellFlag, command], {
        cwd: PROJECT_ROOT,
        env: { ...process.env },
        shell: false
      })

      process.stdout.on('data', (data) => {
        output += data.toString()
      })

      process.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      process.on('close', (code) => {
        res.json({
          success: code === 0,
          output: output || errorOutput,
          error: code !== 0 ? errorOutput : null,
          exitCode: code || 0
        })
        resolve()
      })

      process.on('error', (err) => {
        res.json({
          success: false,
          error: err.message,
          output: output || errorOutput,
          exitCode: -1
        })
        resolve()
      })

      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGTERM')
          res.json({
            success: false,
            error: 'Command timeout',
            output: output || errorOutput,
            exitCode: -1,
            timeout: true
          })
          resolve()
        }
      }, 60000)
    })
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    })
  }
})

// Get pending permissions
router.get('/permissions/pending', (req, res) => {
  try {
    const pending = permissionService.getPendingPermissions()
    res.json({ success: true, permissions: pending })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get pending permissions',
      message: error.message
    })
  }
})

// Grant permission
router.post('/permissions/:permissionId/grant', async (req, res) => {
  try {
    const { permissionId } = req.params
    const result = permissionService.grantPermission(permissionId)
    
    if (result.success) {
      // Execute the command now that permission is granted
      const permission = result.permission
      try {
        const commandResult = await executeCommandWithPermission(permission.workerId, permission.command, permissionId)
        res.json({
          success: true,
          permission: result.permission,
          commandResult
        })
      } catch (cmdError) {
        res.json({
          success: true,
          permission: result.permission,
          commandResult: { success: false, error: cmdError.message }
        })
      }
    } else {
      res.status(404).json(result)
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to grant permission',
      message: error.message
    })
  }
})

// Deny permission
router.post('/permissions/:permissionId/deny', (req, res) => {
  try {
    const { permissionId } = req.params
    const result = permissionService.denyPermission(permissionId)
    
    if (result.success) {
      res.json({ success: true, permission: result.permission })
    } else {
      res.status(404).json(result)
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to deny permission',
      message: error.message
    })
  }
})

export default router
