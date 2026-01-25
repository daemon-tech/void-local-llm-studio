import { useState, useEffect } from 'react'
import { getFileIcon } from './FileIcons'
import './FileTree.css'

export default function FileTree({ files, onFileClick, openFiles = [], level = 0, onRefresh }) {
  const [expanded, setExpanded] = useState({})
  const [editing, setEditing] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [creating, setCreating] = useState(null)

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    
    const handleClick = () => setContextMenu(null)
    setTimeout(() => window.addEventListener('click', handleClick), 0)
    return () => window.removeEventListener('click', handleClick)
  }, [contextMenu])

  const toggleExpand = (path) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }))
  }


  const handleContextMenu = (e, file) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, file })
  }

  const createFile = async (parentPath, name, type = 'file') => {
    if (!name || !name.trim()) {
      setCreating(null)
      return
    }
    
    try {
      const cleanName = name.trim()
      const filePath = parentPath && parentPath !== 'root' 
        ? `${parentPath}/${cleanName}` 
        : cleanName
      
      const response = await fetch(`http://localhost:3000/api/files/${encodeURIComponent(filePath)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: type === 'directory' ? 'directory' : 'file', 
          content: type === 'file' ? '' : undefined 
        })
      })
      
      if (response.ok) {
        // Expand parent directory if it's a directory
        if (parentPath && parentPath !== 'root') {
          setExpanded(prev => ({ ...prev, [parentPath]: true }))
        }
        
        if (onRefresh) {
          // Small delay to ensure backend has processed
          setTimeout(() => onRefresh(), 200)
        }
        if (type === 'file') {
          // Small delay to ensure file is created before opening
          setTimeout(() => onFileClick(filePath), 300)
        }
      } else {
        const error = await response.json()
        alert(`Failed to create: ${error.error || error.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to create:', error)
      alert(`Failed to create: ${error.message}`)
    }
    setCreating(null)
  }

  const deleteFile = async (filePath) => {
    if (!confirm(`Delete ${filePath}?`)) return
    try {
      const response = await fetch(`http://localhost:3000/api/files/${encodeURIComponent(filePath)}`, {
        method: 'DELETE'
      })
      if (response.ok && onRefresh) {
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      alert(`Failed to delete: ${error.message}`)
    }
  }

  const renameFile = async (oldPath, newName) => {
    // For simplicity, we'll delete and recreate (backend would need rename endpoint)
    alert('Rename feature requires backend support. Use delete and create for now.')
    setEditing(null)
  }

  return (
    <>
      <div className="file-tree" style={{ paddingLeft: `${level * 16}px` }}>
        {files.map((file) => {
          const isExpanded = expanded[file.path]
          const isOpen = openFiles.includes(file.path)
          const isEditing = editing === file.path
          const isCreating = creating === file.path
          
          return (
            <div key={file.path} className="file-tree-item">
              <div
                className={`file-tree-node ${file.type === 'directory' ? 'directory' : 'file'} ${isOpen ? 'open' : ''}`}
                onClick={() => {
                  if (isEditing || isCreating) return
                  if (file.type === 'directory') {
                    toggleExpand(file.path)
                  } else {
                    onFileClick(file.path)
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, file)}
              >
                {file.type === 'directory' && (
                  <span className="file-tree-arrow">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d={isExpanded ? "M2 3L5 6L8 3" : "M3 2L6 5L3 8"}
                        stroke="var(--text-muted)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ 
                          transform: isExpanded ? 'none' : 'rotate(-90deg)',
                          transformOrigin: 'center',
                          transition: 'transform 0.2s ease'
                        }}
                      />
                    </svg>
                  </span>
                )}
                <span className="file-tree-icon">{getFileIcon(file, isExpanded)}</span>
                {isEditing ? (
                  <input
                    className="file-tree-rename-input"
                    defaultValue={file.name}
                    autoFocus
                    onBlur={() => setEditing(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        renameFile(file.path, e.target.value)
                      } else if (e.key === 'Escape') {
                        setEditing(null)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="file-tree-name">{file.name}</span>
                )}
              </div>
              
              {file.type === 'directory' && isExpanded && (
                <>
                  {file.children && (
                    <FileTree
                      files={file.children}
                      onFileClick={onFileClick}
                      openFiles={openFiles}
                      level={level + 1}
                      onRefresh={onRefresh}
                    />
                  )}
                  {isCreating && (
                    <div className="file-tree-create" style={{ paddingLeft: `${(level + 1) * 16}px` }}>
                      <input
                        className="file-tree-create-input"
                        placeholder="name.ext or folder/"
                        autoFocus
                        onBlur={(e) => {
                          // Only blur if not clicking on the input itself
                          if (e.relatedTarget?.className !== 'file-tree-create-input') {
                            setCreating(null)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value) {
                            const name = e.target.value
                            const type = name.endsWith('/') ? 'directory' : 'file'
                            createFile(file.path, name.replace('/', ''), type)
                          } else if (e.key === 'Escape') {
                            setCreating(null)
                          }
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
        {level === 0 && !creating && (
          <div className="file-tree-create-root">
            <button
              className="file-tree-create-btn"
              onClick={() => setCreating('root')}
              title="Create new file or folder"
            >
              + New
            </button>
          </div>
        )}
        {level === 0 && creating === 'root' && (
          <div className="file-tree-create" style={{ paddingLeft: '16px' }}>
            <input
              className="file-tree-create-input"
              placeholder="name.ext or folder/"
              autoFocus
              onBlur={(e) => {
                if (e.relatedTarget?.className !== 'file-tree-create-input') {
                  setCreating(null)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value) {
                  const name = e.target.value
                  const type = name.endsWith('/') ? 'directory' : 'file'
                  createFile('', name.replace('/', ''), type)
                } else if (e.key === 'Escape') {
                  setCreating(null)
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="file-tree-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          <button onClick={() => {
            if (contextMenu.file.type === 'directory') {
              setCreating(contextMenu.file.path)
            } else {
              const parentPath = contextMenu.file.path.split('/').slice(0, -1).join('/')
              setCreating(parentPath || 'root')
            }
            setContextMenu(null)
          }}>
            New File
          </button>
          {contextMenu.file.type === 'directory' && (
            <button onClick={() => {
              setCreating(contextMenu.file.path)
              setContextMenu(null)
            }}>
              New Folder
            </button>
          )}
          <button onClick={() => {
            setEditing(contextMenu.file.path)
            setContextMenu(null)
          }}>
            Rename
          </button>
          <button
            className="danger"
            onClick={() => {
              deleteFile(contextMenu.file.path)
              setContextMenu(null)
            }}
          >
            Delete
          </button>
        </div>
      )}
    </>
  )
}
