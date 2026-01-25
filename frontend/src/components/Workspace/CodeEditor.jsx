import { useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import './CodeEditor.css'

export default function CodeEditor({ file, onChange, onSave }) {
  const editorRef = useRef(null)

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor
    
    // Configure Monaco with ENDFIELDTOOLS theme
    monaco.editor.defineTheme('endfield-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: 'AAAAAA', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'FFFF00', fontStyle: 'bold' },
        { token: 'string', foreground: 'FFFFFF' },
        { token: 'number', foreground: 'FFFF00' },
        { token: 'type', foreground: 'FFFF00' },
        { token: 'class', foreground: 'FFFF00' },
        { token: 'function', foreground: 'FFFFFF' },
        { token: 'variable', foreground: 'FFFFFF' },
        { token: '', foreground: 'FFFFFF' },
      ],
      colors: {
        'editor.background': '#121212',
        'editor.foreground': '#FFFFFF',
        'editorLineNumber.foreground': '#666666',
        'editorLineNumber.activeForeground': '#FFFF00',
        'editor.selectionBackground': '#333333',
        'editor.selectionHighlightBackground': '#333333',
        'editorCursor.foreground': '#FFFF00',
        'editorWhitespace.foreground': '#333333',
        'editorIndentGuide.background': '#333333',
        'editorIndentGuide.activeBackground': '#666666',
        'editor.lineHighlightBackground': '#1A1A1A',
        'editorGutter.background': '#121212',
        'editorGutter.modifiedBackground': '#FFFF00',
        'editorGutter.addedBackground': '#00C000',
        'editorGutter.deletedBackground': '#C00000',
        'editorWidget.background': '#1A1A1A',
        'editorWidget.border': '#333333',
        'editorSuggestWidget.background': '#1A1A1A',
        'editorSuggestWidget.selectedBackground': '#FFFF00',
        'editorSuggestWidget.foreground': '#FFFFFF',
      }
    })
    monaco.editor.setTheme('endfield-dark')

    // Keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave()
    })
    
    // Format document
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      editor.getAction('editor.action.formatDocument').run()
    })
  }

  const getLanguage = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    const langMap = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      json: 'json',
      css: 'css',
      html: 'html',
      md: 'markdown',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      rs: 'rust',
      php: 'php',
      rb: 'ruby',
      sh: 'shell',
      yml: 'yaml',
      yaml: 'yaml',
      xml: 'xml',
      sql: 'sql'
    }
    return langMap[ext] || 'plaintext'
  }

  return (
    <div className="code-editor-container">
      <div className="code-editor-header">
        <span className="code-editor-file-name">{file.name}</span>
        <div className="code-editor-actions">
          {file.modified && (
            <span className="code-editor-modified">Modified</span>
          )}
          <button 
            className="code-editor-format-btn"
            onClick={() => {
              if (editorRef.current) {
                editorRef.current.getAction('editor.action.formatDocument').run()
              }
            }}
            title="Format Document (Shift+Alt+F)"
          >
            Format
          </button>
          <button 
            className="code-editor-save-btn"
            onClick={onSave}
            title="Save (Ctrl+S)"
          >
            Save
          </button>
        </div>
      </div>
      <div className="code-editor-wrapper">
        <Editor
          height="100%"
          width="100%"
          language={getLanguage(file.name)}
          value={file.content || ''}
          onChange={(value) => onChange(value || '')}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: true, side: 'right' },
            fontSize: 13,
            fontFamily: 'Consolas, "Courier New", monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'on',
            renderLineHighlight: 'all',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: true,
            smoothScrolling: true,
            bracketPairColorization: { enabled: true },
            guides: {
              indentation: true,
              bracketPairs: true
            },
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            formatOnPaste: true,
            formatOnType: true,
            formatOnSave: true,
            autoIndent: 'full',
            detectIndentation: true,
            trimAutoWhitespace: true,
            codeLens: true,
            colorDecorators: true,
            semanticHighlighting: { enabled: true },
            links: true,
            occurrencesHighlight: true,
            renderWhitespace: 'selection',
            folding: true,
            foldingStrategy: 'auto',
            showFoldingControls: 'always',
            matchBrackets: 'always',
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            autoSurround: 'languageDefined'
          }}
        />
      </div>
    </div>
  )
}
