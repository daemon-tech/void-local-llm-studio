# Void

Void is a minimal coding assistant that combines a full-featured integrated development environment with autonomous AI agent collaboration. The system enables multiple local language model instances to work together as specialized workers on complex coding tasks, with real-time visualization of their activities and direct integration into the development workflow.

## Vision

Traditional coding assistants operate as single-instance tools that respond to individual prompts. Void reimagines this paradigm by introducing a multi-agent architecture where specialized AI workers collaborate autonomously. Each worker can assume different roles—coder, architect, reviewer, tester, optimizer, researcher, or debugger—and work in parallel or in coordination with others. This approach mirrors how human development teams function, where different specialists contribute their expertise to solve problems more effectively than any single individual could.

The vision extends beyond simple task execution. Workers maintain context, learn from their interactions, and can autonomously create entire project structures. They communicate with each other, share knowledge, and build upon each other's work. The system provides transparent visualization of all agent activities, file operations, and command executions, giving developers complete visibility into what the AI is doing at every step.

## Architecture

Void is built as a full-stack application with a clear separation between frontend visualization and backend execution. The frontend is a React-based single-page application that renders a three-dimensional workspace where workers appear as interactive entities. The backend is a Node.js Express server that manages worker instances, coordinates task execution, and interfaces with local language models through Ollama.

The core innovation lies in the worker service layer, which parses natural language instructions from developers, extracts actionable operations like file creation or command execution, and autonomously performs these operations within the project context. Workers can read existing code, understand project structure, write new files, modify existing ones, execute terminal commands, and communicate their findings to other workers.

## Core Features

The integrated development environment provides standard functionality expected in modern code editors: file tree navigation, syntax-highlighted code editing with Monaco Editor, tabbed file management, and integrated terminal access. Files can be created, renamed, and deleted through the interface. The editor supports format-on-save, keyboard shortcuts, and real-time content synchronization.

The agent system allows spawning multiple worker instances, each configured with a specific role and model. Workers can be assigned tasks individually or as groups, with automatic context sharing between collaborators. The system tracks all worker activities—file operations, command executions, task completions, and errors—and displays this information in a live activity feed.

Project creation is fully autonomous. Developers specify a project name, type, and path, select which workers should handle the setup, and the system generates the appropriate project structure with initial configuration files. Workers then autonomously configure dependencies, create boilerplate code, and prepare the project for development.

The terminal integration executes commands within the project directory context, providing developers with direct access to build tools, package managers, and system commands while maintaining security restrictions on dangerous operations.

## Technical Implementation

The frontend uses React with Zustand for state management, ensuring that IDE state persists across component unmounts. Three.js and React Three Fiber render the three-dimensional worker visualization. Monaco Editor provides the code editing experience with a custom theme matching the ENDFIELDTOOLS aesthetic.

The backend uses Express.js for API routing and LangChain for structured interaction with language models. Worker instances are managed in memory, with each worker maintaining its own task history, activity log, and shared knowledge base. File operations are performed through Node.js filesystem APIs, with security checks preventing access outside the project root.

The system supports both File System Access API for modern browsers, allowing native folder selection, and traditional path-based access for broader compatibility. File trees are built recursively and cached in application state for performance.

## Design Philosophy

Void follows the ENDFIELDTOOLS design system: dark backgrounds with high contrast, bright yellow accents for interactive elements, and clear visual hierarchy. The interface prioritizes information density while maintaining readability. All interactions include smooth animations and transitions, providing visual feedback for every action.

The system is designed to be responsive across different screen sizes, with mobile-friendly breakpoints and touch-optimized interactions. The layout remains spacious and uncluttered, avoiding information overload while providing comprehensive functionality.

## Autonomous Capabilities

Workers operate with significant autonomy. When assigned a task, they analyze the request, examine the existing codebase, plan their approach, and execute file operations and commands without requiring step-by-step approval. They can create new projects from scratch, implement features across multiple files, run tests, and iterate based on results.

The system tracks every action workers take, providing developers with complete transparency. File creations, modifications, deletions, and command executions are all logged and displayed in real-time. This visibility ensures developers always know what changes are being made and can intervene if necessary.

## Collaboration Model

Multiple workers can be assigned to the same task, with automatic context sharing between them. Each worker brings its specialized perspective—an architect might design the structure while a coder implements it, a reviewer might identify issues while a debugger fixes them. This collaborative approach often produces better results than single-agent execution, as different workers catch different problems and suggest different solutions.

Workers communicate through a shared context system, allowing them to build upon each other's work. When one worker creates a file, others can read and modify it. When one worker executes a command, others can see the results and adjust their approach accordingly.

## Local-First Architecture

Void operates entirely locally, using Ollama to run language models on the developer's machine. This approach ensures privacy, eliminates API costs, and provides complete control over the AI capabilities. The default model is qwen2.5-coder, optimized for code generation, but any Ollama-compatible model can be used.

The system requires no external services beyond Ollama itself. All file operations, command execution, and worker coordination happen locally. This makes Void suitable for sensitive projects, offline development, and environments where external API access is restricted.

## Development Workflow

Developers open a project folder through the native file picker or by entering a path. The system loads the file tree and makes it available for editing. Workers can be spawned from the Space tab, configured with specific roles and models. Tasks are assigned through the Agent Panel, where developers can select one or more workers and describe what needs to be done.

The Activity Feed provides real-time updates on worker progress, showing file operations, command executions, and task completions. Developers can view detailed worker information, including chat history and activity logs, to understand how workers are approaching problems.

The terminal allows direct command execution within the project context, complementing the autonomous worker actions. Developers can run build commands, install dependencies, or execute scripts while workers handle the coding tasks.

## Future Vision

The long-term vision for Void is to create a development environment where AI agents become true collaborators rather than tools. Workers will learn from project history, understand coding patterns specific to each codebase, and proactively suggest improvements. They will handle increasingly complex tasks autonomously, from feature implementation to bug fixes to architectural refactoring.

The system will evolve to support more sophisticated collaboration patterns, with workers forming temporary teams for specific tasks, sharing specialized knowledge, and learning from successful collaborations. The visualization will expand to show worker relationships, knowledge graphs, and collaborative patterns.

The goal is to make software development more efficient by leveraging multiple AI perspectives simultaneously, while maintaining complete transparency and developer control. Void aims to be the tool that makes autonomous AI-assisted development practical, reliable, and understandable.
