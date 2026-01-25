import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { getProjectRoot } from '../routes/files.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Ensure workspace exists
async function ensureWorkspace() {
  try {
    const PROJECT_ROOT = getProjectRoot()
    await fs.mkdir(PROJECT_ROOT, { recursive: true })
  } catch (error) {
    console.error('Failed to create workspace:', error)
  }
}

// Worker file operations
export async function workerReadFile(filePath) {
  try {
    await ensureWorkspace()
    const PROJECT_ROOT = getProjectRoot()
    const fullPath = path.resolve(PROJECT_ROOT, filePath)
    const rootPath = path.resolve(PROJECT_ROOT)
    
    // Security check - ensure path is within project root
    if (!fullPath.startsWith(rootPath)) {
      throw new Error('Access denied: Path outside project root')
    }
    
    const stats = await fs.stat(fullPath)
    if (stats.isDirectory()) {
      return { success: false, error: 'Path is a directory, not a file' }
    }
    
    // Try to read as text first, fallback to binary if needed
    try {
      const content = await fs.readFile(fullPath, 'utf-8')
      return { success: true, content, encoding: 'utf-8' }
    } catch (readError) {
      // If UTF-8 fails, it might be binary - return base64
      const buffer = await fs.readFile(fullPath)
      return { 
        success: true, 
        content: buffer.toString('base64'), 
        encoding: 'base64',
        binary: true 
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: false, error: 'File not found' }
    }
    return { success: false, error: error.message }
  }
}

export async function workerWriteFile(filePath, content) {
  try {
    await ensureWorkspace()
    const PROJECT_ROOT = getProjectRoot()
    const fullPath = path.resolve(PROJECT_ROOT, filePath)
    const rootPath = path.resolve(PROJECT_ROOT)
    
    // Security check
    if (!fullPath.startsWith(rootPath)) {
      throw new Error('Access denied: Path outside project root')
    }
    
    // Ensure directory exists
    const dir = path.dirname(fullPath)
    await fs.mkdir(dir, { recursive: true })
    
    // Write file (handle both string and base64 content)
    let writeContent = content
    let encoding = 'utf-8'
    
    // Check if content is base64 encoded binary
    if (typeof content === 'string' && content.match(/^[A-Za-z0-9+/=]+$/) && content.length > 100) {
      // Might be base64, but we'll write as text by default
      // Workers should specify if they want binary
    }
    
    await fs.writeFile(fullPath, writeContent, encoding)
    return { success: true, path: filePath }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function workerCreateFile(filePath, content = '') {
  return workerWriteFile(filePath, content)
}

export async function workerDeleteFile(filePath) {
  try {
    const PROJECT_ROOT = getProjectRoot()
    const fullPath = path.resolve(PROJECT_ROOT, filePath)
    const rootPath = path.resolve(PROJECT_ROOT)
    
    if (!fullPath.startsWith(rootPath)) {
      throw new Error('Access denied')
    }
    
    try {
      const stats = await fs.stat(fullPath)
      if (stats.isDirectory()) {
        // Delete directory recursively
        await fs.rm(fullPath, { recursive: true, force: true })
      } else {
        // Delete file
        await fs.unlink(fullPath)
      }
      return { success: true }
    } catch (statError) {
      // If file doesn't exist, that's okay - just return success (idempotent)
      if (statError.code === 'ENOENT') {
        return { success: true, message: 'File already deleted or does not exist' }
      }
      throw statError
    }
  } catch (error) {
    // If file doesn't exist, that's okay - just return success (idempotent)
    if (error.code === 'ENOENT') {
      return { success: true, message: 'File already deleted or does not exist' }
    }
    return { success: false, error: error.message }
  }
}

export async function workerListFiles(dirPath = '') {
  try {
    const PROJECT_ROOT = getProjectRoot()
    const fullPath = path.join(PROJECT_ROOT, dirPath)
    if (!fullPath.startsWith(PROJECT_ROOT)) {
      throw new Error('Access denied')
    }
    const entries = await fs.readdir(fullPath, { withFileTypes: true })
    return {
      success: true,
      files: entries
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file',
          path: path.join(dirPath, e.name)
        }))
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
