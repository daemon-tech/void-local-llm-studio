import { useEffect, useRef, useState } from 'react'
import { useVoidStore } from '../../store/voidStore'
import './NeuralNetwork.css'

export default function NeuralNetwork({ mode = 'overlay' }) {
  const canvasRef = useRef(null)
  const animationFrameRef = useRef(null)
  const { workers, projectRoot } = useVoidStore()
  const [connections, setConnections] = useState([])
  const [nodes, setNodes] = useState([])
  const [activityPulses, setActivityPulses] = useState([])

  // Update nodes based on workers and projects
  useEffect(() => {
    const newNodes = []
    
    // Add brain hub node (center) - always present
    newNodes.push({
      id: 'brain',
      type: 'brain',
      x: 0,
      y: 0,
      label: 'VOID',
      active: true,
      pulsePhase: 0
    })
    
    // Add project node (if exists, positioned below brain with clear spacing)
    if (projectRoot) {
      const projectName = projectRoot.split(/[/\\]/).pop() || 'Project'
      newNodes.push({
        id: 'project',
        type: 'project',
        x: 0,
        y: -60, // More spacing from brain
        label: projectName.length > 12 ? projectName.substring(0, 10) + '..' : projectName,
        active: true
      })
    }

    // Add worker nodes (around brain hub with better spacing)
    const workerCount = workers.length
    const baseRadius = 200 // Increased radius for better spacing
    const minAngleStep = Math.PI / 6 // Minimum 30 degrees between nodes
    
    workers.forEach((worker, index) => {
      // Use golden angle distribution for better spacing
      const goldenAngle = Math.PI * (3 - Math.sqrt(5)) // Golden angle in radians
      const angle = index * goldenAngle
      // Scale radius based on worker count to prevent clustering
      const radius = baseRadius + (workerCount > 4 ? 50 : 0)
      
      newNodes.push({
        id: worker.id,
        type: 'worker',
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        label: worker.name || worker.model || `Worker-${worker.id.slice(-4)}`,
        status: worker.status,
        role: worker.role,
        angle: angle // Store angle for label positioning
      })
    })

    setNodes(newNodes)

    // Create connections
    const newConnections = []
    
    // Connect workers to brain hub
    workers.forEach(worker => {
      newConnections.push({
        from: worker.id,
        to: 'brain',
        active: worker.status === 'working',
        strength: worker.status === 'working' ? 1 : 0.3,
        type: 'worker-brain'
      })
    })
    
    // Connect project to brain if exists
    if (projectRoot) {
      newConnections.push({
        from: 'project',
        to: 'brain',
        active: true,
        strength: 0.8,
        type: 'project-brain'
      })
    }
    
    setConnections(newConnections)
  }, [workers, projectRoot])

  // Track activity for pulses - more responsive
  useEffect(() => {
    const newPulses = []
    const now = Date.now()
    
    workers.forEach(worker => {
      if (worker.activityLog && worker.activityLog.length > 0) {
        const latestActivity = worker.activityLog[worker.activityLog.length - 1]
        if (latestActivity) {
          // Check if this is a new activity (within last 500ms)
          const activityAge = now - latestActivity.timestamp
          if (activityAge < 500) {
            // Create pulse from worker to brain hub
            const pulse = {
              id: `pulse-${worker.id}-${latestActivity.timestamp}`,
              from: worker.id,
              to: 'brain',
              progress: 0,
              type: latestActivity.type || 'activity',
              timestamp: latestActivity.timestamp,
              color: latestActivity.type === 'task_error' 
                ? 'rgba(192, 0, 0, 0.8)'
                : latestActivity.type === 'file_created'
                ? 'rgba(0, 192, 0, 0.8)'
                : 'rgba(255, 255, 0, 0.8)'
            }
            newPulses.push(pulse)
          }
        }
      }
      
      // Also create pulses for active workers
      if (worker.status === 'working') {
        const pulseId = `active-${worker.id}`
        const existingPulse = activityPulses.find(p => p.id === pulseId)
        if (!existingPulse || now - existingPulse.timestamp > 1000) {
          newPulses.push({
            id: pulseId,
            from: worker.id,
            to: 'brain',
            progress: 0,
            type: 'active',
            timestamp: now,
            color: 'rgba(255, 255, 0, 0.6)'
          })
        }
      }
    })
    
    if (newPulses.length > 0) {
      setActivityPulses(prev => {
        // Remove old pulses and add new ones
        const filtered = prev.filter(p => now - p.timestamp < 2000)
        return [...filtered, ...newPulses]
      })
    }
  }, [workers])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio)
      
      const centerX = canvas.width / (2 * window.devicePixelRatio)
      const centerY = canvas.height / (2 * window.devicePixelRatio)

      // Draw connections
      connections.forEach(conn => {
        const fromNode = nodes.find(n => n.id === conn.from)
        const toNode = nodes.find(n => n.id === conn.to)
        
        if (!fromNode || !toNode) return

        const x1 = centerX + fromNode.x
        const y1 = centerY + fromNode.y
        const x2 = centerX + toNode.x
        const y2 = centerY + toNode.y

        // Base connection line
        ctx.strokeStyle = conn.active 
          ? `rgba(255, 255, 0, ${0.3 + conn.strength * 0.4})`
          : 'rgba(255, 255, 0, 0.1)'
        ctx.lineWidth = conn.active ? 2 : 1
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()

        // Glow effect for active connections
        if (conn.active) {
          ctx.shadowBlur = 15
          ctx.shadowColor = 'rgba(255, 255, 0, 0.5)'
          ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          ctx.shadowBlur = 0
        }
      })

      // Draw activity pulses
      activityPulses.forEach(pulse => {
        const fromNode = nodes.find(n => n.id === pulse.from)
        const toNode = nodes.find(n => n.id === pulse.to)
        
        if (!fromNode || !toNode) return

        const x1 = centerX + fromNode.x
        const y1 = centerY + fromNode.y
        const x2 = centerX + toNode.x
        const y2 = centerY + toNode.y

        const pulseX = x1 + (x2 - x1) * pulse.progress
        const pulseY = y1 + (y2 - y1) * pulse.progress

        // Pulse dot with color based on activity type
        const alpha = 1 - pulse.progress
        const pulseColor = pulse.color || 'rgba(255, 255, 0, 0.8)'
        ctx.fillStyle = pulseColor.replace('0.8', alpha.toString())
        ctx.beginPath()
        ctx.arc(pulseX, pulseY, 4 + pulse.progress * 8, 0, Math.PI * 2)
        ctx.fill()

        // Pulse glow
        ctx.shadowBlur = 20
        ctx.shadowColor = pulseColor
        ctx.fillStyle = pulseColor.replace('0.8', (alpha * 0.5).toString())
        ctx.beginPath()
        ctx.arc(pulseX, pulseY, 8 + pulse.progress * 12, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        
        // Trail effect
        if (pulse.progress > 0.1) {
          const trailLength = 0.2
          const trailStart = Math.max(0, pulse.progress - trailLength)
          const trailX1 = x1 + (x2 - x1) * trailStart
          const trailY1 = y1 + (y2 - y1) * trailStart
          const trailX2 = pulseX
          const trailY2 = pulseY
          
          ctx.strokeStyle = pulseColor.replace('0.8', (alpha * 0.3).toString())
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(trailX1, trailY1)
          ctx.lineTo(trailX2, trailY2)
          ctx.stroke()
        }
      })

      // Track label positions to prevent overlap (reset each frame)
      const labelPositions = []
      const labelPadding = 30 // Minimum distance between labels
      
      // Helper function to check if label position is clear
      const isLabelPositionClear = (labelX, labelY, textWidth, textHeight) => {
        for (const pos of labelPositions) {
          const dx = Math.abs(labelX - pos.x)
          const dy = Math.abs(labelY - pos.y)
          const minXDistance = (textWidth + pos.width) / 2 + labelPadding
          const minYDistance = textHeight + labelPadding
          
          if (dx < minXDistance && dy < minYDistance) {
            return false
          }
        }
        return true
      }
      
      // Draw nodes (draw brain and project first, then workers)
      const sortedNodes = [...nodes].sort((a, b) => {
        // Brain first, then project, then workers
        if (a.type === 'brain') return -1
        if (b.type === 'brain') return 1
        if (a.type === 'project') return -1
        if (b.type === 'project') return 1
        return 0
      })
      
      sortedNodes.forEach(node => {
        const x = centerX + node.x
        const y = centerY + node.y

        // Special rendering for brain hub
        if (node.type === 'brain') {
          // Pulsing brain hub
          const pulsePhase = (Date.now() / 1000) % (Math.PI * 2)
          const pulseSize = 25 + Math.sin(pulsePhase) * 5
          
          // Outer glow rings
          for (let i = 0; i < 3; i++) {
            const ringPhase = pulsePhase + (i * Math.PI * 0.5)
            const ringSize = pulseSize + i * 8
            const alpha = 0.3 - (i * 0.1)
            ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(x, y, ringSize, 0, Math.PI * 2)
            ctx.stroke()
          }
          
          // Main brain node
          ctx.shadowBlur = 30
          ctx.shadowColor = 'rgba(255, 255, 0, 0.8)'
          ctx.fillStyle = 'rgba(255, 255, 0, 0.6)'
          ctx.beginPath()
          ctx.arc(x, y, pulseSize, 0, Math.PI * 2)
          ctx.fill()
          
          // Brain border
          ctx.strokeStyle = 'rgba(255, 255, 0, 1)'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(x, y, pulseSize, 0, Math.PI * 2)
          ctx.stroke()
          
          // Inner core
          ctx.fillStyle = 'rgba(255, 255, 0, 0.9)'
          ctx.beginPath()
          ctx.arc(x, y, pulseSize * 0.6, 0, Math.PI * 2)
          ctx.fill()
          
          ctx.shadowBlur = 0
          
          // Brain label
          ctx.fillStyle = 'rgba(255, 255, 0, 1)'
          ctx.font = 'bold 12px monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(node.label, x, y)
        } else {
          // Regular nodes (workers, projects)
          // Node glow
          if (node.status === 'working' || node.active) {
            ctx.shadowBlur = 20
            ctx.shadowColor = 'rgba(255, 255, 0, 0.6)'
          }

          // Node circle
          const nodeSize = node.type === 'project' ? 18 : 10
          ctx.fillStyle = node.type === 'project' 
            ? 'rgba(255, 255, 0, 0.4)'
            : node.status === 'working'
            ? 'rgba(255, 255, 0, 0.8)'
            : 'rgba(255, 255, 0, 0.4)'
          
          ctx.beginPath()
          ctx.arc(x, y, nodeSize, 0, Math.PI * 2)
          ctx.fill()

          // Node border
          ctx.strokeStyle = node.type === 'project'
            ? 'rgba(255, 255, 0, 1)'
            : node.status === 'working'
            ? 'rgba(255, 255, 0, 1)'
            : 'rgba(255, 255, 0, 0.5)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(x, y, nodeSize, 0, Math.PI * 2)
          ctx.stroke()

          ctx.shadowBlur = 0

          // Node label with collision detection
          if (node.label) {
            // Create short label (max 8 chars)
            const shortLabel = node.label.length > 8 
              ? node.label.substring(0, 6) + '..' 
              : node.label
            
            ctx.font = '8px monospace'
            const textMetrics = ctx.measureText(shortLabel)
            const textWidth = textMetrics.width
            
            // Try different label positions to avoid overlap
            const labelOffsets = [
              { x: 0, y: nodeSize + 6, align: 'center', baseline: 'top' }, // Below
              { x: 0, y: -(nodeSize + 6), align: 'center', baseline: 'bottom' }, // Above
              { x: nodeSize + 6, y: 0, align: 'left', baseline: 'middle' }, // Right
              { x: -(nodeSize + 6), y: 0, align: 'right', baseline: 'middle' } // Left
            ]
            
            let labelDrawn = false
            const textHeight = 10
            
            for (const offset of labelOffsets) {
              const labelX = x + offset.x
              const labelY = y + offset.y
              
              // Calculate actual label bounds
              let finalX = labelX
              if (offset.align === 'left') {
                finalX = labelX
              } else if (offset.align === 'right') {
                finalX = labelX - textWidth
              } else {
                finalX = labelX - textWidth / 2
              }
              
              // Check collision
              if (isLabelPositionClear(finalX, labelY, textWidth, textHeight)) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
                ctx.textAlign = offset.align
                ctx.textBaseline = offset.baseline
                ctx.fillText(shortLabel, labelX, labelY)
                
                // Record label position for collision detection
                labelPositions.push({
                  x: finalX,
                  y: labelY,
                  width: textWidth,
                  height: textHeight
                })
                
                labelDrawn = true
                break
              }
            }
            
            // If all positions overlap, skip label or draw minimal indicator
            if (!labelDrawn && node.type !== 'worker') {
              // For important nodes (project), always show label but smaller
              ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
              ctx.font = '7px monospace'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              const tinyLabel = shortLabel.substring(0, 6)
              ctx.fillText(tinyLabel, x, y + nodeSize + 3)
            }
          }
        }
      })

      animationId = requestAnimationFrame(draw)
    }

    draw()

    // Update pulse progress
    const pulseInterval = setInterval(() => {
      setActivityPulses(prev => 
        prev.map(pulse => ({
          ...pulse,
          progress: Math.min(pulse.progress + 0.05, 1)
        })).filter(pulse => pulse.progress < 1)
      )
    }, 16)

    return () => {
      cancelAnimationFrame(animationId)
      clearInterval(pulseInterval)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [nodes, connections, activityPulses])

  if (mode === 'overlay') {
    return (
      <div className="neural-network-overlay">
        <canvas ref={canvasRef} className="neural-network-canvas" />
      </div>
    )
  }

  return (
    <div className="neural-network-container">
      <canvas ref={canvasRef} className="neural-network-canvas" />
    </div>
  )
}
