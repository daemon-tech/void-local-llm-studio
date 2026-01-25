// WebSocket client for real-time updates
let ws = null
let reconnectAttempts = 0
const maxReconnectAttempts = 5

export function connectWebSocket(onMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return ws
  }

  ws = new WebSocket('ws://localhost:3000')

  ws.onopen = () => {
    console.log('WebSocket connected')
    reconnectAttempts = 0
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (onMessage) {
        onMessage(data)
      }
    } catch (error) {
      console.error('WebSocket message parse error:', error)
    }
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
  }

  ws.onclose = () => {
    console.log('WebSocket disconnected')
    
    // Attempt to reconnect
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++
      setTimeout(() => {
        console.log(`Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`)
        connectWebSocket(onMessage)
      }, 3000 * reconnectAttempts)
    }
  }

  return ws
}

export function disconnectWebSocket() {
  if (ws) {
    ws.close()
    ws = null
  }
}
