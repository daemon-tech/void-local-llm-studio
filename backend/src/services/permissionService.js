// Permission service for managing worker command permissions

const pendingPermissions = new Map() // Map<permissionId, permissionData>
const grantedPermissions = new Set() // Set<permissionId>

// Commands that require permission
const PERMISSION_REQUIRED_COMMANDS = [
  { pattern: /^npm\s+install/i, type: 'npm_install', description: 'Install npm packages' },
  { pattern: /^npm\s+ci/i, type: 'npm_install', description: 'Install npm packages (ci)' },
  { pattern: /^npm\s+start/i, type: 'npm_start', description: 'Start npm server' },
  { pattern: /^npm\s+run\s+start/i, type: 'npm_start', description: 'Start npm server' },
  { pattern: /^node\s+.*server/i, type: 'run_server', description: 'Run Node.js server' },
  { pattern: /^node\s+.*app\.js/i, type: 'run_server', description: 'Run Node.js application' },
  { pattern: /^python\s+-m\s+http\.server/i, type: 'run_server', description: 'Run Python HTTP server' },
  { pattern: /^python\s+.*server/i, type: 'run_server', description: 'Run Python server' },
  { pattern: /^pip\s+install/i, type: 'pip_install', description: 'Install Python packages' },
  { pattern: /^git\s+clone/i, type: 'git_clone', description: 'Clone git repository' },
  { pattern: /^git\s+push/i, type: 'git_push', description: 'Push to git repository' },
  { pattern: /^rm\s+-rf/i, type: 'delete_files', description: 'Delete files recursively' },
  { pattern: /^del\s+\/s/i, type: 'delete_files', description: 'Delete files recursively (Windows)' },
]

// Check if a command requires permission
export function requiresPermission(command) {
  for (const { pattern, type, description } of PERMISSION_REQUIRED_COMMANDS) {
    if (pattern.test(command.trim())) {
      return { requires: true, type, description, command }
    }
  }
  return { requires: false }
}

// Request permission for a command
export function requestPermission(workerId, command, type, description) {
  const permissionId = `perm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  const permission = {
    id: permissionId,
    workerId,
    command,
    type,
    description,
    timestamp: Date.now(),
    status: 'pending'
  }
  
  pendingPermissions.set(permissionId, permission)
  
  return permission
}

// Grant permission
export function grantPermission(permissionId) {
  const permission = pendingPermissions.get(permissionId)
  if (permission) {
    permission.status = 'granted'
    grantedPermissions.add(permissionId)
    return { success: true, permission }
  }
  return { success: false, error: 'Permission not found' }
}

// Deny permission
export function denyPermission(permissionId) {
  const permission = pendingPermissions.get(permissionId)
  if (permission) {
    permission.status = 'denied'
    pendingPermissions.delete(permissionId)
    return { success: true, permission }
  }
  return { success: false, error: 'Permission not found' }
}

// Check if permission is granted
export function isPermissionGranted(permissionId) {
  return grantedPermissions.has(permissionId)
}

// Get all pending permissions
export function getPendingPermissions() {
  return Array.from(pendingPermissions.values()).filter(p => p.status === 'pending')
}

// Get permission by ID
export function getPermission(permissionId) {
  return pendingPermissions.get(permissionId)
}

// Clear granted permission (after use)
export function clearPermission(permissionId) {
  grantedPermissions.delete(permissionId)
  pendingPermissions.delete(permissionId)
}
