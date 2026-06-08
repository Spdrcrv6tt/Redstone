# Redstone 🔥

A hyper-modern web frontend for [Ollama](https://ollama.ai) — chat with your locally hosted LLMs from a polished, responsive interface.

## Features

- **Streaming responses** — real-time token-by-token output from Ollama
- **Multi-conversation** — persistent sidebar with full chat history
- **Model selector** — switch between any locally available Ollama model on the fly
- **Markdown rendering** — full GFM support with syntax-aware code blocks
- **Settings panel** — configure Ollama host, temperature, and system prompt
- **Keyboard shortcuts** — Enter to send, Shift+Enter for newline, Stop button mid-stream
- **Dark-first UI** — built on Tailwind CSS with a zinc/orange design system
- **Fully local** — zero data leaves your machine; talks directly to Ollama over localhost

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Ollama](https://ollama.ai) running locally (`ollama serve`)

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Make sure Ollama is running (`ollama serve`) and you have at least one model pulled:

```bash
ollama pull llama3.2
```

## Configuration

All settings live in the **Settings** panel (gear icon in the sidebar):

| Setting | Default | Description |
|---------|---------|-------------|
| Ollama Host | `http://localhost:11434` | Base URL of your Ollama instance |
| Temperature | `0.7` | Sampling temperature (0 = precise, 2 = creative) |
| System Prompt | _(empty)_ | Optional system message prepended to every conversation |

Settings are persisted to `localStorage`.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand (persisted) |
| Markdown | react-markdown + remark-gfm |
| Icons | lucide-react |
| LLM | Ollama (local) |

## Project Structure

```
src/
├── app/          # Next.js app router pages and layout
├── components/   # UI components (Sidebar, ChatView, MessageItem, …)
├── hooks/        # useChat, useModels
├── lib/          # Ollama client, Zustand store, utilities
└── types/        # Shared TypeScript types
```

## Roadmap

- [ ] Conversation search and filtering
- [ ] Image/multimodal input (vision models)
- [ ] Export conversations (Markdown / JSON)
- [ ] Multiple system prompt presets
- [ ] Syntax highlighting in code blocks
- [ ] Keyboard command palette
- [ ] Responsive / mobile layout
