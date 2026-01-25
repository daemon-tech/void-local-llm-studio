# Void Setup

Minimal coding assistant. Default: **Ollama · qwen2.5-coder**.

## Quick start

1. **Install**
   ```bash
   npm run install:all
   ```

2. **Ollama + qwen2.5-coder**
   - Install [Ollama](https://ollama.ai)
   - Run:
     ```bash
     ollama pull qwen2.5-coder
     ```

3. **Run Void**
   ```bash
   npm run dev
   ```
   - Backend: `http://localhost:3000`
   - Frontend: `http://localhost:5173`

## Configuration

- **Ollama** (default): no keys. Uses `http://localhost:11434` and `qwen2.5-coder`.
- Optional `backend/.env`:
  ```
  OLLAMA_BASE_URL=http://localhost:11434
  OLLAMA_MODEL=qwen2.5-coder
  ```

## Features

- **Code chat**: main UI. Ask for code, refactors, or explanations. Uses Ollama qwen2.5-coder by default.
- **LLM**: top bar → “Select LLM” to switch model (Ollama) or provider.

## Troubleshooting

- **Backend not connected**: start backend on port 3000 (`npm run dev:backend` or `npm run dev`).
- **Ollama errors**: ensure Ollama is running and `ollama pull qwen2.5-coder` has completed.
