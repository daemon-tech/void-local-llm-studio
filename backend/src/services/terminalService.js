// Shared terminal service - tracks all worker commands for unified terminal view

const commandHistory = []
const MAX_HISTORY = 1000

// Add a command to the shared terminal history
export function addCommand(workerId, workerName, command, output, exitCode, timestamp = Date.now()) {
  const entry = {
    id: `cmd-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
    workerId,
    workerName,
    command,
    output,
    exitCode,
    success: exitCode === 0,
    timestamp
  }
  
  commandHistory.push(entry)
  
  // Keep history size manageable
  if (commandHistory.length > MAX_HISTORY) {
    commandHistory.shift()
  }
  
  return entry
}

// Get command history
export function getCommandHistory(limit = 100) {
  return commandHistory.slice(-limit)
}

// Get recent commands
export function getRecentCommands(since = 0) {
  return commandHistory.filter(cmd => cmd.timestamp > since)
}

// Clear history
export function clearHistory() {
  commandHistory.length = 0
}
