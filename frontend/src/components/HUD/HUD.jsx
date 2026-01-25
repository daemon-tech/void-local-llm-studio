import { useEffect, useState } from 'react'
import { useVoidStore } from '../../store/voidStore'
import CodeChat from '../CodeChat/CodeChat'
import LLMBar from '../LLMBar/LLMBar'
import OllamaStatus from '../OllamaStatus/OllamaStatus'
import Tabs from '../Tabs/Tabs'
import WorkspaceView from '../Workspace/WorkspaceView'
import SpaceView from '../Space/SpaceView'
import './HUD.css'

export default function HUD() {
  const { setConnected, initialize } = useVoidStore()
  const [activeTab, setActiveTab] = useState('workspace')

  useEffect(() => {
    let retryCount = 0
    const maxRetries = 3
    
    const check = async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        
        const r = await fetch('http://localhost:3000/api/health', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (r.ok) {
          const data = await r.json()
          console.log('[Backend] ✅ Connected:', data)
          setConnected(true)
          initialize()
          retryCount = 0 // Reset retry count on success
        } else {
          console.warn('[Backend] ⚠️ Health check returned status:', r.status)
          setConnected(false)
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.warn('[Backend] ❌ Connection timeout after 5s')
        } else {
          console.warn('[Backend] ❌ Connection failed:', error.message)
        }
        
        retryCount++
        if (retryCount <= maxRetries) {
          console.log(`[Backend] Retrying... (${retryCount}/${maxRetries})`)
        } else {
          console.warn('[Backend] Make sure the backend server is running: cd backend && npm run dev')
        }
        setConnected(false)
      }
    }
    
    // Check immediately
    check()
    // Then check every 5 seconds
    const t = setInterval(check, 5000)
    return () => clearInterval(t)
  }, [setConnected, initialize])

  const tabs = [
    { id: 'workspace', label: 'IDE' },
    { id: 'space', label: 'Space' },
    { id: 'chat', label: 'Chat' }
  ]

  return (
    <div className="hud">
      <OllamaStatus />
      <LLMBar />
      <main className="hud-main">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
          {activeTab === 'workspace' && <WorkspaceView />}
          {activeTab === 'space' && <SpaceView />}
          {activeTab === 'chat' && <CodeChat />}
        </Tabs>
      </main>
    </div>
  )
}
