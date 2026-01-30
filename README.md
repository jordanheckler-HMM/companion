# Companion - Intelligent Desktop Assistant

Companion is a modern, **local-first** AI desktop assistant built with **Tauri v2**, **React**, and **TypeScript**. It offers both local privacy (via Ollama) and cloud-grade capability (OpenAI, Anthropic, Google), customizable through a beautiful glassmorphism interface.

## 🚀 Key Features

### 🧠 Dual Intelligence Modes
- **Local Mode**: Runs entirely on your machine using **Ollama** (Llama 3, Mistral, etc.) for maximum privacy and offline capability.
- **Cloud Mode**: Connects to top-tier models like **GPT-5.2**, **Claude 3.5 Sonnet**, or **Gemini 3.0** for complex reasoning and highest quality responses.
- **Flexible Choice**: Easily toggle between modes based on your immediate needs for privacy vs. power.

### ⚡ Mini Chat (Quick Access)
- A global, always-on-top floating panel for quick questions.
- Access your AI assistance without leaving your current context.

### 📚 Memory & RAG (Retrieval-Augmented Generation)
- **Chat with Files**: Upload PDFs, Docs, and Text files. Companion indexes them into a local vector database.
- **Semantic Search**: Ask questions about your documents, and Companion retrieves the exact context before answering.

### 🛠️ Agentic Tools
Companion isn't just a chatbot; it can **do** things:
- **Web Search**: Real-time information via DuckDuckGo.
- **File System**: Read/Write files directly on your computer.
- **Code Execution**: Run Python and JavaScript snippets locally.
- **URL Reader**: Scrape and summarize web pages.

### 🔌 Integrations
- **GitHub**: Manage issues, review PRs, and explore repositories.
- **Notion**: Search, read, and create pages in your workspace.
- **Google Calendar**: Check your schedule and book meetings.
- *All integration keys are stored locally and encrypted.*

### 📝 AI-Powered Editor
- Collaborative editor for long-form content and code.
- AI co-authoring: "Refactor this code" or "Expand this section".
- Syntax highlighting and multi-language support.

---

## 🛠️ Tech Stack

- **Core**: [Tauri v2](https://v2.tauri.app/) (Rust + Webview)
- **Frontend**: React 18, TypeScript, Vite
- **Styling**: TailwindCSS, Glassmorphism
- **State Management**: Zustand (Dual persistence: localStorage + Tauri Store)
- **AI / LLM**: Ollama (Local), OpenAI / Anthropic / Google (Cloud)
- **Vector DB**: In-memory generic embeddings (Local-first RAG)

---

## 🏁 Getting Started

### Prerequisites
1.  **Node.js 18+**
2.  **Rust** (for compiling the Tauri backend)
3.  **[Ollama](https://ollama.com/)** (Required for local mode & embeddings)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/jordanheckler-HMM/companion.git
    cd companion
    ```

2.  **Install Frontend Dependencies**
    ```bash
    npm install
    ```

3.  **Start Development Server**
    ```bash
    npm run tauri dev
    ```
    *This will compile the Rust backend and launch the application window.*

---

## 📂 Project Structure

```
companion/
├── src-tauri/           # Rust Backend
│   ├── src/lib.rs       # App entry point, plugin setup, windows
│   ├── capabilities/    # Application permissions (fs, http, shell)
│   └── tauri.conf.json  # App configuration & window definitions
│
├── src/                 # React Frontend
│   ├── components/
│   │   ├── chat/        # ChatWindow, MiniChat, Editor
│   │   ├── dashboard/   # Integration dashboards (GitHub/Notion/Cal)
│   │   └── tools/       
│   ├── services/
│   │   ├── aiService.ts # Unified AI Provider (Ollama/Cloud)
│   │   ├── ragService.ts# Vector search & file chunking
│   │   └── toolService.ts # Tool execution registry
│   └── store.ts         # Global state & persistence
```

## ⚠️ "Danger Zones" (For Contributors)

- **`src/services/aiService.ts`**: Handles the critical regex parsing for tool calls. Modifying the loop logic here can break agentic capabilities.
- **`src-tauri/tauri.conf.json`**: Controls the `panel` window. Changing window labels will break the Mini Chat toggle.

## 🤝 Contributing

We welcome contributions! Please verify your changes using the test suite:

```bash
npm run test
```

## 📄 License

MIT License. Built for the future of desktop AI.
