# How to Use Active Tasks (Agent Swarms)

## Quick Start

1. **Spawn a Swarm**
   - Click the **"Spawn Swarm"** button in the bottom control panel
   - Enter a project description (e.g., "Build a REST API with Express")
   - The swarm will start processing automatically

2. **View Active Swarms**
   - Check the **Agent Swarms** panel in the top-right corner of the HUD
   - It automatically updates every 3 seconds
   - Shows all active, completed, and error swarms

3. **View Swarm Details**
   - Click on any swarm in the Agent Swarms panel to expand it
   - See the full results including:
     - Architecture plan
     - Implementation code
     - Optimized version
     - Final tested code

## Understanding Swarm Status

- **running** (cyan) - Swarm is actively processing
- **completed** (green) - Swarm finished successfully
- **error** (pink) - Swarm encountered an error

## Swarm Workflow

Each swarm goes through 4 stages:

1. **Architect** - Analyzes and plans the project
2. **Builder** - Implements the code
3. **Optimizer** - Optimizes for performance
4. **Tester** - Tests and validates

Results from each stage are passed to the next, creating a complete solution.

## Viewing Results

### In the UI
- Click any swarm in the Agent Swarms panel
- Expand to see the final result
- Results are truncated to 500 characters in the panel
- Full results are available via API

### Via API
```bash
# Get all active swarms
GET http://localhost:3000/api/agents/active

# Get specific swarm result
GET http://localhost:3000/api/agents/{swarmId}
```

## Tips

- **Multiple Swarms**: You can spawn multiple swarms simultaneously
- **Long Projects**: Complex projects may take several minutes
- **Check Status**: The Agent Swarms panel auto-updates, so you can watch progress
- **View Details**: Click on completed swarms to see full results

## Example

1. Click "Spawn Swarm"
2. Enter: "Create a todo app with React and Node.js"
3. Watch the Agent Swarms panel - you'll see it go from "running" to "completed"
4. Click the swarm to see the full implementation code

The swarm will provide:
- Architecture plan
- Complete React frontend code
- Node.js backend code
- Optimized version
- Tested and validated final code
