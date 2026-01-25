import { useState, useEffect } from 'react'
import { useVoidStore } from '../../store/voidStore'
import FileTree from './FileTree'
import CodeEditor from './CodeEditor'
import AgentPanel from './AgentPanel'
import Terminal from './Terminal'
import './IDE.css'

export default function IDE() {
  const { 
    isConnected, 
    ideFileTree, 
    ideDirectoryHandle,
    projectRoot: storeProjectRoot,
    openFiles: storeOpenFiles,
    selectedFile: storeSelectedFile,
    setIdeFileTree,
    setIdeDirectoryHandle,
    setProjectRoot: setStoreProjectRoot,
    setIdeOpenFiles,
    setIdeActiveFile,
    clearIdeState
  } = useVoidStore()
  
  const [openFiles, setOpenFiles] = useState(storeOpenFiles || [])
  const [activeFile, setActiveFile] = useState(storeSelectedFile || null)
  const [fileTree, setFileTree] = useState(ideFileTree || [])
  const [projectRoot, setProjectRoot] = useState(storeProjectRoot || null)
  const [loading, setLoading] = useState(true)
  const [showAgentPanel, setShowAgentPanel] = useState(true)
  const [showFolderDialog, setShowFolderDialog] = useState(false)
  const [folderPath, setFolderPath] = useState('')
  const [directoryHandle, setDirectoryHandle] = useState(ideDirectoryHandle || null)
  const [activeView, setActiveView] = useState('editor') // 'editor' or 'terminal'
  
  // Restore state from store on mount
  useEffect(() => {
    if (ideFileTree.length > 0) {
      setFileTree(ideFileTree)
      setLoading(false)
    }
    if (storeProjectRoot) {
      setProjectRoot(storeProjectRoot)
    }
    if (ideDirectoryHandle) {
      setDirectoryHandle(ideDirectoryHandle)
    }
    if (storeOpenFiles && storeOpenFiles.length > 0) {
      setOpenFiles(storeOpenFiles)
    }
    if (storeSelectedFile) {
      setActiveFile(storeSelectedFile)
    }

    // Listen for project open events (from ProjectWizard)
    const handleOpenProject = (event) => {
      const { path } = event.detail
      if (path) {
        handleOpenFolderManual(path)
      }
    }

    window.addEventListener('openProject', handleOpenProject)
    return () => window.removeEventListener('openProject', handleOpenProject)
  }, []) // Only run on mount

  // Check if project is open (only if not already restored from store)
  useEffect(() => {
    if (!isConnected) return
    if (projectRoot || fileTree.length > 0) {
      // Already have project from store, skip backend check
      setLoading(false)
      return
    }
    
    const checkProject = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/files/project')
        if (response.ok) {
          const data = await response.json()
          if (data.projectRoot) {
            setProjectRoot(data.projectRoot)
            loadFileTree()
          } else {
            setShowFolderDialog(true)
          }
        }
      } catch (error) {
        console.error('Failed to check project:', error)
        setShowFolderDialog(true)
      } finally {
        setLoading(false)
      }
    }

    checkProject()
  }, [isConnected])

  // Build file tree from File System Access API handle
  const buildFileTreeFromHandle = async (handle, rootName = '') => {
    const files = []
    
    try {
      for await (const entry of handle.values()) {
        // Skip hidden files and node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue
        }

        if (entry.kind === 'directory') {
          const dirHandle = await handle.getDirectoryHandle(entry.name)
          const children = await buildFileTreeFromHandle(dirHandle, entry.name)
          files.push({
            name: entry.name,
            path: rootName ? `${rootName}/${entry.name}` : entry.name,
            type: 'directory',
            children
          })
        } else {
          files.push({
            name: entry.name,
            path: rootName ? `${rootName}/${entry.name}` : entry.name,
            type: 'file'
          })
        }
      }
    } catch (error) {
      console.error('Error reading directory:', error)
    }

    return files.sort((a, b) => {
      // Directories first
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  }

  // Load file tree
  const loadFileTree = async () => {
    // If we have a directory handle, use it
    if (directoryHandle) {
      try {
        setLoading(true)
        const files = await buildFileTreeFromHandle(directoryHandle)
        setFileTree(files)
        setProjectRoot(directoryHandle.name)
      } catch (error) {
        console.error('Failed to load file tree from handle:', error)
      } finally {
        setLoading(false)
      }
      return
    }

    // Otherwise, use backend
    try {
      const response = await fetch('http://localhost:3000/api/files')
      const data = await response.json()
      const files = data.files || []
      setFileTree(files)
      setIdeFileTree(files) // Store in Zustand
      const root = data.projectRoot || ''
      setProjectRoot(root)
      if (root) {
        setStoreProjectRoot(root, root.split(/[/\\]/).pop() || 'Workspace') // Store in Zustand
      }
    } catch (error) {
      console.error('Failed to load file tree:', error)
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh file tree (only if using backend, not File System Access API)
  useEffect(() => {
    if (!isConnected || !projectRoot || directoryHandle) return
    // Refresh every 3 seconds for live updates (only for backend-based file trees)
    const interval = setInterval(loadFileTree, 3000)
    return () => clearInterval(interval)
  }, [isConnected, projectRoot, directoryHandle])

  // Poll for file changes when workers are active
  useEffect(() => {
    if (!isConnected) return

    const pollFileChanges = async () => {
      // Check if any open files were modified externally
      for (const file of openFiles) {
        try {
          const response = await fetch(`http://localhost:3000/api/files/content/${encodeURIComponent(file.path)}`)
          if (response.ok) {
            const data = await response.json()
            // Only update if content changed and file wasn't modified locally
            if (data.content !== file.content && !file.modified) {
              setOpenFiles(prev => prev.map(f => 
                f.path === file.path ? { ...f, content: data.content } : f
              ))
            }
          }
        } catch (error) {
          // File might have been deleted
        }
      }
    }

    const interval = setInterval(pollFileChanges, 2000)
    return () => clearInterval(interval)
  }, [isConnected, openFiles])

  // Get file handle from path
  const getFileHandleFromPath = async (filePath) => {
    if (!directoryHandle) return null
    
    const parts = filePath.split('/').filter(p => p)
    let currentHandle = directoryHandle
    
    for (let i = 0; i < parts.length - 1; i++) {
      currentHandle = await currentHandle.getDirectoryHandle(parts[i])
    }
    
    return await currentHandle.getFileHandle(parts[parts.length - 1])
  }

  const openFile = async (filePath) => {
    // Check if file is already open
    const existing = openFiles.find(f => f.path === filePath)
    if (existing) {
      setActiveFile(filePath)
      return
    }

    try {
      let content = ''
      
      // If we have a directory handle, read from it
      if (directoryHandle) {
        try {
          const fileHandle = await getFileHandleFromPath(filePath)
          if (fileHandle) {
            const file = await fileHandle.getFile()
            content = await file.text()
          }
        } catch (error) {
          console.error('Failed to read file from handle:', error)
          throw error
        }
      } else {
        // Otherwise, use backend
        const response = await fetch(`http://localhost:3000/api/files/content/${encodeURIComponent(filePath)}`)
        if (!response.ok) throw new Error('Failed to load file')
        
        const data = await response.json()
        content = data.content || ''
      }
      
      const fileName = filePath.split('/').pop() || filePath
      
      const newFile = {
        path: filePath,
        name: fileName,
        content: content,
        modified: false
      }
      
      const newOpenFiles = [...openFiles, newFile]
      setOpenFiles(newOpenFiles)
      setIdeOpenFiles(newOpenFiles) // Store in Zustand
      setActiveFile(filePath)
      setIdeActiveFile(filePath) // Store in Zustand
    } catch (error) {
      console.error('Failed to open file:', error)
      alert(`Failed to open file: ${error.message}`)
    }
  }

  const closeFile = (filePath) => {
    const newFiles = openFiles.filter(f => f.path !== filePath)
    setOpenFiles(newFiles)
    setIdeOpenFiles(newFiles) // Store in Zustand
    
    const newActiveFile = activeFile === filePath 
      ? (newFiles.length > 0 ? newFiles[newFiles.length - 1].path : null)
      : activeFile
    setActiveFile(newActiveFile)
    setIdeActiveFile(newActiveFile) // Store in Zustand
  }

  const updateFileContent = (filePath, content) => {
    const updatedFiles = openFiles.map(f => 
      f.path === filePath ? { ...f, content, modified: true } : f
    )
    setOpenFiles(updatedFiles)
    setIdeOpenFiles(updatedFiles) // Store in Zustand
  }

  const saveFile = async (filePath) => {
    const file = openFiles.find(f => f.path === filePath)
    if (!file) return

    try {
      // If we have a directory handle, save through File System Access API
      if (directoryHandle) {
        try {
          const fileHandle = await getFileHandleFromPath(filePath)
          if (fileHandle) {
            const writable = await fileHandle.createWritable()
            await writable.write(file.content)
            await writable.close()
            
            setOpenFiles(openFiles.map(f => 
              f.path === filePath ? { ...f, modified: false } : f
            ))
            return
          }
        } catch (error) {
          console.error('Failed to save file via handle:', error)
          throw error
        }
      }

      // Otherwise, use backend
      const response = await fetch(`http://localhost:3000/api/files/${encodeURIComponent(filePath)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: file.content })
      })

      if (!response.ok) throw new Error('Failed to save file')
      
      const savedFiles = openFiles.map(f => 
        f.path === filePath ? { ...f, modified: false } : f
      )
      setOpenFiles(savedFiles)
      setIdeOpenFiles(savedFiles) // Store in Zustand
    } catch (error) {
      console.error('Failed to save file:', error)
      alert(`Failed to save file: ${error.message}`)
    }
  }

  const currentFile = openFiles.find(f => f.path === activeFile)

  const handleTaskSubmit = () => {
    // Refresh file tree after task completion
    loadFileTree()
  }

  const handleOpenFolder = async () => {
    try {
      // Try File System Access API first (Chrome/Edge - shows native folder picker)
      if ('showDirectoryPicker' in window) {
        try {
          const handle = await window.showDirectoryPicker()
          const folderName = handle.name
          
          console.log('Selected folder:', folderName)
          
          // Store the handle and build file tree immediately
          setDirectoryHandle(handle)
          setIdeDirectoryHandle(handle) // Store in Zustand
          setShowFolderDialog(false)
          setLoading(true)
          
          // Build file tree from the handle
          try {
            const files = await buildFileTreeFromHandle(handle)
            setFileTree(files)
            setIdeFileTree(files) // Store in Zustand
            setProjectRoot(folderName)
            setStoreProjectRoot(folderName, folderName) // Store in Zustand (root, name)
            console.log('File tree loaded:', files.length, 'items')
          } catch (error) {
            console.error('Failed to build file tree:', error)
            alert(`Failed to read folder: ${error.message}`)
            setShowFolderDialog(true)
            setFolderPath('')
          } finally {
            setLoading(false)
          }
          
          return
        } catch (error) {
          if (error.name === 'AbortError') {
            // User cancelled - do nothing
            return
          }
          console.error('Directory picker error:', error)
          // Fall through to fallback
        }
      }

      // Fallback: Use hidden file input with webkitdirectory
      const input = document.createElement('input')
      input.type = 'file'
      input.setAttribute('webkitdirectory', '')
      input.setAttribute('directory', '')
      input.style.display = 'none'
      
      input.onchange = async (e) => {
        const files = e.target.files
        if (!files || files.length === 0) {
          document.body.removeChild(input)
          return
        }

        const firstFile = files[0]
        console.log('File selected:', {
          name: firstFile.name,
          path: firstFile.path,
          webkitRelativePath: firstFile.webkitRelativePath
        })
        
        let folderPath = ''
        
        // Try to extract path - Chrome/Edge may provide file.path
        if (firstFile.path) {
          // Remove filename to get directory
          const lastSlash = Math.max(
            firstFile.path.lastIndexOf('/'),
            firstFile.path.lastIndexOf('\\')
          )
          if (lastSlash > 0) {
            folderPath = firstFile.path.substring(0, lastSlash)
            // Normalize path separators
            folderPath = folderPath.replace(/[/\\]$/, '')
            console.log('Extracted path from file.path:', folderPath)
          }
        }
        
        // If we got a path, try to use it
        if (folderPath) {
          try {
            console.log('Attempting to open folder:', folderPath)
            const response = await fetch('http://localhost:3000/api/files/project', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projectPath: folderPath })
            })

            if (!response.ok) {
              const errorData = await response.json()
              console.error('Backend error:', errorData)
              throw new Error(errorData.error || 'Failed to open folder')
            }

            const data = await response.json()
            console.log('Folder opened successfully:', data)
            setProjectRoot(data.projectRoot)
            setShowFolderDialog(false)
            loadFileTree()
          } catch (error) {
            console.error('Failed to open folder:', error)
            // Show dialog with the path pre-filled so user can correct it
            setShowFolderDialog(true)
            setFolderPath(folderPath)
          }
        } else {
          // No path available - show dialog for manual entry
          console.log('No path available, showing dialog')
          setShowFolderDialog(true)
          setFolderPath('')
        }
        
        document.body.removeChild(input)
      }

      input.oncancel = () => {
        console.log('Folder selection cancelled')
        document.body.removeChild(input)
      }

      document.body.appendChild(input)
      input.click()
    } catch (error) {
      console.error('Failed to open folder picker:', error)
      setShowFolderDialog(true)
    }
  }

  const handleOpenFolderManual = async (providedPath = null) => {
    const trimmedPath = (providedPath || folderPath).trim()
    if (!trimmedPath) {
      if (!providedPath) {
        alert('Please enter a folder path')
      }
      return
    }

    try {
      console.log('Opening folder:', trimmedPath)
      const response = await fetch('http://localhost:3000/api/files/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: trimmedPath })
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Backend error:', error)
        throw new Error(error.error || 'Failed to open folder')
      }

      const data = await response.json()
      console.log('Folder opened successfully:', data)
      setProjectRoot(data.projectRoot)
      setStoreProjectRoot(data.projectRoot, data.name) // Store in Zustand
      setShowFolderDialog(false)
      setFolderPath('')
      loadFileTree()
    } catch (error) {
      console.error('Failed to open folder:', error)
      if (!providedPath) {
        alert(`Failed to open folder: ${error.message}\n\nPlease check:\n- The path is correct\n- The folder exists\n- You have permission to access it`)
      }
    }
  }

  const handleCloseFolder = async () => {
    // Close current project (set to empty/default)
    setProjectRoot(null)
    setFileTree([])
    setOpenFiles([])
    setActiveFile(null)
    setDirectoryHandle(null)
    clearIdeState() // Clear from Zustand
    setShowFolderDialog(true)
  }

  return (
    <div className="ide-container">
      {/* Folder Selection Dialog - Fallback for manual entry */}
      {showFolderDialog && (
        <div className="ide-folder-dialog-overlay" onClick={() => setShowFolderDialog(false)}>
          <div className="ide-folder-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ide-folder-dialog-header">
              <h3>Open Folder</h3>
              <button 
                className="ide-folder-dialog-close"
                onClick={() => setShowFolderDialog(false)}
              >
                ×
              </button>
            </div>
            <div className="ide-folder-dialog-content">
              <p className="ide-folder-dialog-description">
                Please enter the full path to your project folder:
              </p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  className="ide-folder-dialog-input"
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="C:\\Users\\YourName\\Projects\\MyProject or /home/user/projects/myproject"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleOpenFolderManual()
                    } else if (e.key === 'Escape') {
                      setShowFolderDialog(false)
                    }
                  }}
                  style={{ flex: 1 }}
                  autoFocus
                />
                <button
                  className="ide-folder-dialog-browse"
                  onClick={handleOpenFolder}
                  type="button"
                >
                  Browse
                </button>
              </div>
              <div className="ide-folder-dialog-hint">
                Enter the absolute path to your project folder (e.g., C:\Users\YourName\Projects\MyProject)
                <br />
                <small style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                  Note: After selecting a folder, you may need to enter the path manually as browsers don't expose file system paths.
                </small>
              </div>
            </div>
            <div className="ide-folder-dialog-actions">
              <button
                className="ide-folder-dialog-cancel"
                onClick={() => setShowFolderDialog(false)}
              >
                Cancel
              </button>
              <button
                className="ide-folder-dialog-open"
                onClick={handleOpenFolderManual}
                disabled={!folderPath.trim()}
              >
                Open Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar - File Tree */}
      <div className="ide-sidebar">
        <div className="ide-sidebar-header">
          <div className="ide-sidebar-header-left">
            <h3>Explorer</h3>
            {projectRoot ? (
              <div className="ide-project-info">
                <span className="ide-project-name" title={projectRoot}>
                  {projectRoot.split(/[/\\]/).pop() || 'Workspace'}
                </span>
                <button
                  className="ide-project-close"
                  onClick={handleCloseFolder}
                  title="Close folder"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                className="ide-open-folder-btn"
                onClick={handleOpenFolder}
              >
                Open Folder
              </button>
            )}
          </div>
          {projectRoot && (
            <button
              className="ide-sidebar-refresh"
              onClick={loadFileTree}
              title="Refresh file tree"
            >
              ↻
            </button>
          )}
        </div>
        <div className="ide-sidebar-content">
          {!projectRoot ? (
            <div className="ide-no-folder">
              <div className="ide-no-folder-content">
                <p>No folder open</p>
                <button
                  className="ide-open-folder-btn-large"
                  onClick={handleOpenFolder}
                >
                  Open Folder
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="ide-loading">Loading files...</div>
          ) : (
            <FileTree 
              files={fileTree} 
              onFileClick={openFile}
              openFiles={openFiles.map(f => f.path)}
              onRefresh={loadFileTree}
            />
          )}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="ide-main">
        {/* View Switcher */}
        <div className="ide-view-switcher">
          <button
            className={`ide-view-btn ${activeView === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveView('editor')}
          >
            Editor
          </button>
          <button
            className={`ide-view-btn ${activeView === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveView('terminal')}
          >
            Terminal
          </button>
        </div>

        {/* File Tabs (only show in editor view) */}
        {activeView === 'editor' && openFiles.length > 0 && (
          <div className="ide-tabs">
            {openFiles.map((file) => (
              <div
                key={file.path}
                className={`ide-tab ${activeFile === file.path ? 'active' : ''}`}
                onClick={() => setActiveFile(file.path)}
              >
                <span className="ide-tab-name">{file.name}</span>
                {file.modified && <span className="ide-tab-dot">●</span>}
                <button
                  className="ide-tab-close"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeFile(file.path)
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Content Area */}
        <div className="ide-editor-area">
          {activeView === 'terminal' ? (
            <Terminal />
          ) : currentFile ? (
            <CodeEditor
              file={currentFile}
              onChange={(content) => updateFileContent(currentFile.path, content)}
              onSave={() => saveFile(currentFile.path)}
            />
          ) : (
            <div className="ide-empty">
              <div className="ide-empty-content">
                <h2>No file open</h2>
                <p>Select a file from the explorer to start editing</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agent Panel - Right Side */}
      {showAgentPanel && (
        <AgentPanel onTaskSubmit={handleTaskSubmit} />
      )}
    </div>
  )
}
