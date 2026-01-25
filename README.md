# Void - 3D Coding Workspace with LLM Workers

A minimal, clean 3D coding environment where multiple Ollama LLM instances work together as collaborative workers on complex coding projects.

## 🚀 Features

- **3D Workspace**: Clean office-like environment with worker entities
- **Multiple LLM Workers**: Spawn as many Ollama instances as you want, each with different roles
- **Inter-Worker Communication**: Workers can message each other and share data
- **Collaborative Projects**: Assign complex projects to multiple workers who collaborate
- **Configurable**: Each worker can use different models, roles, and configurations
- **Local-First**: Uses Ollama (default: qwen2.5-coder) - zero API costs

## 🛠️ Tech Stack

- **Frontend**: Vite + React + Three.js
- **Backend**: Node.js + Express
- **AI**: Ollama (qwen2.5-coder by default) + LangChain
- **3D**: Three.js + React Three Fiber

## 📦 Installation

```bash
# Install all dependencies
npm run install:all

# Install Ollama and pull qwen2.5-coder
ollama pull qwen2.5-coder
```

## 🎮 Usage

```bash
# Run both frontend and backend
npm run dev

# Frontend: http://localhost:5173
# Backend: http://localhost:3000
```

## 💼 Worker System

### Spawn Workers
- Click **"+ Spawn"** in the Workers panel
- Configure: name, model (e.g., `qwen2.5-coder`), Ollama URL, role
- Workers appear in the 3D space as glowing entities

### Worker Roles
- **coder**: Write and implement code
- **architect**: Design architecture and plan
- **reviewer**: Review and improve code
- **tester**: Write tests and validate
- **optimizer**: Optimize performance
- **researcher**: Research solutions

### Inter-Worker Collaboration
1. **Assign Tasks**: Select a worker → assign coding task
2. **Send Messages**: Workers can communicate and share data
3. **Collaborative Projects**: Use Project Manager to assign complex projects to multiple workers

### Visual Feedback
- **Purple glow**: Worker is working
- **Green glow**: Worker is communicating
- **Gray**: Worker is idle
- **Red**: Error state
- **Green lines**: Connection between communicating workers

## 🎨 3D Workspace

- Clean grid floor
- Workers positioned in a grid layout
- Click workers to select and control them
- Subtle glow effects for ambiance

## 📝 License

MIT
