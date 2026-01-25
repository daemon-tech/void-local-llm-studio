import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Project root (can be configured)
// Store current project root in memory (can be persisted later)
let currentProjectRoot = process.env.PROJECT_ROOT || path.join(__dirname, '../../workspace')

export function getProjectRoot() {
  return currentProjectRoot
}

export function setProjectRoot(newRoot) {
  currentProjectRoot = newRoot
}

// Get file content (must come before tree route)
router.get('/content/:filePath(*)', async (req, res) => {
  try {
    const PROJECT_ROOT = getProjectRoot()
    const filePath = req.params.filePath
    const fullPath = path.join(PROJECT_ROOT, filePath)
    
    // Security check
    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const content = await fs.readFile(fullPath, 'utf-8')
    res.json({ content })
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' })
    } else {
      res.status(500).json({ error: 'Failed to read file', message: error.message })
    }
  }
})

// Get current project root
router.get('/project', (req, res) => {
  res.json({ 
    projectRoot: getProjectRoot(),
    name: path.basename(getProjectRoot())
  })
})

// Set project root (open/select project)
router.post('/project', async (req, res) => {
  try {
    const { projectPath } = req.body
    
    if (!projectPath || typeof projectPath !== 'string') {
      return res.status(400).json({ error: 'projectPath is required' })
    }

    // Resolve the path
    const resolvedPath = path.resolve(projectPath)
    
    // Check if path exists and is a directory
    try {
      const stats = await fs.stat(resolvedPath)
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Path is not a directory' })
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Directory not found' })
      }
      throw error
    }

    // Set new project root
    setProjectRoot(resolvedPath)
    
    console.log(`[Files] Project root changed to: ${resolvedPath}`)
    
    res.json({ 
      success: true,
      projectRoot: resolvedPath,
      name: path.basename(resolvedPath)
    })
  } catch (error) {
    console.error('Set project error:', error)
    res.status(500).json({ error: 'Failed to set project', message: error.message })
  }
})

// Create new project with structure
router.post('/project/create', async (req, res) => {
  try {
    const { name, type, path: projectPath, description } = req.body
    
    if (!name || !projectPath) {
      return res.status(400).json({ error: 'Project name and path are required' })
    }

    const resolvedPath = path.resolve(projectPath)
    
    // Check if directory already exists
    try {
      const stats = await fs.stat(resolvedPath)
      if (stats.isDirectory()) {
        return res.status(400).json({ error: 'Directory already exists' })
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }

    // Create project directory
    await fs.mkdir(resolvedPath, { recursive: true })
    
    // Create basic project structure based on type
    const structures = {
      web: {
        files: {
          'index.html': '<!DOCTYPE html>\n<html>\n<head>\n  <title>' + name + '</title>\n</head>\n<body>\n  <h1>' + name + '</h1>\n</body>\n</html>',
          'style.css': 'body {\n  margin: 0;\n  font-family: sans-serif;\n}',
          'script.js': '// ' + name + '\nconsole.log("Hello, ' + name + '!");'
        }
      },
      node: {
        files: {
          'package.json': JSON.stringify({
            name: name.toLowerCase().replace(/\s+/g, '-'),
            version: '1.0.0',
            description: description || '',
            main: 'index.js',
            scripts: {
              start: 'node index.js',
              dev: 'node index.js'
            }
          }, null, 2),
          'index.js': `// ${name}\n${description ? `// ${description}\n` : ''}\nconsole.log('Hello, ${name}!');`,
          '.gitignore': 'node_modules/\n.env\n*.log\n'
        }
      },
      python: {
        files: {
          'main.py': `# ${name}\n${description ? f'# {description}\n' : ''}\nprint("Hello, ${name}!")\n`,
          'requirements.txt': '',
          '.gitignore': '__pycache__/\n*.pyc\n.env\n'
        }
      },
      react: {
        files: {
          'package.json': JSON.stringify({
            name: name.toLowerCase().replace(/\s+/g, '-'),
            version: '1.0.0',
            description: description || '',
            scripts: {
              dev: 'vite',
              build: 'vite build',
              preview: 'vite preview'
            },
            dependencies: {
              react: '^18.2.0',
              'react-dom': '^18.2.0'
            },
            devDependencies: {
              vite: '^5.0.0',
              '@vitejs/plugin-react': '^4.2.0'
            }
          }, null, 2),
          'vite.config.js': `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n`,
          'index.html': `<!DOCTYPE html>\n<html>\n  <head>\n    <title>${name}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>`,
          'src/main.jsx': `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)\n`,
          'src/App.jsx': `import { useState } from 'react'\n\nfunction App() {\n  return (\n    <div>\n      <h1>${name}</h1>\n      <p>${description || 'Welcome to your new React app!'}</p>\n    </div>\n  )\n}\n\nexport default App\n`,
          '.gitignore': 'node_modules/\n.env\n.DS_Store\ndist/\n'
        }
      },
      next: {
        files: {
          'package.json': JSON.stringify({
            name: name.toLowerCase().replace(/\s+/g, '-'),
            version: '1.0.0',
            description: description || '',
            scripts: {
              dev: 'next dev',
              build: 'next build',
              start: 'next start'
            },
            dependencies: {
              react: '^18.2.0',
              'react-dom': '^18.2.0',
              next: '^14.0.0'
            }
          }, null, 2),
          'next.config.js': '/** @type {import(\'next\').NextConfig} */\nconst nextConfig = {}\n\nmodule.exports = nextConfig\n',
          'pages/index.js': `export default function Home() {\n  return (\n    <div>\n      <h1>${name}</h1>\n      <p>${description || 'Welcome to your Next.js app!'}</p>\n    </div>\n  )\n}\n`,
          '.gitignore': 'node_modules/\n.env\n.next\nout/\n'
        }
      },
      api: {
        files: {
          'package.json': JSON.stringify({
            name: name.toLowerCase().replace(/\s+/g, '-'),
            version: '1.0.0',
            description: description || '',
            main: 'server.js',
            scripts: {
              start: 'node server.js',
              dev: 'nodemon server.js'
            },
            dependencies: {
              express: '^4.18.2',
              cors: '^2.8.5'
            }
          }, null, 2),
          'server.js': `const express = require('express')\nconst cors = require('cors')\n\nconst app = express()\nconst PORT = process.env.PORT || 3000\n\napp.use(cors())\napp.use(express.json())\n\napp.get('/api/health', (req, res) => {\n  res.json({ status: 'ok' })\n})\n\napp.listen(PORT, () => {\n  console.log(\`Server running on port \${PORT}\`)\n})\n`,
          '.gitignore': 'node_modules/\n.env\n*.log\n'
        }
      },
      library: {
        files: {
          'package.json': JSON.stringify({
            name: name.toLowerCase().replace(/\s+/g, '-'),
            version: '1.0.0',
            description: description || '',
            main: 'index.js',
            scripts: {
              test: 'echo "Error: no test specified" && exit 1'
            }
          }, null, 2),
          'index.js': `// ${name}\n${description ? `// ${description}\n` : ''}\nmodule.exports = {}\n`,
          'README.md': `# ${name}\n\n${description || 'A new library project'}\n\n## Installation\n\n\`\`\`bash\nnpm install\n\`\`\`\n`,
          '.gitignore': 'node_modules/\n*.log\n'
        }
      },
      custom: {
        files: {
          'README.md': `# ${name}\n\n${description || 'A new project'}\n`
        }
      }
    }

    const structure = structures[type] || structures.custom
    
    // Create files
    for (const [filePath, content] of Object.entries(structure.files)) {
      const fullFilePath = path.join(resolvedPath, filePath)
      const dir = path.dirname(fullFilePath)
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(fullFilePath, content, 'utf-8')
    }

    // Set as current project root
    setProjectRoot(resolvedPath)
    
    console.log(`[Files] Project created: ${resolvedPath}`)
    
    res.json({
      success: true,
      projectRoot: resolvedPath,
      name: path.basename(resolvedPath),
      type
    })
  } catch (error) {
    console.error('Create project error:', error)
    res.status(500).json({ error: 'Failed to create project', message: error.message })
  }
})

// Get file tree
router.get('/', async (req, res) => {
  try {
    const PROJECT_ROOT = getProjectRoot()
    // Ensure workspace exists
    await fs.mkdir(PROJECT_ROOT, { recursive: true })
    const files = await buildFileTree(PROJECT_ROOT, PROJECT_ROOT)
    res.json({ files, projectRoot: PROJECT_ROOT })
  } catch (error) {
    console.error('File tree error:', error)
    res.status(500).json({ error: 'Failed to read file tree', message: error.message })
  }
})

// Write file content
router.post('/:filePath(*)', async (req, res) => {
  try {
    const PROJECT_ROOT = getProjectRoot()
    const filePath = req.params.filePath
    const { content } = req.body
    const fullPath = path.join(PROJECT_ROOT, filePath)
    
    // Security check
    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    
    await fs.writeFile(fullPath, content || '', 'utf-8')
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to write file', message: error.message })
  }
})

// Create file/directory
router.put('/:filePath(*)', async (req, res) => {
  try {
    const PROJECT_ROOT = getProjectRoot()
    const filePath = req.params.filePath
    const { type = 'file', content = '' } = req.body
    const fullPath = path.join(PROJECT_ROOT, filePath)
    
    // Security check
    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (type === 'directory') {
      await fs.mkdir(fullPath, { recursive: true })
    } else {
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.writeFile(fullPath, content, 'utf-8')
    }
    
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to create', message: error.message })
  }
})

// Delete file/directory
router.delete('/:filePath(*)', async (req, res) => {
  try {
    const PROJECT_ROOT = getProjectRoot()
    const filePath = req.params.filePath
    const fullPath = path.join(PROJECT_ROOT, filePath)
    
    // Security check
    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const stats = await fs.stat(fullPath)
    if (stats.isDirectory()) {
      await fs.rmdir(fullPath, { recursive: true })
    } else {
      await fs.unlink(fullPath)
    }
    
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete', message: error.message })
  }
})

// Helper: Build file tree recursively
async function buildFileTree(dirPath, rootPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    // Skip hidden files and node_modules
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue
    }

    const fullPath = path.join(dirPath, entry.name)
    const relativePath = path.relative(rootPath, fullPath)

    if (entry.isDirectory()) {
      const children = await buildFileTree(fullPath, rootPath)
      files.push({
        name: entry.name,
        path: relativePath,
        type: 'directory',
        children
      })
    } else {
      files.push({
        name: entry.name,
        path: relativePath,
        type: 'file'
      })
    }
  }

  return files.sort((a, b) => {
    // Directories first
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
}

export default router
