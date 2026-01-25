import { useVoidStore } from '../../store/voidStore'
import './HUD.css'

export default function MetricsPanel() {
  const { cpuUsage, tokenUsage, activeTasks } = useVoidStore()

  return (
    <div className="panel">
      <div className="panel-title">System Metrics</div>
      
      <div className="metric-item">
        <span className="metric-label">CPU Usage</span>
        <span className="metric-value">{cpuUsage.toFixed(1)}%</span>
      </div>
      <div className="gauge">
        <div className="gauge-fill" style={{ width: `${cpuUsage}%` }} />
      </div>
      
      <div className="metric-item">
        <span className="metric-label">Token Usage</span>
        <span className="metric-value">{tokenUsage.toLocaleString()}</span>
      </div>
      <div className="gauge">
        <div className="gauge-fill" style={{ width: `${Math.min(tokenUsage / 1000, 100)}%` }} />
      </div>
      
      <div className="metric-item">
        <span className="metric-label">Active Tasks</span>
        <span className="metric-value">{activeTasks}</span>
      </div>
    </div>
  )
}
