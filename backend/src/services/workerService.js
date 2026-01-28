import { ChatOllama } from '@langchain/community/chat_models/ollama'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import { broadcastMetrics } from '../utils/websocket.js'
import * as fileService from './fileService.js'
import * as permissionService from './permissionService.js'
import axios from 'axios'

// Store active workers
const workers = new Map()

// Context Memory System - Tracks what workers know and have done
function createContextMemory(workerId) {
  return {
    taskHistory: [], // All tasks attempted
    operations: [], // All operations performed (files, commands)
    filesCreated: [], // Files created/modified
    filesDeleted: [], // Files deleted
    commandsRun: [], // Commands executed with results
    errors: [], // Errors encountered with analysis
    currentState: {
      projectFiles: [],
      dependencies: [],
      runningProcesses: []
    },
    learnings: [], // What was learned from errors
    lastUpdated: Date.now()
  }
}

// Error Analysis System - Provides guidance based on error patterns
function analyzeError(error, command, output) {
  const analysis = {
    errorType: 'unknown',
    severity: 'medium',
    guidance: [],
    suggestedFixes: [],
    context: { command, output }
  }

  const errorLower = (error || output || '').toLowerCase()
  
  // File not found errors
  if (errorLower.includes('cannot find') || errorLower.includes('not found') || errorLower.includes('enoent')) {
    analysis.errorType = 'file_not_found'
    analysis.severity = 'high'
    analysis.guidance = [
      'The system is trying to access a file that does not exist.',
      'Check if the file path is correct.',
      'Verify the file was created before trying to use it.',
      'List files in the directory to see what exists.'
    ]
    analysis.suggestedFixes = [
      'Use listFiles() to check what files exist in the directory',
      'Verify the file path is correct (check for typos, wrong directory)',
      'Create the file if it should exist but doesn\'t',
      'Check if you need to change directories first'
    ]
  }
  
  // Command not found errors
  else if (errorLower.includes('command not found') || errorLower.includes('is not recognized') || errorLower.includes('der befehl')) {
    analysis.errorType = 'command_not_found'
    analysis.severity = 'high'
    analysis.guidance = [
      'The command you tried to run does not exist or is not in PATH.',
      'This often means the tool needs to be installed first.',
      'On Windows, some commands have different names (dir vs ls).'
    ]
    analysis.suggestedFixes = [
      'Install the required tool: npm install, pip install, etc.',
      'Check if the command name is correct for your OS',
      'Use full path to the executable if needed',
      'Verify the tool is installed: which <command> or where <command>'
    ]
  }
  
  // Syntax errors
  else if (errorLower.includes('syntax error') || errorLower.includes('unexpected token') || errorLower.includes('parse error')) {
    analysis.errorType = 'syntax_error'
    analysis.severity = 'high'
    analysis.guidance = [
      'There is a syntax error in your code.',
      'Check the line number mentioned in the error.',
      'Look for missing brackets, quotes, or semicolons.'
    ]
    analysis.suggestedFixes = [
      'Read the file and check the syntax around the error line',
      'Look for missing closing brackets, quotes, or parentheses',
      'Check for typos in keywords or variable names',
      'Verify the file encoding is correct'
    ]
  }
  
  // Module/package not found OR file not found (Node.js error)
  else if (errorLower.includes('cannot find module') || errorLower.includes('module not found') || errorLower.includes('cannot resolve')) {
    // Check if it's actually a file path issue (common Node.js error)
    const filePathMatch = (error || output || '').match(/['"]([^'"]+\.(js|ts|json|mjs|cjs))['"]/i)
    if (filePathMatch) {
      analysis.errorType = 'file_not_found'
      analysis.severity = 'high'
      analysis.guidance = [
        `The system is trying to load a file that does not exist: ${filePathMatch[1]}`,
        'This is a "Cannot find module" error, but it usually means the file path is wrong or the file doesn\'t exist.',
        'Check if the file was created before trying to run it.',
        'Verify the file path is correct (check for typos, wrong directory, wrong extension).'
      ]
      analysis.suggestedFixes = [
        `Check if file exists: listFiles() to see what files are in the directory`,
        `Verify the file path: ${filePathMatch[1]} - check for typos or wrong directory`,
        `If the file should exist, create it first before running the command`,
        `Check if you need to change directories first (cd to the correct directory)`,
        `Verify the file extension matches (.js, .ts, .json, etc.)`
      ]
    } else {
      analysis.errorType = 'module_not_found'
      analysis.severity = 'high'
      analysis.guidance = [
        'A required module or package is missing.',
        'You need to install dependencies first.',
        'Check if package.json exists and has the dependency listed.'
      ]
      analysis.suggestedFixes = [
        'Run npm install or pip install to install dependencies',
        'Check if package.json or requirements.txt exists',
        'Add the missing dependency to package.json if needed',
        'Verify the import/require statement is correct'
      ]
    }
  }
  
  // Port already in use
  else if (errorLower.includes('port') && (errorLower.includes('already in use') || errorLower.includes('eaddrinuse'))) {
    analysis.errorType = 'port_in_use'
    analysis.severity = 'medium'
    analysis.guidance = [
      'The port you\'re trying to use is already occupied.',
      'Another process is running on that port.',
      'You can use a different port or stop the other process.'
    ]
    analysis.suggestedFixes = [
      'Use a different port number in your server configuration',
      'Stop any existing processes using that port',
      'Check what process is using the port: netstat or lsof'
    ]
  }
  
  // Permission errors
  else if (errorLower.includes('permission denied') || errorLower.includes('eacces') || errorLower.includes('access denied')) {
    analysis.errorType = 'permission_error'
    analysis.severity = 'high'
    analysis.guidance = [
      'You don\'t have permission to perform this action.',
      'The system may need approval for this command.',
      'Check if the file/directory permissions are correct.'
    ]
    analysis.suggestedFixes = [
      'Wait for permission approval if the system requests it',
      'Check file/directory permissions',
      'Try running with appropriate permissions if needed'
    ]
  }
  
  // Network/connection errors
  else if (errorLower.includes('connection') || errorLower.includes('network') || errorLower.includes('econnrefused')) {
    analysis.errorType = 'connection_error'
    analysis.severity = 'medium'
    analysis.guidance = [
      'A network connection failed.',
      'The server might not be running yet.',
      'Check if the service needs to be started first.'
    ]
    analysis.suggestedFixes = [
      'Start the server first before trying to connect',
      'Check if the URL/port is correct',
      'Verify the service is running: check process list'
    ]
  }

  return analysis
}

// Build context summary for worker
function buildContextSummary(worker, allOperations, iteration) {
  const context = worker.contextMemory || createContextMemory(worker.id)
  
  // Recent operations (last 10)
  const recentOps = allOperations.slice(-10)
  const filesCreated = recentOps.filter(op => op.type === 'write').map(op => op.path)
  const filesDeleted = recentOps.filter(op => op.type === 'delete').map(op => op.path)
  
  // Get ALL command outputs (FULL, not truncated) - this is critical for debugging
  const allCommands = allOperations.filter(op => op.type === 'execute')
  const recentCommands = recentOps.filter(op => op.type === 'execute')
  
  // Recent errors with FULL output (not truncated)
  const recentErrors = context.errors.slice(-5).map(err => ({
    type: err.analysis.errorType,
    guidance: err.analysis.guidance,
    suggestedFixes: err.analysis.suggestedFixes,
    command: err.command,
    output: err.output || '' // FULL output, not truncated
  }))
  
  // What was tried
  const triedBefore = iteration > 1 ? [
    `You are on iteration ${iteration}. Previous attempts:`,
    ...allOperations.slice(0, -recentOps.length).map((op, idx) => {
      if (op.type === 'write') return `  - Created file: ${op.path}`
      if (op.type === 'delete') return `  - Deleted file: ${op.path}`
      if (op.type === 'execute') return `  - Ran: ${op.command} (${op.exitCode === 0 ? 'success' : `failed: ${op.exitCode}`})`
      return null
    }).filter(Boolean)
  ] : []
  
  // Learnings from previous errors
  const learnings = context.learnings.slice(-3)
  
  let summary = `\n\n=== CONTEXT MEMORY - What You Know ===\n`
  summary += `Current Iteration: ${iteration}\n`
  summary += `Total Operations: ${allOperations.length}\n\n`
  
  if (filesCreated.length > 0) {
    summary += `Files Created/Modified:\n${filesCreated.map(f => `  - ${f}`).join('\n')}\n\n`
  }
  
  if (filesDeleted.length > 0) {
    summary += `Files Deleted:\n${filesDeleted.map(f => `  - ${f}`).join('\n')}\n\n`
  }
  
  // CRITICAL: TERMINAL OUTPUT SECTION - Full output for debugging
  if (recentCommands.length > 0) {
    summary += `=== TERMINAL OUTPUT (READ THIS CAREFULLY FOR DEBUGGING) ===\n`
    summary += `The terminal output below shows EXACTLY what happened when you ran commands.\n`
    summary += `READ THE FULL OUTPUT - it contains critical error messages and debugging information.\n\n`
    
    recentCommands.forEach((cmd, idx) => {
      summary += `\n--- Command ${idx + 1}: ${cmd.command} ---\n`
      summary += `Exit Code: ${cmd.exitCode || 0} ${cmd.exitCode === 0 ? '(SUCCESS)' : '(FAILED)'}\n`
      summary += `Output:\n${cmd.output || '(no output)'}\n`
      summary += `--- End Command ${idx + 1} ---\n\n`
    })
    
    // Show failed commands prominently
    const failedCommands = recentCommands.filter(c => c.exitCode !== 0 || !c.success)
    if (failedCommands.length > 0) {
      summary += `\n⚠️ FAILED COMMANDS (PRIORITY DEBUGGING):\n`
      failedCommands.forEach((cmd, idx) => {
        summary += `\nFailed Command ${idx + 1}: ${cmd.command}\n`
        summary += `Exit Code: ${cmd.exitCode}\n`
        summary += `FULL ERROR OUTPUT:\n${cmd.output || '(no output)'}\n`
        summary += `\nREAD THIS OUTPUT CAREFULLY - it tells you exactly what went wrong!\n`
      })
      summary += `\n`
    }
  }
  
  if (recentErrors.length > 0) {
    summary += `=== ERROR ANALYSIS & GUIDANCE ===\n`
    recentErrors.forEach((err, idx) => {
      summary += `\nError ${idx + 1} (${err.type}):\n`
      summary += `  Command: ${err.command}\n`
      summary += `  FULL TERMINAL OUTPUT:\n${err.output || '(no output)'}\n`
      summary += `  Error Type: ${err.type}\n`
      summary += `  Guidance: ${err.guidance.join(' ')}\n`
      summary += `  Suggested Fixes:\n${err.suggestedFixes.map(f => `    - ${f}`).join('\n')}\n`
    })
    summary += `\n`
  }
  
  if (triedBefore.length > 0) {
    summary += `What You've Tried Before:\n${triedBefore.join('\n')}\n\n`
  }
  
  if (learnings.length > 0) {
    summary += `Key Learnings:\n${learnings.map(l => `  - ${l}`).join('\n')}\n\n`
  }
  
  summary += `=== END CONTEXT ===\n`
  
  return summary
}

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
      contextMemory: createContextMemory(workerId), // Context memory system
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

  // Auto-retry is now DEFAULT - always enabled unless explicitly disabled
  const { debugUntilWorks = true, maxIterations = 15 } = options

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

FILE OPERATIONS (These are FUNCTIONS, NOT commands):
- readFile('path'): Read a file's content (FUNCTION - do NOT run as command)
- writeFile('path', 'content'): Write or create a file (FUNCTION - do NOT run as command)
- createFile('path', 'content'): Create a new file (FUNCTION - do NOT run as command)
- deleteFile('path'): Delete a file or directory (FUNCTION - do NOT run as command)
- listFiles('path?'): List files in a directory (FUNCTION - do NOT run as command)

CRITICAL: These are FUNCTION CALLS, not terminal commands. 
- NEVER write: executeCommand('listFiles()')
- NEVER write: executeCommand('readFile(...)')
- These functions are handled automatically by the system
- Only use executeCommand() for actual shell commands like 'npm install', 'ls', 'node server.js', etc.

TERMINAL ACCESS (These are COMMANDS):
- executeCommand('command'): Execute shell commands (Windows CMD or Unix shell)
  * CORRECT: executeCommand('npm install')
  * CORRECT: executeCommand('ls -la')
  * CORRECT: executeCommand('node server.js')
  * WRONG: executeCommand('listFiles()') - This is a function, not a command!
  * WRONG: executeCommand('readFile("file.txt")') - This is a function, not a command!
  
To list files, just call listFiles('path') directly - the system handles it automatically.
- You have FULL AUTONOMOUS access to the terminal. Use it freely to:
  * Install dependencies: npm install, pip install, etc.
  * Run applications: npm start, node app.js, python server.py, etc.
  * Test your code: npm test, node test.js, etc.
  * Build projects: npm run build, etc.
  * Check status: git status, ls, dir, etc.
- Commands execute in the project workspace directory

CRITICAL: READING TERMINAL OUTPUT FOR DEBUGGING:
- After EVERY command execution, you will receive the FULL terminal output in the context memory
- READ THE TERMINAL OUTPUT CAREFULLY - it contains critical error messages, stack traces, and debugging information
- The terminal output shows EXACTLY what happened: success messages, errors, file paths, line numbers, etc.
- If a command fails, the terminal output will tell you WHY it failed (file not found, syntax error, missing dependency, etc.)
- ALWAYS check the terminal output before proceeding - it's your primary source of debugging information
- The context memory includes a "TERMINAL OUTPUT" section with FULL output from recent commands
- Use this output to understand errors and fix them systematically

BEST PRACTICES:
- Before running a file (node script.js, python app.py), verify it exists using listFiles() or readFile()
- If you get "file not found" errors, check the file path and current directory
- If you get "module not found" errors, install dependencies first (npm install, pip install)
- Read error messages in terminal output - they tell you exactly what's wrong
- Test incrementally: create file → verify it exists → run it → check output → fix errors → repeat
- IMPORTANT: Always test your code after writing it. Run the application and verify it works.
- If a command fails, read the FULL error output in the context memory and fix the issue immediately.
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
    
    // Build initial context summary (even for first iteration)
    const initialContextSummary = buildContextSummary(worker, [], 0)
    
    const messages = [
      new SystemMessage(enhancedPrompt),
      new SystemMessage(`CONTEXT MEMORY:${initialContextSummary}`),
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

    // Initialize or get context memory
    if (!worker.contextMemory) {
      worker.contextMemory = createContextMemory(workerId)
    }
    
    // Add task to history
    worker.contextMemory.taskHistory.push({
      task,
      started: Date.now(),
      iteration: 0
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
      
      // Build context summary with full memory
      const contextSummary = buildContextSummary(worker, allOperations, iteration)
      
      // Build error guidance if there are errors - include FULL terminal output
      let errorGuidance = ''
      if (hasErrors && iteration > 1) {
        const failedOps = allOperations.filter(op => !op.success || op.exitCode !== 0)
        const failedCommands = failedOps.filter(op => op.type === 'execute' && op.exitCode !== 0)
        const errorAnalyses = failedCommands.map(op => ({
          analysis: analyzeError(null, op.command, op.output),
          command: op.command,
          output: op.output || '', // FULL output
          exitCode: op.exitCode
        }))
        
        if (errorAnalyses.length > 0) {
          errorGuidance = `\n\n=== CRITICAL: ERROR ANALYSIS & FULL TERMINAL OUTPUT ===\n`
          errorGuidance += `The commands below FAILED. Read the FULL terminal output to understand why.\n\n`
          errorAnalyses.forEach((item, idx) => {
            const { analysis, command, output, exitCode } = item
            errorGuidance += `\n--- ERROR ${idx + 1} (${analysis.errorType}) ---\n`
            errorGuidance += `Command: ${command}\n`
            errorGuidance += `Exit Code: ${exitCode}\n`
            errorGuidance += `\nFULL TERMINAL OUTPUT (READ THIS CAREFULLY):\n${output || '(no output)'}\n`
            errorGuidance += `\nWhat happened: ${analysis.guidance.join(' ')}\n`
            errorGuidance += `How to fix:\n${analysis.suggestedFixes.map(f => `  - ${f}`).join('\n')}\n`
            errorGuidance += `--- END ERROR ${idx + 1} ---\n\n`
          })
          errorGuidance += `\n=== END ERROR ANALYSIS ===\n`
          errorGuidance += `\nIMPORTANT: The terminal output above shows EXACTLY what went wrong.\n`
          errorGuidance += `Use this information to fix the issues. Check file paths, dependencies, syntax, etc.\n\n`
        }
      }
      
      // Invoke LLM with current context - enhanced prompts with full context memory
      const currentMessages = iteration === 1 
        ? [
            ...messages,
            new SystemMessage(`CONTEXT MEMORY:${contextSummary}`)
          ]
        : [
            ...messages,
            new SystemMessage(`CONTEXT MEMORY:${contextSummary}${errorGuidance}`),
            new AIMessage(lastResult),
            new HumanMessage(hasErrors 
              ? `Iteration ${iteration} - Previous attempt had errors. 

CRITICAL: READ THE TERMINAL OUTPUT IN THE CONTEXT MEMORY ABOVE!

SELF-REFLECTION REQUIRED:
1. Check the "TERMINAL OUTPUT" section in CONTEXT MEMORY - it shows the FULL output from failed commands
2. Read the FULL error messages in the terminal output - they tell you exactly what went wrong
3. Review the ERROR ANALYSIS above - it provides guidance based on the terminal output
4. What did you try in the previous attempt? (Check CONTEXT MEMORY)
5. What was the specific error in the terminal output? (Look at the "FAILED COMMANDS" section)
6. Why do you think it failed? (Read the FULL terminal output - it contains the answer)
7. What will you try differently this time? (Follow the suggested fixes and use the terminal output as your guide)

IMPORTANT DEBUGGING STEPS:
- The terminal output shows EXACTLY what happened (file paths, error messages, line numbers)
- If you see "Cannot find module" or "file not found", check if the file exists using listFiles()
- If you see syntax errors, read the file and check the line number mentioned in the error
- If you see missing dependencies, install them first (npm install, pip install, etc.)
- The terminal output is your PRIMARY source of debugging information - use it!

The context memory shows you what you've already done. The terminal output shows you what went wrong.
Think through the problem using this information, explain your reasoning, then fix the issues and test again.`
              : `Iteration ${iteration} - Testing phase.

SELF-REFLECTION:
1. What have you created so far? (Check CONTEXT MEMORY above)
2. What needs to be tested?
3. How will you verify it works?

IMPORTANT: Before running commands that reference files:
- Verify files exist using listFiles() or readFile()
- Check file paths are correct
- Ensure dependencies are installed

Review your context memory to see what files you created and commands you ran.
Check the TERMINAL OUTPUT section to see results from previous commands.
Test the code to ensure it works. Run the application and verify everything functions correctly.
After running commands, check the terminal output in the next iteration to see if there were any errors.`
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
      
      // Update context memory with new operations
      operations.forEach(op => {
        if (op.type === 'write') {
          worker.contextMemory.operations.push({
            type: 'write',
            path: op.path,
            timestamp: Date.now(),
            iteration
          })
          if (!worker.contextMemory.filesCreated.includes(op.path)) {
            worker.contextMemory.filesCreated.push(op.path)
          }
          worker.activityLog.push({
            type: 'file_created',
            message: `Created/updated file: ${op.path}`,
            details: { path: op.path, size: op.content?.length || 0 },
            timestamp: Date.now()
          })
        } else if (op.type === 'delete') {
          worker.contextMemory.operations.push({
            type: 'delete',
            path: op.path,
            timestamp: Date.now(),
            iteration
          })
          worker.contextMemory.filesDeleted.push(op.path)
          worker.contextMemory.filesCreated = worker.contextMemory.filesCreated.filter(f => f !== op.path)
          worker.activityLog.push({
            type: 'file_deleted',
            message: `Deleted file: ${op.path}`,
            details: { path: op.path },
            timestamp: Date.now()
          })
        } else if (op.type === 'execute') {
          worker.contextMemory.operations.push({
            type: 'execute',
            command: op.command,
            exitCode: op.exitCode,
            success: op.exitCode === 0,
            timestamp: Date.now(),
            iteration
          })
          worker.contextMemory.commandsRun.push({
            command: op.command,
            exitCode: op.exitCode,
            success: op.exitCode === 0,
            output: op.output,
            timestamp: Date.now()
          })
          
          // Analyze errors and add to context memory
          if (op.exitCode !== 0 || !op.success) {
            const errorAnalysis = analyzeError(null, op.command, op.output)
            worker.contextMemory.errors.push({
              command: op.command,
              output: op.output,
              exitCode: op.exitCode,
              analysis: errorAnalysis,
              timestamp: Date.now(),
              iteration
            })
            
            // Extract learning from error
            if (errorAnalysis.suggestedFixes.length > 0) {
              const learning = `${errorAnalysis.errorType}: ${errorAnalysis.suggestedFixes[0]}`
              if (!worker.contextMemory.learnings.includes(learning)) {
                worker.contextMemory.learnings.push(learning)
              }
            }
          }
          
          worker.activityLog.push({
            type: 'command_executed',
            message: `Executed command: ${op.command}`,
            details: { command: op.command, output: op.output, exitCode: op.exitCode },
            timestamp: Date.now()
          })
        }
      })
      
      worker.contextMemory.lastUpdated = Date.now()
      
      // Set status back to working after thinking
      if (worker.status === 'communicating') {
        worker.status = 'working'
      }

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
          
          // Analyze all errors and add to context memory
          failedCommands.forEach(cmd => {
            const errorAnalysis = analyzeError(null, cmd.command, cmd.output)
            if (!worker.contextMemory.errors.find(e => e.command === cmd.command && e.iteration === iteration)) {
              worker.contextMemory.errors.push({
                command: cmd.command,
                output: cmd.output,
                exitCode: cmd.exitCode,
                analysis: errorAnalysis,
                timestamp: Date.now(),
                iteration
              })
              
              // Extract learning
              if (errorAnalysis.suggestedFixes.length > 0) {
                const learning = `${errorAnalysis.errorType}: ${errorAnalysis.suggestedFixes[0]}`
                if (!worker.contextMemory.learnings.includes(learning)) {
                  worker.contextMemory.learnings.push(learning)
                }
              }
            }
          })
          
          errorOutputs.forEach(cmd => {
            const errorAnalysis = analyzeError(null, cmd.command, cmd.output)
            if (!worker.contextMemory.errors.find(e => e.command === cmd.command && e.iteration === iteration)) {
              worker.contextMemory.errors.push({
                command: cmd.command,
                output: cmd.output,
                exitCode: cmd.exitCode || -1,
                analysis: errorAnalysis,
                timestamp: Date.now(),
                iteration
              })
            }
          })
          
          worker.activityLog.push({
            type: 'task_error',
            message: `Iteration ${iteration}: Errors detected, continuing to fix...`,
            details: { 
              failedOps: failedOps.length,
              failedCommands: failedCommands.length,
              errorOutputs: errorOutputs.length,
              iteration,
              errorTypes: [...new Set(worker.contextMemory.errors.slice(-5).map(e => e.analysis.errorType))]
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
        // Auto-retry is default, so always check for errors
        // Check if we have any failed operations
        const hasFailedOps = allOperations.some(op => 
          (op.type === 'write' || op.type === 'delete') && op.success === false
        )
        const hasFailedCommands = allOperations.some(op => 
          op.type === 'execute' && (op.exitCode !== 0 || op.success === false)
        )
        
        if (hasFailedOps || hasFailedCommands) {
          hasErrors = true
          // Continue to next iteration to fix errors
          continue
        } else {
          // No errors, task completed
          break
        }
      }
    }

    if (hasErrors && iteration >= maxIterations) {
      worker.activityLog.push({
        type: 'task_error',
        message: `Task completed with errors after ${maxIterations} iterations. Consider enabling enhanced debug mode.`,
        details: { 
          iterations: iteration,
          failedOps: allOperations.filter(op => !op.success).length,
          suggestion: 'Task had errors. The system will automatically retry, but you may want to review the errors.'
        },
        timestamp: Date.now()
      })
    } else if (!hasErrors) {
      worker.activityLog.push({
        type: 'task_completed',
        message: `Completed task successfully after ${iteration} iteration(s)`,
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
      operations: allOperations,
      contextMemory: worker.contextMemory // Return context memory for debugging/analysis
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

  // Extract terminal commands - only from executeCommand() calls
  while ((match = executePattern.exec(result)) !== null) {
    const command = match[1].trim()
    // Filter out function names that aren't actual commands
    if (command && 
        !command.match(/^(listFiles|readFile|writeFile|createFile|deleteFile|removeFile)\s*\(/i) &&
        command.length > 0) {
      operations.push({
        type: 'execute',
        command: command
      })
    }
  }
  
  // Also look for standalone commands that might be mentioned (but not function calls)
  // Pattern: "I'll run: npm install" or "Command: ls -la"
  const standaloneCommandPattern = /(?:run|execute|command|run this):\s*['"]?([^\n'"]+)['"]?/gi
  let standaloneMatch
  while ((standaloneMatch = standaloneCommandPattern.exec(result)) !== null) {
    const command = standaloneMatch[1].trim()
    // Only add if it looks like a real command (not a function call)
    if (command && 
        !command.match(/^(listFiles|readFile|writeFile|createFile|deleteFile|removeFile)\s*\(/i) &&
        !command.includes('(') && // Not a function call
        command.length > 0) {
      operations.push({
        type: 'execute',
        command: command
      })
    }
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
        // Pre-flight check: Verify files exist before running commands that reference them
        // This helps prevent "file not found" errors
        const fileReferencePattern = /(?:node|python|python3|npm|npx|ts-node|deno|bun)\s+['"]?([^\s'"]+\.(js|ts|py|mjs|cjs|json))['"]?/i
        const fileMatch = op.command.match(fileReferencePattern)
        if (fileMatch) {
          const referencedFile = fileMatch[1]
          try {
            const { workerReadFile } = await import('./fileService.js')
            const fileCheck = await workerReadFile(referencedFile)
            if (!fileCheck.success) {
              console.warn(`[Worker ${workerId}] ⚠️ Warning: File ${referencedFile} does not exist before running command: ${op.command}`)
              // Add a note to the operation that file doesn't exist
              executedOps.push({
                ...op,
                type: 'execute',
                success: false,
                output: `Error: Cannot find file '${referencedFile}'. The file does not exist.\n\nCommand: ${op.command}\n\nPlease create the file first or check the file path.`,
                exitCode: -1,
                preflightCheck: { fileExists: false, filePath: referencedFile }
              })
              continue // Skip execution since file doesn't exist
            }
          } catch (checkError) {
            // If check fails, proceed anyway (might be a different kind of command)
            console.warn(`[Worker ${workerId}] File existence check failed:`, checkError.message)
          }
        }
        
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
