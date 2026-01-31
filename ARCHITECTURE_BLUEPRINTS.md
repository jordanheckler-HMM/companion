# Companion App Architecture Blueprints

This document contains the core logic and design patterns extracted from the Companion app to be reused in other projects.

## 1. Local/Cloud & BYOK Logic

### Persistence & State (Zustand)
The app uses `zustand` with `persist` middleware and a custom storage adapter that bridges LocalStorage and the Tauri Store.

```typescript
// Core Settings Interface
export interface AISettings {
  intelligenceMode: 'local' | 'cloud'
  preferredModelId?: string
  ollamaUrl: string
  cloudProvider: 'openai' | 'anthropic' | 'google'
  apiKey: string       // Primary Cloud Key
  googleApiKey?: string
  notionApiKey?: string
  githubApiKey?: string
}

// persistence Logic
const storage: StateStorage = {
  getItem: async (name) => {
    return localStorage.getItem(name) || await tauriStore.get(name)
  },
  setItem: async (name, value) => {
    localStorage.setItem(name, value)
    await tauriStore.set(name, value)
    await tauriStore.save()
  }
}
```

### AI Service (Routing & Providers)
The `AIService` acts as a unified hub for both local and cloud requests.

```typescript
async sendMessage(messages: ChatMessage[]) {
  const model = registry.getModelById(this.settings.preferredModelId)
  
  // Routing Logic
  if (model.provider === 'ollama') {
    return await this.sendToOllama(messages, model)
  } else {
    return await this.sendToCloudProvider(messages, model)
  }
}
```

---

## 2. "Glass" UI Look (CSS & Tailwind)

### Global CSS Tokens (`globals.css`)
Define these variables in `:root` and `.glass-theme`.

```css
.glass-theme {
  --glass-opacity: 0.1;
  --glass-blur: 16px;
  --glass-border-opacity: 0.15;
  --glass-bg: 255 255 255;
  --glass-tint-weight: 0.3;
  --accent-rgb: 168 85 247;
}

.glass {
  background: linear-gradient(135deg,
      rgba(var(--glass-bg), var(--glass-opacity)),
      rgba(var(--accent-rgb), calc(var(--glass-opacity) * var(--glass-tint-weight))));
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid rgba(255, 255, 255, var(--glass-border-opacity));
}
```

### Theme Variations
- **Crystal**: Low opacity, small blur (6px).
- **Frost**: Medium opacity (0.15), medium blur (20px).
- **Obsidian**: High opacity dark (0.6), high blur (40px), `--glass-bg: 0 0 0`.

---

## 3. AI Streaming & Markdown

### Streaming Loop
Logic for parsing chunks and updating the UI in real-time.

```typescript
await aiService.streamMessage(history, (chunk) => {
  rawContent += chunk

  // 1. Extract <think> content
  const thinkMatch = rawContent.match(/<think>([\s\S]*?)(?:<\/think>|$)/)
  thinkingContent = thinkMatch ? thinkMatch[1] : ''
  isThinking = rawContent.includes('<think>') && !rawContent.includes('</think>')

  // 2. Clean main content (remove think and tool tags)
  let cleanContent = rawContent.replace(/<think>[\s\S]*?<\/think>/g, '')
  cleanContent = cleanContent.split('<think>')[0]
  cleanContent = cleanContent.replace(/\[TOOL:[\w]+\][\s\S]*?\[\/TOOL\]/g, '')

  // 3. Update Message in Store
  const displayContent = isThinking 
    ? `*Thinking...*\n\n${thinkingContent}` 
    : (thinkingContent ? `> ${thinkingContent}\n\n${cleanContent}` : cleanContent)
    
  updateMessage(id, displayContent, 'thinking')
})
```

### Markdown Rendering
Uses `react-markdown` with `remark-gfm` and Tailwind Typography (`prose`).

```tsx
<div className="prose prose-sm prose-invert max-w-none break-words">
  <ReactMarkdown remarkPlugins={[remarkGfm]}>
    {message.content}
  </ReactMarkdown>
</div>
```

---

## 4. BYOK Utility Tips

- **OpenAI**: Use `Authorization: Bearer ${key}`.
- **Anthropic**: Use `x-api-key: ${key}` and `anthropic-version: 2023-06-01`.
- **Google**: Use `https://generativelanguage.googleapis.com/v1beta/models/...:streamGenerateContent?key=${key}`.
- **Ollama**: Localhost requests should use native `fetch` because Tauri's HTTP plugin sometimes struggles with loopback URLs.
