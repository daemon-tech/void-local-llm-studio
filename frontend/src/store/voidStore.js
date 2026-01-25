import { create } from 'zustand'

export const useVoidStore = create((set, get) => ({
  // System state
  isInitialized: false,
  isConnected: false,
  ollamaOnline: false,
  
  // AI state
  activeAgents: [],
  agentCount: 0,
  activeSwarms: [],
  
  // Metrics
  cpuUsage: 0,
  tokenUsage: 0,
  activeTasks: 0,
  
  // Selected swarm for viewing
  selectedSwarm: null,
  swarmResults: {},
  
  // LLM Configuration – default Ollama qwen2.5-coder for coding
  llmConfig: {
    type: 'ollama',
    model: 'qwen2.5-coder',
    baseUrl: 'http://localhost:11434',
  },
  
  // Workers - LLM instances that can collaborate
  workers: [],
  selectedWorker: null,
  selectedWorkerPosition: null,
  workerChatHistory: {}, // { workerId: [messages] }
  
  // IDE state
  projectFiles: [],
  selectedFile: null,
  openFiles: [],
  projectRoot: null,
  projectName: null,
  ideFileTree: [], // File tree structure
  ideDirectoryHandle: null, // File System Access API handle (can't be serialized, but we store reference)
  
  // Code state
  codeHolograms: [],
  compileStatus: 'idle', // idle, compiling, success, error
  
  // Visual effects
  neonPulse: false,
  rainEnabled: true,
  
  // Actions
  initialize: () => set({ isInitialized: true }),
  setConnected: (connected) => set({ isConnected: connected }),
  setOllamaOnline: (online) => set({ ollamaOnline: online }),
  addAgent: (agent) => set((state) => ({
    activeAgents: [...state.activeAgents, agent],
    agentCount: state.agentCount + 1
  })),
  removeAgent: (id) => set((state) => ({
    activeAgents: state.activeAgents.filter(a => a.id !== id),
    agentCount: state.agentCount - 1
  })),
  updateMetrics: (metrics) => set({
    cpuUsage: metrics.cpuUsage ?? get().cpuUsage,
    tokenUsage: metrics.tokenUsage ?? get().tokenUsage,
    activeTasks: metrics.activeTasks ?? get().activeTasks
  }),
  setCompileStatus: (status) => set({ compileStatus: status }),
  addCodeHologram: (hologram) => set((state) => ({
    codeHolograms: [...state.codeHolograms, hologram]
  })),
  toggleRain: () => set((state) => ({ rainEnabled: !state.rainEnabled })),
  triggerNeonPulse: () => {
    set({ neonPulse: true })
    setTimeout(() => set({ neonPulse: false }), 500)
  },
  setActiveSwarms: (swarms) => set({ activeSwarms: swarms, activeTasks: swarms.length }),
  setSelectedSwarm: (swarmId) => set({ selectedSwarm: swarmId }),
  setSwarmResult: (swarmId, result) => set((state) => ({
    swarmResults: { ...state.swarmResults, [swarmId]: result }
  })),
  setLlmConfig: (config) => set({ llmConfig: config }),
  
  // Worker management
  setWorkers: (workers) => set({ workers }),
  addWorker: (worker) => set((state) => ({
    workers: [...state.workers, worker]
  })),
  updateWorker: (id, updates) => set((state) => ({
    workers: state.workers.map(w => w.id === id ? { ...w, ...updates } : w)
  })),
  removeWorker: (id) => set((state) => ({
    workers: state.workers.filter(w => w.id !== id)
  })),
  setSelectedWorker: (id) => set({ selectedWorker: id, selectedWorkerPosition: null }),
  setSelectedWorkerPosition: (position) => set({ selectedWorkerPosition: position }),
  addWorkerMessage: (workerId, message) => set((state) => ({
    workerChatHistory: {
      ...state.workerChatHistory,
      [workerId]: [...(state.workerChatHistory[workerId] || []), message]
    }
  })),
  clearWorkerMessages: (workerId) => set((state) => {
    const newHistory = { ...state.workerChatHistory }
    delete newHistory[workerId]
    return { workerChatHistory: newHistory }
  }),
  
  // IDE file management
  setProjectFiles: (files) => set({ projectFiles: files }),
  setSelectedFile: (path) => set({ selectedFile: path }),
  openFile: (path, name, content = '') => set((state) => {
    const existing = state.openFiles.find(f => f.path === path)
    if (existing) {
      return { selectedFile: path }
    }
    return {
      openFiles: [...state.openFiles, { path, name, content }],
      selectedFile: path
    }
  }),
  closeFile: (path) => set((state) => {
    const newFiles = state.openFiles.filter(f => f.path !== path)
    return {
      openFiles: newFiles,
      selectedFile: newFiles.length > 0 ? newFiles[0].path : null
    }
  }),
  updateFileContent: (path, content) => set((state) => ({
    openFiles: state.openFiles.map(f => 
      f.path === path ? { ...f, content } : f
    )
  })),
  setProjectRoot: (root, name) => set({ projectRoot: root, projectName: name }),
  setIdeFileTree: (tree) => set({ ideFileTree: tree }),
  setIdeDirectoryHandle: (handle) => set({ ideDirectoryHandle: handle }),
  setIdeOpenFiles: (files) => set({ openFiles: files }),
  setIdeActiveFile: (file) => set({ selectedFile: file }),
  clearIdeState: () => set({ 
    ideFileTree: [], 
    ideDirectoryHandle: null, 
    projectRoot: null, 
    projectName: null,
    openFiles: [],
    selectedFile: null
  })
}))
