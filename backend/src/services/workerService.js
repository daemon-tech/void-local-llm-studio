import { ChatOllama } from '@langchain/community/chat_models/ollama'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import { broadcastMetrics } from '../utils/websocket.js'
import * as fileService from './fileService.js'
import * as permissionService from './permissionService.js'
import axios from 'axios'

// Store active workers
const workers = new Map()

// Worker roles and their system prompts
const workerRoles = {
  coder: {
    systemPrompt: 'You are a coding specialist. Write clean, efficient code. Focus on implementation details, syntax, and best practices. You can read, write, create, and modify files to build working code.'
  },
  architect: {
    systemPrompt: 'You are a software architect. Design system architecture, plan structure, and break down complex problems into components. Create file structures and organize code logically.'
  },
  reviewer: {
    systemPrompt: 'You are a code reviewer. Analyze code quality, find bugs, suggest improvements, and ensure best practices. Read files, identify issues, and propose fixes.'
  },
  tester: {
    systemPrompt: 'You are a testing specialist. Write comprehensive tests, identify edge cases, and ensure code reliability. Create test files and verify code works correctly.'
  },
  optimizer: {
    systemPrompt: 'You are a performance optimizer. Analyze code for bottlenecks, optimize algorithms, and improve efficiency. Read code, identify issues, and rewrite for better performance.'
  },
  researcher: {
    systemPrompt: 'You are a research specialist. Investigate solutions, compare approaches, and provide technical insights. Research best practices and document findings.'
  },
  debugger: {
    systemPrompt: 'You are a debugging specialist. Find and fix bugs in code. Read error messages, analyze code, identify root causes, and implement fixes. Test your fixes to ensure they work. Work autonomously until everything is fixed.'
  },
  autonomous: {
    systemPrompt: 'You are a fully autonomous coding agent. You work independently to complete tasks from start to finish. Create files, install dependencies, run servers, test applications, and fix any issues until everything works perfectly. You have full access to the file system and terminal.'
  }
}

// Spawn a new worker
export async function spawnWorker({ name, model, baseUrl, role = 'coder' }) {
  const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  try {
    // Test Ollama connection first (optional - don't fail if it times out, just warn)
    const ollamaUrl = baseUrl || 'http://localhost:11434'
    try {
      const testResponse = await axios.get(`${ollamaUrl}/api/tags`, {
        timeout: 2000
      })
      console.log(`Ollama connection test successful at ${ollamaUrl}`)
    } catch (testError) {
      console.warn(`Ollama connection test failed at ${ollamaUrl}:`, testError.message)
      // Don't throw - let ChatOllama handle the connection
      // This allows spawning even if Ollama is slow to respond
    }

    const ollamaModel = model || 'qwen2.5-coder'
    
    console.log(`Creating ChatOllama instance: ${ollamaModel} at ${ollamaUrl}`)
    
    const llm = new ChatOllama({
      baseUrl: ollamaUrl,
      model: ollamaModel,
      temperature: 0.7
    })
    
    console.log('ChatOllama instance created successfully')

    // Calculate position in a grid layout
    const workerCount = workers.size
    const cols = Math.ceil(Math.sqrt(workerCount + 1))
    const row = Math.floor(workerCount / cols)
    const col = workerCount % cols
    const spacing = 3
    const position = [
      (col - (cols - 1) / 2) * spacing,
      0,
      (row - (cols - 1) / 2) * spacing
    ]

    const worker = {
      id: workerId,
      name,
      model,
      baseUrl,
      role,
      status: 'idle',
      llm,
      position,
      tasks: [],
      sharedData: {},
      communicatingWith: [],
      activityLog: [], // Track all worker actions
      createdAt: Date.now()
    }

    workers.set(workerId, worker)
    
    broadcastMetrics({
      activeWorkers: workers.size
    })

    return {
      id: workerId,
      name,
      model,
      baseUrl,
      role,
      status: worker.status,
      position
    }
  } catch (error) {
    console.error('Error spawning worker:', error)
    const errorMessage = error.message || 'Unknown error'
    if (errorMessage.includes('Ollama') || errorMessage.includes('connect')) {
      throw new Error(errorMessage)
    }
    throw new Error(`Failed to spawn worker: ${errorMessage}. Check that Ollama is running and the model is installed.`)
  }
}

// Get all workers
export function getWorkers() {
  return Array.from(workers.entries()).map(([id, worker]) => ({
    id,
    name: worker.name,
    model: worker.model,
    baseUrl: worker.baseUrl,
    role: worker.role,
    status: worker.status,
    position: worker.position,
    tasks: worker.tasks.length,
    communicatingWith: worker.communicatingWith,
    createdAt: worker.createdAt
  }))
}

// Get specific worker
export function getWorker(workerId) {
  const worker = workers.get(workerId)
  if (!worker) return null

  return {
    id: workerId,
    name: worker.name,
    model: worker.model,
    baseUrl: worker.baseUrl,
    role: worker.role,
    status: worker.status,
    position: worker.position,
    tasks: worker.tasks,
    sharedData: worker.sharedData,
    communicatingWith: worker.communicatingWith,
    createdAt: worker.createdAt
  }
}

// Update worker
export function updateWorker(workerId, updates) {
  const worker = workers.get(workerId)
  if (!worker) return null

  Object.assign(worker, updates)
  return getWorker(workerId)
}

// Remove worker
export function removeWorker(workerId) {
  return workers.delete(workerId)
}

// Assign task to worker with file operations
export async function assignTask(workerId, task, context = {}, options = {}) {
  const worker = workers.get(workerId)
  if (!worker) {
    throw new Error('Worker not found')
  }

  const { debugUntilWorks = false, maxIterations = 10 } = options

  try {
    worker.status = 'working'
    
    const roleConfig = workerRoles[worker.role] || workerRoles.coder
    
    // Enhanced system prompt with file operations and terminal access
    const debugModePrompt = debugUntilWorks ? `

DEBUG MODE ENABLED - AUTONOMOUS ITERATION:
- You MUST test your code after writing it
- If tests fail or errors occur, you MUST fix them immediately
- Read error messages carefully and fix the root cause
- Continue iterating until everything works correctly
- Use executeCommand to test: npm start, node app.js, npm test, etc.
- Check command outputs for errors and fix them
- Do not stop until the task is fully working

SELF-REFLECTION & REASONING:
- After each attempt, think about what went wrong and why
- Analyze error messages, stack traces, and output carefully
- Consider alternative approaches if the current one isn't working
- Reflect on your previous attempts: "What did I try? What was the result? What should I try differently?"
- Talk through your reasoning process - explain your thinking
- Learn from each iteration and adapt your strategy` : ''
    
    const enhancedPrompt = `${roleConfig.systemPrompt}

You are part of a collaborative coding system. You have full access to:

FILE OPERATIONS:
- readFile('path'): Read a file's content
- writeFile('path', 'content'): Write or create a file
- createFile('path', 'content'): Create a new file  
- deleteFile('path'): Delete a file or directory (use carefully, can delete files that don't matter)
- listFiles('path?'): List files in a directory

TERMINAL ACCESS:
- executeCommand('command'): Execute shell commands (Windows CMD or Unix shell)
- You have FULL AUTONOMOUS access to the terminal. Use it freely to:
  * Install dependencies: npm install, pip install, etc.
  * Run applications: npm start, node app.js, python server.py, etc.
  * Test your code: npm test, node test.js, etc.
  * Build projects: npm run build, etc.
  * Check status: git status, ls, dir, etc.
- Commands execute in the project workspace directory
- IMPORTANT: Always test your code after writing it. Run the application and verify it works.
- If a command fails, read the error output and fix the issue immediately.
- For commands requiring permission (npm install, npm start, etc.), the system will request approval automatically.
- Continue working autonomously - create files, install packages, run servers, test everything until it works.

COLLABORATION:
- You can communicate with other workers to share code, debug together, or divide tasks
- When you create code, another worker (like a debugger or reviewer) can check it
- Share your findings and code through the worker communication system

WORKFLOW (FULL AUTONOMY):
1. Read existing files to understand the codebase
2. Write new code or modify existing files
3. Execute commands to test, build, or run your code
4. If errors occur, read them carefully and fix the issues
5. Test again to verify fixes work
6. Continue working autonomously - don't wait for approval unless explicitly blocked
7. If a command requires permission, continue with other tasks while waiting
8. Communicate with other workers to get feedback or help
9. Iterate based on feedback and test results
10. Keep working until the task is COMPLETE and FUNCTIONAL
${debugModePrompt}

AUTONOMOUS OPERATIONS:
- You are a fully autonomous coding agent
- Create all necessary files (package.json, server files, HTML, CSS, JS, etc.)
- Delete unnecessary files if needed (you can clean up files that don't matter)
- Install all required dependencies (npm install, pip install, etc.)
- Run and test your code (npm start, node app.js, etc.)
- Fix any errors you encounter
- Verify everything works end-to-end
- Don't stop until the application is fully functional

FILE MANAGEMENT:
- You can delete files that are not needed for the task
- If you create test files or temporary files, you can delete them when done
- Use deleteFile('path') to remove files that don't matter
- Be careful not to delete important project files

When writing code, use clear file paths and complete code blocks. The system will automatically execute file operations and commands you describe.`
    
    const contextStr = Object.keys(context).length > 0
      ? `\n\nContext from other workers:\n${JSON.stringify(context, null, 2)}`
      : ''
    
    const messages = [
      new SystemMessage(enhancedPrompt),
      new HumanMessage(`${task}${contextStr}`)
    ]

    // Add shared data if available
    if (Object.keys(worker.sharedData).length > 0) {
      messages.push(
        new SystemMessage(`Shared knowledge:\n${JSON.stringify(worker.sharedData, null, 2)}`)
      )
    }

    // Add activity log entry
    worker.activityLog.push({
      type: 'task_started',
      message: `Started task: ${task.substring(0, 100)}${task.length > 100 ? '...' : ''}`,
      timestamp: Date.now()
    })

    let iteration = 0
    let lastResult = ''
    let allOperations = []
    let hasErrors = false

    while (iteration < maxIterations) {
      iteration++
      
      // Add thinking/reasoning activity log before each iteration (except first)
      if (iteration > 1) {
        worker.activityLog.push({
          type: 'thinking',
          message: `Iteration ${iteration}: Analyzing previous attempt and planning next steps...`,
          details: { 
            iteration,
            previousErrors: hasErrors,
            totalOperations: allOperations.length
          },
          timestamp: Date.now()
        })
        worker.status = 'communicating' // Show thinking state
      }
      
      // Invoke LLM with current context - enhanced prompts for self-reflection
      const currentMessages = iteration === 1 
        ? messages 
        : [
            ...messages,
            new AIMessage(lastResult),
            new HumanMessage(hasErrors 
              ? `Iteration ${iteration} - Previous attempt had errors. 

SELF-REFLECTION REQUIRED:
1. What did you try in the previous attempt?
2. What was the specific error or issue?
3. Why do you think it failed?
4. What will you try differently this time?

Here's what happened:\n\n${JSON.stringify(allOperations.filter(op => !op.success || op.exitCode !== 0), null, 2)}\n\nThink through the problem, explain your reasoning, then fix the issues and test again.`
              : `Iteration ${iteration} - Testing phase.

SELF-REFLECTION:
1. What have you created so far?
2. What needs to be tested?
3. How will you verify it works?

Test the code to ensure it works. Run the application and verify everything functions correctly.`
            )
          ]

      const response = await worker.llm.invoke(currentMessages)
      const result = typeof response.content === 'string' 
        ? response.content 
        : String(response.content || '')
      
      lastResult = result

      // Log reasoning/self-communication if present in response
      if (result.includes('thinking') || result.includes('reasoning') || result.includes('reflection') || result.includes('I think') || result.includes('Let me')) {
        worker.activityLog.push({
          type: 'reasoning',
          message: `Self-reflection: ${result.substring(0, 200)}${result.length > 200 ? '...' : ''}`,
          details: { iteration },
          timestamp: Date.now()
        })
      }
      
      // Parse result for file operations
      const operations = await parseAndExecuteFileOperations(workerId, result)
      allOperations.push(...operations)
      
      // Set status back to working after thinking
      if (worker.status === 'communicating') {
        worker.status = 'working'
      }

      // Log operations to activity
      operations.forEach(op => {
        if (op.type === 'write') {
          worker.activityLog.push({
            type: 'file_created',
            message: `Created/updated file: ${op.path}`,
            details: { path: op.path, size: op.content?.length || 0 },
            timestamp: Date.now()
          })
        } else if (op.type === 'delete') {
          worker.activityLog.push({
            type: 'file_deleted',
            message: `Deleted file: ${op.path}`,
            details: { path: op.path },
            timestamp: Date.now()
          })
        } else if (op.type === 'execute') {
          worker.activityLog.push({
            type: 'command_executed',
            message: `Executed command: ${op.command}`,
            details: { command: op.command, output: op.output, exitCode: op.exitCode },
            timestamp: Date.now()
          })
        }
      })

      // Check for errors if debug mode is enabled
      if (debugUntilWorks) {
        hasErrors = false
        
        // Check for failed operations
        const failedOps = operations.filter(op => 
          (op.type === 'write' || op.type === 'delete') && op.success === false
        )
        
        // Check for failed commands (non-zero exit codes or errors)
        const failedCommands = operations.filter(op => 
          op.type === 'execute' && (op.exitCode !== 0 || op.success === false)
        )
        
        // Check if any command output contains error indicators
        const errorOutputs = operations.filter(op => 
          op.type === 'execute' && op.output && (
            op.output.toLowerCase().includes('error') ||
            op.output.toLowerCase().includes('failed') ||
            op.output.toLowerCase().includes('exception') ||
            op.output.toLowerCase().includes('cannot find') ||
            op.output.toLowerCase().includes('not found')
          )
        )

        if (failedOps.length > 0 || failedCommands.length > 0 || errorOutputs.length > 0) {
          hasErrors = true
          worker.activityLog.push({
            type: 'task_error',
            message: `Iteration ${iteration}: Errors detected, continuing to fix...`,
            details: { 
              failedOps: failedOps.length,
              failedCommands: failedCommands.length,
              errorOutputs: errorOutputs.length,
              iteration 
            },
            timestamp: Date.now()
          })
          
          // Continue to next iteration
          continue
        }
        
        // If no errors and we have executed commands, check if we should test
        const hasTestCommands = operations.some(op => 
          op.type === 'execute' && (
            op.command.includes('npm start') ||
            op.command.includes('node ') ||
            op.command.includes('npm test') ||
            op.command.includes('python ') ||
            op.command.includes('npm run')
          )
        )
        
        // If we have test commands and they succeeded, we're done
        if (hasTestCommands && !hasErrors) {
          worker.activityLog.push({
            type: 'task_completed',
            message: `Task completed successfully after ${iteration} iteration(s)`,
            timestamp: Date.now()
          })
          break
        }
        
        // If no test commands were run, ask worker to test
        if (!hasTestCommands && iteration < maxIterations) {
          hasErrors = true // Trigger another iteration to test
          continue
        }
      } else {
        // Not in debug mode, just complete after first iteration
        break
      }
    }

    if (debugUntilWorks && hasErrors && iteration >= maxIterations) {
      worker.activityLog.push({
        type: 'task_error',
        message: `Task completed with errors after ${maxIterations} iterations`,
        details: { iterations: iteration },
        timestamp: Date.now()
      })
    } else if (!debugUntilWorks || !hasErrors) {
      worker.activityLog.push({
        type: 'task_completed',
        message: `Completed task successfully${debugUntilWorks ? ` after ${iteration} iteration(s)` : ''}`,
        timestamp: Date.now()
      })
    }

    worker.tasks.push({
      task,
      result: lastResult,
      timestamp: Date.now(),
      iterations: iteration
    })

    worker.status = 'idle'

    // Broadcast update
    broadcastMetrics({
      activeWorkers: workers.size
    })

    return {
      workerId,
      result: lastResult,
      timestamp: Date.now(),
      iterations: iteration,
      operations: allOperations
    }
  } catch (error) {
    worker.status = 'error'
    worker.activityLog.push({
      type: 'task_error',
      message: `Task failed: ${error.message}`,
      details: { error: error.message },
      timestamp: Date.now()
    })
    console.error(`Worker ${workerId} task error:`, error)
    throw error
  }
}

// Parse LLM response for file operations and terminal commands, then execute them
// Returns array of operations performed
async function parseAndExecuteFileOperations(workerId, result) {
  // Enhanced pattern matching for file operations
  const writePattern = /(?:writeFile|createFile|saveFile)\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]((?:[^'"]|\\['"])*)['"]\s*\)/gs
  const deletePattern = /(?:deleteFile|removeFile)\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  const readPattern = /(?:readFile|loadFile)\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  const executePattern = /(?:executeCommand|runCommand|exec)\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  
  // Multi-line content support (code blocks)
  const codeBlockPattern = /```(?:[\w]+)?\n([\s\S]*?)```/g
  const filePathInCodeBlock = /(?:file|path|filename)[:\s]+['"]?([^\s'"]+\.[\w]+)['"]?/i

  let match
  const operations = []

  // Extract write/create operations with better content handling
  let writeMatch
  while ((writeMatch = writePattern.exec(result)) !== null) {
    let content = writeMatch[2]
    // Unescape quotes
    content = content.replace(/\\'/g, "'").replace(/\\"/g, '"')
    operations.push({
      type: 'write',
      path: writeMatch[1],
      content: content
    })
  }

  // Extract delete operations
  while ((match = deletePattern.exec(result)) !== null) {
    operations.push({
      type: 'delete',
      path: match[1]
    })
  }

  // Extract terminal commands
  while ((match = executePattern.exec(result)) !== null) {
    operations.push({
      type: 'execute',
      command: match[1]
    })
  }

  // Extract file paths from code blocks (common pattern: "Here's the code for file.js:")
  let codeBlockMatch
  while ((codeBlockMatch = codeBlockPattern.exec(result)) !== null) {
    const codeContent = codeBlockMatch[1]
    // Try to find file path near the code block
    const beforeBlock = result.substring(Math.max(0, codeBlockMatch.index - 200), codeBlockMatch.index)
    const pathMatch = beforeBlock.match(filePathInCodeBlock)
    if (pathMatch) {
      operations.push({
        type: 'write',
        path: pathMatch[1],
        content: codeContent
      })
    }
  }

  // Execute operations
  const executedOps = []
  for (const op of operations) {
    try {
      if (op.type === 'write') {
        const result = await fileService.workerWriteFile(op.path, op.content)
        if (result.success) {
          console.log(`[Worker ${workerId}] ✅ Created/updated file: ${op.path}`)
          executedOps.push({ ...op, success: true })
        } else {
          console.error(`[Worker ${workerId}] ❌ Failed to write ${op.path}:`, result.error)
          executedOps.push({ ...op, success: false, error: result.error })
        }
      } else if (op.type === 'delete') {
        const result = await fileService.workerDeleteFile(op.path)
        if (result.success) {
          console.log(`[Worker ${workerId}] ✅ Deleted: ${op.path}`)
          executedOps.push({ ...op, success: true })
          // Log deletion to activity (even if file didn't exist - that's fine)
          worker.activityLog.push({
            type: 'file_deleted',
            message: `Deleted: ${op.path}${result.message ? ` (${result.message})` : ''}`,
            details: { path: op.path },
            timestamp: Date.now()
          })
        } else {
          console.error(`[Worker ${workerId}] ❌ Failed to delete ${op.path}:`, result.error)
          executedOps.push({ ...op, success: false, error: result.error })
        }
      } else if (op.type === 'execute') {
        // Check if command requires permission
        const permissionCheck = permissionService.requiresPermission(op.command)
        
        if (permissionCheck.requires) {
          // Request permission
          const permission = permissionService.requestPermission(
            workerId,
            op.command,
            permissionCheck.type,
            permissionCheck.description
          )
          
          // Wait for permission (polling will be handled by frontend)
          executedOps.push({
            ...op,
            type: 'permission_required',
            permissionId: permission.id,
            permissionType: permissionCheck.type,
            description: permissionCheck.description,
            success: false,
            output: `Permission required: ${permissionCheck.description}. Waiting for approval...`
          })
          
          // Log permission request
          const worker = workers.get(workerId)
          if (worker) {
            worker.activityLog.push({
              type: 'permission_requested',
              message: `Permission requested: ${permissionCheck.description}`,
              details: { 
                command: op.command,
                permissionId: permission.id,
                type: permissionCheck.type
              },
              timestamp: Date.now()
            })
          }
          
          continue // Skip execution until permission is granted
        }
        
        // Execute terminal command
        try {
          const { spawn } = await import('child_process')
          const os = await import('os')
          const { getProjectRoot } = await import('../routes/files.js')
          
          const PROJECT_ROOT = getProjectRoot()
          const isWindows = os.platform() === 'win32'
          const shell = isWindows ? 'cmd.exe' : '/bin/bash'
          const shellFlag = isWindows ? '/c' : '-c'

          const commandResult = await new Promise((resolve, reject) => {
            let output = ''
            let errorOutput = ''

            const childProcess = spawn(shell, [shellFlag, op.command], {
              cwd: PROJECT_ROOT,
              env: { ...globalThis.process.env },
              shell: false
            })

            childProcess.stdout.on('data', (data) => {
              output += data.toString()
            })

            childProcess.stderr.on('data', (data) => {
              errorOutput += data.toString()
            })

            childProcess.on('close', async (code) => {
              const finalOutput = errorOutput || output
              const success = code === 0
              
              // Add to shared terminal history
              try {
                const { addCommand } = await import('./terminalService.js')
                const worker = workers.get(workerId)
                addCommand(
                  workerId,
                  worker?.name || worker?.model || 'Unknown',
                  op.command,
                  finalOutput,
                  code
                )
              } catch (err) {
                console.error('Failed to add command to terminal history:', err)
              }
              
              if (code === 0) {
                console.log(`[Worker ${workerId}] ✅ Command executed: ${op.command}`)
                if (output) console.log(`[Worker ${workerId}] Output: ${output.substring(0, 200)}`)
                resolve({ success: true, output: finalOutput, exitCode: code })
              } else {
                console.warn(`[Worker ${workerId}] ⚠️ Command exited with code ${code}: ${op.command}`)
                if (errorOutput) console.warn(`[Worker ${workerId}] Error: ${errorOutput.substring(0, 200)}`)
                resolve({ success: false, output: finalOutput, exitCode: code })
              }
            })

            childProcess.on('error', (err) => {
              console.error(`[Worker ${workerId}] ❌ Command error: ${err.message}`)
              reject(err)
            })

            setTimeout(() => {
              if (!childProcess.killed) {
                childProcess.kill('SIGTERM')
                resolve({ success: false, output: 'Command timeout', exitCode: -1 })
              }
            }, 30000)
          })

          executedOps.push({
            ...op,
            success: commandResult.success,
            output: commandResult.output,
            exitCode: commandResult.exitCode
          })
        } catch (err) {
          console.error(`[Worker ${workerId}] ❌ Command execution failed:`, err)
          executedOps.push({
            ...op,
            success: false,
            error: err.message
          })
        }
      }
    } catch (opError) {
      console.error(`[Worker ${workerId}] Error executing operation:`, opError)
      executedOps.push({
        ...op,
        success: false,
        error: opError.message
      })
    }
  }

  return executedOps
}

// Execute a command after permission is granted
export async function executeCommandWithPermission(workerId, command, permissionId) {
  try {
    const { spawn } = await import('child_process')
    const os = await import('os')
    const { getProjectRoot } = await import('../routes/files.js')
    
    const PROJECT_ROOT = getProjectRoot()
    const isWindows = os.platform() === 'win32'
    const shell = isWindows ? 'cmd.exe' : '/bin/bash'
    const shellFlag = isWindows ? '/c' : '-c'

    const commandResult = await new Promise((resolve, reject) => {
      let output = ''
      let errorOutput = ''

      const childProcess = spawn(shell, [shellFlag, command], {
        cwd: PROJECT_ROOT,
        env: { ...globalThis.process.env },
        shell: false
      })

      childProcess.stdout.on('data', (data) => {
        output += data.toString()
      })

      childProcess.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      childProcess.on('close', async (code) => {
        const finalOutput = errorOutput || output
        const success = code === 0
        
        // Add to shared terminal history
        try {
          const { addCommand } = await import('./terminalService.js')
          const worker = workers.get(workerId)
          addCommand(
            workerId,
            worker?.name || worker?.model || 'Unknown',
            command,
            finalOutput,
            code
          )
        } catch (err) {
          console.error('Failed to add command to terminal history:', err)
        }
        
        if (code === 0) {
          console.log(`[Worker ${workerId}] ✅ Command executed (with permission): ${command}`)
          if (output) console.log(`[Worker ${workerId}] Output: ${output.substring(0, 200)}`)
          resolve({ success: true, output: finalOutput, exitCode: code })
        } else {
          console.warn(`[Worker ${workerId}] ⚠️ Command exited with code ${code}: ${command}`)
          if (errorOutput) console.warn(`[Worker ${workerId}] Error: ${errorOutput.substring(0, 200)}`)
          resolve({ success: false, output: finalOutput, exitCode: code })
        }
      })

      childProcess.on('error', (err) => {
        console.error(`[Worker ${workerId}] ❌ Command error: ${err.message}`)
        reject(err)
      })

      setTimeout(() => {
        if (!childProcess.killed) {
          childProcess.kill('SIGTERM')
          resolve({ success: false, output: 'Command timeout', exitCode: -1 })
        }
      }, 30000)
    })

    // Clear permission after use
    permissionService.clearPermission(permissionId)

    // Log to worker activity
    const worker = workers.get(workerId)
    if (worker) {
      worker.activityLog.push({
        type: 'command_executed',
        message: `Executed command (permission granted): ${command}`,
        details: { command, output: commandResult.output, exitCode: commandResult.exitCode },
        timestamp: Date.now()
      })
    }

    return commandResult
  } catch (err) {
    console.error(`[Worker ${workerId}] ❌ Command execution failed:`, err)
    permissionService.clearPermission(permissionId)
    throw err
  }
}

// Get worker activity log
export function getWorkerActivity(workerId) {
  const worker = workers.get(workerId)
  if (!worker) {
    return null
  }
  
  // Return last 100 activities
  return {
    success: true,
    activity: worker.activityLog.slice(-100).reverse() // Most recent first
  }
}

// Send message between workers (inter-worker communication)
export async function sendMessage(fromWorkerId, toWorkerId, message, data = {}) {
  const fromWorker = workers.get(fromWorkerId)
  const toWorker = workers.get(toWorkerId)

  if (!fromWorker || !toWorker) {
    throw new Error('Worker not found')
  }

  try {
    // Mark workers as communicating
    fromWorker.status = 'communicating'
    toWorker.status = 'communicating'
    
    if (!fromWorker.communicatingWith.includes(toWorkerId)) {
      fromWorker.communicatingWith.push(toWorkerId)
    }
    if (!toWorker.communicatingWith.includes(fromWorkerId)) {
      toWorker.communicatingWith.push(fromWorkerId)
    }

    // Share data (code, findings, errors, etc.)
    if (Object.keys(data).length > 0) {
      toWorker.sharedData = { 
        ...toWorker.sharedData, 
        ...data,
        lastUpdate: Date.now(),
        fromWorker: fromWorkerId
      }
    }

    // Enhanced context for better collaboration
    const sharedContext = Object.keys(toWorker.sharedData).length > 0
      ? `\n\nShared context from other workers:\n${JSON.stringify(toWorker.sharedData, null, 2)}`
      : ''

    // Worker processes the message with full context
    const roleConfig = workerRoles[toWorker.role] || workerRoles.coder
    const messages = [
      new SystemMessage(`${roleConfig.systemPrompt}

You are collaborating with other workers. You can:
- Review code written by other workers
- Fix bugs they find
- Suggest improvements
- Share your findings
- Work together on complex tasks

${sharedContext}`),
      new HumanMessage(`Message from ${fromWorker.name} (${fromWorker.role}): ${message}

${data.code ? `\nCode shared:\n\`\`\`\n${data.code}\n\`\`\`` : ''}
${data.error ? `\nError reported:\n${data.error}` : ''}
${data.files ? `\nFiles mentioned: ${Array.isArray(data.files) ? data.files.join(', ') : data.files}` : ''}

How do you respond? What actions do you take?`)
    ]

    const response = await toWorker.llm.invoke(messages)
    const responseContent = typeof response.content === 'string'
      ? response.content
      : String(response.content || '')

    // Parse and execute file operations and commands from response
    await parseAndExecuteFileOperations(toWorkerId, responseContent)

    // Store communication history
    if (!fromWorker.communications) fromWorker.communications = []
    if (!toWorker.communications) toWorker.communications = []
    
    fromWorker.communications.push({
      to: toWorkerId,
      message,
      timestamp: Date.now()
    })
    
    toWorker.communications.push({
      from: fromWorkerId,
      message: responseContent,
      timestamp: Date.now()
    })

    // Reset communication status after a delay
    setTimeout(() => {
      fromWorker.status = 'idle'
      toWorker.status = 'idle'
      fromWorker.communicatingWith = fromWorker.communicatingWith.filter(id => id !== toWorkerId)
      toWorker.communicatingWith = toWorker.communicatingWith.filter(id => id !== fromWorkerId)
    }, 2000)

    return {
      from: fromWorkerId,
      to: toWorkerId,
      message,
      response: responseContent,
      sharedData: data
    }
  } catch (error) {
    fromWorker.status = 'error'
    toWorker.status = 'error'
    console.error('Worker communication error:', error)
    throw error
  }
}

// Get worker's shared data
export function getWorkerData(workerId) {
  const worker = workers.get(workerId)
  return worker ? worker.sharedData : null
}
