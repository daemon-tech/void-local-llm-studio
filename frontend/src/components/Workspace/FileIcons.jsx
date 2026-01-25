// ENDFIELD-style file icons using SVG
export const FileIcons = {
  directory: (isExpanded) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d={isExpanded 
          ? "M2 3L7 3L9 5L14 5V13H2V3Z" 
          : "M2 3L7 3L9 5L14 5V13H2V3Z"
        }
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {isExpanded && (
        <line x1="5" y1="7" x2="11" y2="7" stroke="var(--accent)" strokeWidth="1" />
      )}
    </svg>
  ),
  
  file: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 2H12V14H4V2Z"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="6" y1="5" x2="10" y2="5" stroke="var(--text-muted)" strokeWidth="1" />
      <line x1="6" y1="8" x2="10" y2="8" stroke="var(--text-muted)" strokeWidth="1" />
      <line x1="6" y1="11" x2="9" y2="11" stroke="var(--text-muted)" strokeWidth="1" />
    </svg>
  ),
  
  js: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="10" height="12" rx="1" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <path d="M6 6L8 8L6 10" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 6L10 10" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  
  jsx: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="10" height="12" rx="1" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <path d="M6 6L8 8L6 10M10 6L10 10" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="8" r="1" fill="var(--accent)" />
    </svg>
  ),
  
  ts: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="10" height="12" rx="1" fill="none" stroke="var(--status-blue)" strokeWidth="1.5" />
      <path d="M6 6L8 8L6 10" stroke="var(--status-blue)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 6L10 10M10 8L12 8" stroke="var(--status-blue)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  
  json: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="10" height="12" rx="1" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <path d="M6 6L6 10M10 6L10 10" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="6" r="0.5" fill="var(--accent)" />
      <circle cx="8" cy="10" r="0.5" fill="var(--accent)" />
    </svg>
  ),
  
  css: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="10" height="12" rx="1" fill="none" stroke="var(--status-blue)" strokeWidth="1.5" />
      <path d="M6 6L8 8L6 10" stroke="var(--status-blue)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 6L12 8L10 10" stroke="var(--status-blue)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  
  html: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="10" height="12" rx="1" fill="none" stroke="var(--status-orange)" strokeWidth="1.5" />
      <path d="M6 6L8 8L6 10M10 6L8 8L10 10" stroke="var(--status-orange)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  
  md: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="10" height="12" rx="1" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" />
      <line x1="6" y1="6" x2="10" y2="6" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6" y1="8" x2="10" y2="8" stroke="var(--text-muted)" strokeWidth="1" strokeLinecap="round" />
      <line x1="6" y1="10" x2="8" y2="10" stroke="var(--text-muted)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  ),
  
  py: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="10" height="12" rx="1" fill="none" stroke="var(--status-blue)" strokeWidth="1.5" />
      <circle cx="7" cy="6" r="1" fill="var(--status-blue)" />
      <circle cx="9" cy="10" r="1" fill="var(--status-blue)" />
      <path d="M7 7L9 9" stroke="var(--status-blue)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  ),
  
  default: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="10" height="12" rx="1" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" />
      <line x1="6" y1="6" x2="10" y2="6" stroke="var(--text-muted)" strokeWidth="1" />
      <line x1="6" y1="8" x2="10" y2="8" stroke="var(--text-muted)" strokeWidth="1" />
      <line x1="6" y1="10" x2="9" y2="10" stroke="var(--text-muted)" strokeWidth="1" />
    </svg>
  )
}

export function getFileIcon(file, isExpanded = false) {
  if (file.type === 'directory') {
    return FileIcons.directory(isExpanded)
  }
  
  const ext = file.name.split('.').pop()?.toLowerCase()
  const iconMap = {
    js: FileIcons.js,
    jsx: FileIcons.jsx,
    ts: FileIcons.ts,
    tsx: FileIcons.ts,
    json: FileIcons.json,
    css: FileIcons.css,
    html: FileIcons.html,
    md: FileIcons.md,
    py: FileIcons.py
  }
  
  return iconMap[ext] || FileIcons.default
}
