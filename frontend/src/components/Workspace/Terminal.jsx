import { useState, useEffect, useRef } from 'react'
import { useVoidStore } from '../../store/voidStore'
import './Terminal.css'

export default function Terminal() {
  const { isConnected, projectRoot } = useVoidStore()
  const [history, setHistory] = useState([])
  const [currentInput, setCurrentInput] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [cwd, setCwd] = useState('')
  const [lastCommandTimestamp, setLastCommandTimestamp] = useState(0)
  const terminalRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (projectRoot) {
      setCwd(projectRoot)
      // Add welcome message
      setHistory([{
        type: 'output',
        content: `Terminal ready. Working directory: ${projectRoot}`,
        timestamp: Date.now()
      }])
    }
  }, [projectRoot])

  // Poll for worker commands from shared terminal
  useEffect(() => {
    if (!isConnected) return

    const pollWorkerCommands = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/terminal/history?since=${lastCommandTimestamp}`)
        const data = await response.json()
        
        if (data.success && data.commands && data.commands.length > 0) {
          const newCommands = data.commands.map(cmd => ({
            type: 'command',
            content: cmd.command,
            workerId: cmd.workerId,
            workerName: cmd.workerName,
            timestamp: cmd.timestamp,
            isWorker: true
          }))
          
          const newOutputs = data.commands.map(cmd => ({
            type: cmd.success ? 'output' : 'error',
            content: cmd.output || (cmd.success ? 'Command executed successfully' : 'Command failed'),
            workerId: cmd.workerId,
            workerName: cmd.workerName,
            timestamp: cmd.timestamp + 1, // Slightly after command
            exitCode: cmd.exitCode,
            isWorker: true
          }))
          
          setHistory(prev => {
            const existingIds = new Set(prev.map(h => h.timestamp))
            const filtered = [...newCommands, ...newOutputs].filter(c => !existingIds.has(c.timestamp))
            return [...prev, ...filtered].slice(-500) // Keep last 500 entries
          })
          
          // Update last timestamp
          const maxTimestamp = Math.max(...data.commands.map(c => c.timestamp))
          if (maxTimestamp > lastCommandTimestamp) {
            setLastCommandTimestamp(maxTimestamp)
          }
        }
      } catch (error) {
        console.error('Failed to poll worker commands:', error)
      }
    }

    pollWorkerCommands()
    const interval = setInterval(pollWorkerCommands, 1000) // Poll every second
    return () => clearInterval(interval)
  }, [isConnected, lastCommandTimestamp])

  // Auto-scroll to bottom with smooth animation
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTo({
        top: terminalRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [history])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const executeCommand = async (command) => {
    if (!command.trim() || isExecuting) return

    const trimmedCommand = command.trim()
    
    // Add command to history
    setHistory(prev => [...prev, {
      type: 'command',
      content: trimmedCommand,
      timestamp: Date.now()
    }])

    setIsExecuting(true)
    setCurrentInput('')

    try {
      const response = await fetch('http://localhost:3000/api/terminal/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: trimmedCommand })
      })

      const data = await response.json()

      // Add output to history
      setHistory(prev => [...prev, {
        type: data.success ? 'output' : 'error',
        content: data.output || data.error || 'No output',
        timestamp: Date.now(),
        exitCode: data.exitCode
      }])

      // Update CWD if command was cd (informational)
      if (trimmedCommand.startsWith('cd ')) {
        const newPath = trimmedCommand.substring(3).trim()
        if (newPath) {
          // Resolve relative paths
          const resolvedPath = newPath.startsWith('/') || newPath.match(/^[A-Z]:/)
            ? newPath
            : `${cwd}/${newPath}`
          setCwd(resolvedPath)
        }
      }
    } catch (error) {
      setHistory(prev => [...prev, {
        type: 'error',
        content: `Error: ${error.message}`,
        timestamp: Date.now()
      }])
    } finally {
      setIsExecuting(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      executeCommand(currentInput)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      // TODO: Command history navigation
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      // TODO: Command history navigation
    }
  }

  const clearTerminal = () => {
    setHistory([])
  }

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <div className="terminal-header-left">
          <span className="terminal-title">Terminal</span>
          {cwd && (
            <span className="terminal-cwd" title={cwd}>
              {cwd.split(/[/\\]/).pop() || cwd}
            </span>
          )}
        </div>
        <button
          className="terminal-clear-btn"
          onClick={clearTerminal}
          title="Clear terminal"
        >
          Clear
        </button>
      </div>
      
      <div className="terminal-output" ref={terminalRef}>
        {history.length === 0 ? (
          <div className="terminal-empty">
            <p>Terminal ready. Type a command to get started.</p>
            <p className="terminal-hint">Working directory: {cwd || 'Not set'}</p>
          </div>
        ) : (
          history.map((item, index) => (
            <div key={`${item.timestamp}-${index}`} className={`terminal-line ${item.type} ${item.isWorker ? 'worker-command' : ''}`}>
              {item.type === 'command' && (
                <span className="terminal-prompt">
                  {item.isWorker ? (
                    <>
                      <span className="terminal-prompt-worker" style={{ color: '#00AAFF' }}>
                        {item.workerName || 'worker'}
                      </span>
                      <span className="terminal-prompt-separator">@</span>
                      <span className="terminal-prompt-host">void</span>
                      <span className="terminal-prompt-path">:{cwd.split(/[/\\]/).pop() || '~'}$</span>
                    </>
                  ) : (
                    <>
                      <span className="terminal-prompt-user">user</span>
                      <span className="terminal-prompt-separator">@</span>
                      <span className="terminal-prompt-host">void</span>
                      <span className="terminal-prompt-path">:{cwd.split(/[/\\]/).pop() || '~'}$</span>
                    </>
                  )}
                </span>
              )}
              <span className="terminal-content">{item.content}</span>
              {item.exitCode !== undefined && item.exitCode !== 0 && (
                <span className="terminal-exit-code">[exit: {item.exitCode}]</span>
              )}
            </div>
          ))
        )}
        {isExecuting && (
          <div className="terminal-line executing">
            <span className="terminal-prompt">
              <span className="terminal-prompt-user">user</span>
              <span className="terminal-prompt-separator">@</span>
              <span className="terminal-prompt-host">void</span>
              <span className="terminal-prompt-path">:{cwd.split(/[/\\]/).pop() || '~'}$</span>
            </span>
            <span className="terminal-content executing-text">Executing...</span>
          </div>
        )}
      </div>

      <div className="terminal-input-container">
        <span className="terminal-prompt">
          <span className="terminal-prompt-user">user</span>
          <span className="terminal-prompt-separator">@</span>
          <span className="terminal-prompt-host">void</span>
          <span className="terminal-prompt-path">:{cwd.split(/[/\\]/).pop() || '~'}$</span>
        </span>
        <input
          ref={inputRef}
          className="terminal-input"
          type="text"
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isExecuting ? "Executing..." : "Enter command..."}
          disabled={isExecuting || !isConnected}
          autoFocus
        />
      </div>
    </div>
  )
}
