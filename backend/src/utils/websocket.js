// WebSocket broadcast utility
let wssInstance = null

export function setWebSocketServer(wss) {
  wssInstance = wss
}

export function broadcastMetrics(metrics) {
  if (!wssInstance) return
  
  wssInstance.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify({ type: 'metrics', data: metrics }))
    }
  })
}

export function broadcastMessage(type, data) {
  if (!wssInstance) return
  
  wssInstance.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type, data }))
    }
  })
}
