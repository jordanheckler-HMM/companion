import { useState, useRef, useEffect } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { readTextFile, readFile } from '@tauri-apps/plugin-fs'
import { Send, Paperclip, ChevronDown, Sparkles, Square, X, FileEdit, Cloud, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AIService } from '@/services/aiService'
import { RAGService } from '@/services/ragService'
import { QueryRouter } from '@/services/QueryRouter'
import { ModelRegistry } from '@/services/ModelRegistry'
import { OllamaInstaller } from './OllamaInstaller'
import { useStore } from '@/store'
import { getDocument } from 'pdfjs-dist'
import mammoth from 'mammoth'
import { CodeEditor } from './CodeEditor'
import logo from '@/assets/logo.png'


interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  status?: 'thinking' | 'done' | 'error'
  modelId?: string
  modelLabel?: string
}

interface MessageBubbleProps {
  message: Message
}

function MessageBubble({ message }: MessageBubbleProps) {
  const { settings } = useStore()
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex gap-3 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <Avatar className="h-8 w-8 flex-shrink-0 border border-white/10 overflow-hidden">
        {!isUser && <img src={logo} alt="Assistant" className="h-full w-full object-cover" />}
        <AvatarFallback
          className={cn(isUser ? 'bg-background/20' : '')}
          style={!isUser && !message.content ? {
            backgroundColor: 'rgb(var(--accent-rgb))',
            color: 'white',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)'
          } : {}}
        >
          {isUser ? 'U' : ''}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          'px-4 py-3 rounded-2xl max-w-[85%] shadow-lg transition-all duration-200 relative overflow-hidden',
          isUser ? 'glass-message-user' : 'glass-message',
          !isUser && message.status === 'thinking' && 'animate-shimmer'
        )}
      >
        {!isUser && message.status === 'thinking' && (
          <div className="flex gap-1.5 items-center py-1 mb-2">
            <div className="w-2 h-2 rounded-full bg-foreground/60 animate-thinking-dot" />
            <div className="w-2 h-2 rounded-full bg-foreground/60 animate-thinking-dot" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 rounded-full bg-foreground/60 animate-thinking-dot" style={{ animationDelay: '0.4s' }} />
          </div>
        )}

        {message.content && (
          <div className={cn(
            "prose prose-sm max-w-none break-words",
            (settings.theme === 'dark' || settings.theme.startsWith('glass')) ? "prose-invert" : "prose-zinc"
          )}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        <div className="flex items-center justify-between mt-2 gap-4">
          <span className="text-[10px] text-foreground/40 font-medium block">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>

          {!isUser && message.modelLabel && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5 group-hover:border-white/10 transition-colors">
              {/* Check provider type from registry if possible, else fallback to cloud icon */}
              {settings.aiSettings.intelligenceMode === 'cloud' || (message.modelId && message.modelId.includes('gpt') || message.modelId?.includes('claude')) ? (
                <Cloud className="h-2.5 w-2.5 text-blue-400/70" />
              ) : (
                <Home className="h-2.5 w-2.5 text-green-400/70" />
              )}
              <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/50 whitespace-nowrap">
                {message.modelLabel}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ChatWindow() {
  /**
   * Main chat interface component.
   * Handles conversation state, message sending, and session-only file attachments.
   */
  const {
    settings,
    updateSettings,
    messages,
    addMessage,
    updateMessage,
    clearMessages,
    knowledgeBase,
    availableModels,
    setAvailableModels
  } = useStore()

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<Array<{ name: string; content: string }>>([])
  const [editorMode, setEditorMode] = useState<{
    active: boolean
    content: string
    fileName?: string
    filePath?: string
    language?: string
  } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const userHasScrolledUpRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  // Handle manual scroll detection
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    // We consider the user "at the bottom" if they are within 50px of the edge
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50

    // If they aren't at the bottom, it means they manually scrolled up
    if (!isAtBottom) {
      userHasScrolledUpRef.current = true
    } else {
      userHasScrolledUpRef.current = false
    }
  }

  const stopChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Only auto-scroll if the user hasn't manually scrolled up to read history
    if (!userHasScrolledUpRef.current) {
      scrollToBottom('auto')
    }
  }, [messages])

  // No longer needed here, moved to App.tsx and decentralized via store

  const handleSend = async () => {
    const userInput = input.trim()
    if (!userInput && pendingFiles.length === 0) return
    if (isLoading) return

    setInput('')
    setIsLoading(true)
    userHasScrolledUpRef.current = false

    // Add user message if there's text
    if (userInput) {
      addMessage({
        content: userInput,
        role: 'user'
      })
    }

    // Add file attachment messages
    if (pendingFiles.length > 0) {
      for (const file of pendingFiles) {
        addMessage({
          role: 'user',
          content: `Attached file: **${file.name}** (Session Only)`
        })
      }
    }

    // Create a placeholder for assistant message
    const assistantMessageId = addMessage({
      content: '',
      role: 'assistant',
      status: 'thinking'
    })

    let fullContent = ''
    let thinkingContent = ''
    let isThinking = false

    // Call AI service with streaming
    try {
      const controller = new AbortController()
      abortControllerRef.current = controller
      const aiService = new AIService(settings.aiSettings)
      const ragService = new RAGService(settings.aiSettings)

      // Determine model using QueryRouter
      const selectedModelId = QueryRouter.selectModel(
        settings.aiSettings.intelligenceMode,
        settings.aiSettings.preferredModelId,
        {
          input: userInput,
          attachmentCount: pendingFiles.length,
          toolsEnabled: true // Simplified for routing
        }
      )

      const modelDef = availableModels.find(m => m.id === selectedModelId)
      const modelLabel = modelDef ? modelDef.displayName : selectedModelId

      // Search Knowledge Base for context
      const relevantChunks = await ragService.search(userInput || '', knowledgeBase, 3)
      let contextText = relevantChunks.length > 0
        ? `\n\nRelevant information from user's KNOWLEDGE BASE files:\n${relevantChunks.map((c: any) => `--- KNOWLEDGE CONTEXT ---\n${c.content}\n------------------`).join('\n\n')}`
        : ''

      // Add pending file content to context
      if (pendingFiles.length > 0) {
        const fileContext = pendingFiles.map(f => `--- ATTACHED FILE: ${f.name} ---\n${f.content}\n------------------`).join('\n\n')
        contextText += `\n\nAttached files for this conversation:\n${fileContext}`
      }

      const conversationHistory = [
        { role: 'system' as const, content: settings.systemPrompt + contextText },
        ...messages.concat(
          userInput ? [{ id: 'temp-user', content: userInput, role: 'user', timestamp: new Date() }] : []
        ).map(m => ({
          role: m.role,
          content: m.content,
        }))
      ]

      // Clear pending files after adding to context
      setPendingFiles([])

      let rawContent = ''

      await aiService.streamMessage(conversationHistory, (chunk) => {
        rawContent += chunk

        // Robust parsing of <think> tags from the raw stream
        const thinkMatch = rawContent.match(/<think>([\s\S]*?)(?:<\/think>|$)/)
        thinkingContent = thinkMatch ? thinkMatch[1] : ''
        isThinking = rawContent.includes('<think>') && !rawContent.includes('</think>')

        // Extract main content (everything outside <think> and [TOOL] tags)
        // 1. Remove completed think blocks
        let cleanContent = rawContent.replace(/<think>[\s\S]*?<\/think>/g, '')
        // 2. Remove any partial/starting think tag and its following text
        cleanContent = cleanContent.split('<think>')[0]

        // 3. Remove [TOOL:...]...[/TOOL] blocks
        cleanContent = cleanContent.replace(/\[TOOL:[\w]+\][\s\S]*?\[\/TOOL\]/g, '')

        // 4. Remove status chunks like *[Executing ...]* and *[... completed]*
        cleanContent = cleanContent.replace(/\*\[(?:Executing|[\w]+ completed)[^\]]*\]\*/g, '')

        fullContent = cleanContent.trim()

        // Update UI based on current state
        const displayContent = thinkingContent && isThinking
          ? `*Thinking...*\n\n${thinkingContent}`
          : (thinkingContent ? `> ${thinkingContent.trim()}\n\n${fullContent}` : fullContent)

        // Keep status as 'thinking' while stream is active
        updateMessage(assistantMessageId, displayContent, 'thinking', selectedModelId, modelLabel)
      }, selectedModelId)

      if (!fullContent && !thinkingContent) {
        updateMessage(assistantMessageId, 'No response received', 'error')
      } else {
        // Final update to set status to done
        const finalDisplay = thinkingContent ? `> ${thinkingContent}\n\n${fullContent}` : fullContent

        // Check for editor trigger
        const editorMatch = fullContent.match(/\[EDITOR:START\]([\s\S]*?)\[EDITOR:END\]/)
        if (editorMatch) {
          const editorContent = editorMatch[1].trim()
          const displayContent = fullContent.replace(/\[EDITOR:START\][\s\S]*?\[EDITOR:END\]/, '').trim()
          updateMessage(assistantMessageId, thinkingContent ? `> ${thinkingContent}\n\n${displayContent}` : displayContent, 'done', selectedModelId, modelLabel)
          // Auto-open editor with extracted content
          setTimeout(() => openEditor(editorContent, 'ai-generated.txt'), 300)
        } else {
          updateMessage(assistantMessageId, finalDisplay, 'done', selectedModelId, modelLabel)
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Handle cancelation gracefully
        updateMessage(assistantMessageId, (thinkingContent ? `> ${thinkingContent}\n\n${fullContent}` : fullContent) + ' [Stopped]', 'done')
      } else {
        updateMessage(assistantMessageId, `Error: ${error instanceof Error ? error.message : 'Failed to get AI response'}`, 'error')
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['application/pdf', 'text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|txt|md|docx)$/i)) {
      addMessage({
        role: 'assistant',
        content: `Invalid file type. Please upload PDF, TXT, MD, or DOCX files only.`
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      addMessage({
        role: 'assistant',
        content: `File too large. Maximum size is 5MB.`
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    try {
      // Extract text content
      let content = ''
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await getDocument({ data: arrayBuffer }).promise
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()
          content += textContent.items.map((item: any) => item.str).join(' ') + '\n'
        }
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        content = result.value
      } else {
        content = await file.text()
      }

      // Add to pending files (not sent yet)
      setPendingFiles(prev => [...prev, { name: file.name, content }])
    } catch (error) {
      console.error('File processing error:', error)
      addMessage({
        role: 'assistant',
        content: `Error processing **${file.name}**: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Editor functions
  const openEditor = (content: string, fileName?: string, language?: string, filePath?: string) => {
    setEditorMode({
      active: true,
      content,
      fileName: fileName || 'untitled.txt',
      filePath,
      language
    })
  }

  const handleNativeFileOpen = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Supported Files',
            extensions: ['txt', 'md', 'js', 'ts', 'jsx', 'tsx', 'py', 'json', 'html', 'css', 'yaml', 'xml', 'rs', 'go', 'c', 'cpp', 'h', 'hpp', 'java', 'php', 'rb', 'sh', 'sql', 'pdf', 'docx']
          },
          {
            name: 'All Files',
            extensions: ['*']
          }
        ]
      })

      if (!selected || Array.isArray(selected)) return

      const path = selected
      const fileName = path.split(/[/\\]/).pop() || 'untitled.txt'
      let content = ''

      if (fileName.toLowerCase().endsWith('.pdf')) {
        const uint8array = await readFile(path)
        const pdf = await getDocument({ data: uint8array.buffer }).promise
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()
          content += textContent.items.map((item: any) => item.str).join(' ') + '\n'
        }
      } else if (fileName.toLowerCase().endsWith('.docx')) {
        const uint8array = await readFile(path)
        const result = await mammoth.extractRawText({ arrayBuffer: uint8array.buffer })
        content = result.value
      } else {
        content = await readTextFile(path)
      }

      openEditor(content, fileName, undefined, path)
    } catch (error) {
      console.error('Error opening file:', error)
      addMessage({
        role: 'assistant',
        content: `Error opening file: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
  }

  const handleEditorSave = () => {
    addMessage({
      role: 'assistant',
      content: '✅ Content saved to session'
    })
  }

  const handleEditorUpload = (content: string, fileName: string) => {
    setPendingFiles(prev => [...prev, { name: fileName, content }])
    addMessage({
      role: 'assistant',
      content: `📤 **${fileName}** uploaded as attachment`
    })
    closeEditor()
  }

  const closeEditor = () => {
    setEditorMode(null)
  }

  const filteredModels = availableModels.filter(m => {
    if (settings.aiSettings.intelligenceMode === 'local') return m.type === 'local'
    if (settings.aiSettings.intelligenceMode === 'cloud') return m.type === 'cloud'
    return true
  })
  const activeModel = filteredModels.find(m => m.id === settings.aiSettings.preferredModelId) || filteredModels[0]

  return (
    <div className="flex flex-col h-screen relative">
      {/* Chat Header */}
      <div className="glass-light border-b border-white/10 px-6 py-4 flex items-center justify-between relative z-[60]">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold">Chat</h2>
            <p className="text-sm text-muted-foreground">Ask me anything</p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={clearMessages}
            className="text-[10px] uppercase tracking-wider font-bold opacity-30 hover:opacity-100 hover:text-red-400 hover:bg-red-400/10 h-7 px-2 rounded-md transition-all"
          >
            Clear Conversation
          </Button>
        </div>

        {/* Model Selector Overhaul */}
        <div className="flex items-center gap-3">
          {/* Intelligence Mode Tabs */}
          <div className="flex glass-strong rounded-lg p-0.5 border border-white/5">
            {(['local', 'cloud'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => updateSettings({ aiSettings: { ...settings.aiSettings, intelligenceMode: mode } })}
                className={cn(
                  "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200",
                  settings.aiSettings.intelligenceMode === mode
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Model Pick-list */}
          <div className="relative group">
            <div className="flex items-center gap-2 glass-hover px-3 py-1.5 rounded-lg cursor-pointer border border-white/5 hover:border-white/20 transition-all">
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  activeModel?.type === 'local' ? "bg-green-400" : "bg-blue-400 ripple-blue"
                )}
              />
              <span className="text-xs font-semibold whitespace-nowrap">
                {activeModel?.displayName || 'Select Model'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-50 transition-transform group-hover:translate-y-0.5" />
            </div>

            {/* Advanced Dropdown - High Contrast Solid Obsidian */}
            <div className="absolute top-full right-0 mt-3 w-[340px] bg-[#0c0c0c]/98 border border-white/20 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.05)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] p-5 backdrop-blur-3xl">
              <div className="px-1 py-1 mb-4 flex items-center justify-between">
                <span className="text-[11px] uppercase font-black tracking-[0.2em] text-accent/80">Intelligence Grid</span>
                <button
                  onClick={async () => {
                    const aiService = new AIService(settings.aiSettings)
                    await aiService.getModels()
                    const registry = ModelRegistry.getInstance()
                    setAvailableModels(registry.getAllModels())
                  }}
                  className="p-2 rounded-xl bg-white/5 hover:bg-accent/20 hover:text-accent transition-all duration-300 group/refresh"
                  title="Refresh Models"
                >
                  <Sparkles className="h-3.5 w-3.5 opacity-60 group-hover/refresh:opacity-100 group-hover/refresh:scale-110 transition-transform" />
                </button>
              </div>

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {availableModels
                  .filter(m => {
                    if (settings.aiSettings.intelligenceMode === 'local') return m.type === 'local'
                    if (settings.aiSettings.intelligenceMode === 'cloud') return m.type === 'cloud'
                    return true
                  })
                  .sort((a, b) => a.displayName.localeCompare(b.displayName))
                  .map((m) => (
                    <div
                      key={m.id}
                      onClick={() => updateSettings({ aiSettings: { ...settings.aiSettings, preferredModelId: m.id } })}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all duration-300 border relative overflow-hidden group/item",
                        settings.aiSettings.preferredModelId === m.id
                          ? "bg-accent/10 border-accent/40 shadow-[inset_0_0_12px_rgba(var(--accent-rgb),0.1)]"
                          : "bg-[#151515] border-white/5 hover:bg-[#1a1a1a] hover:border-white/10 hover:shadow-xl"
                      )}
                    >
                      {settings.aiSettings.preferredModelId === m.id && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
                      )}

                      <div className="flex items-center gap-4 relative z-10">
                        <div className={cn(
                          "w-3 h-3 rounded-full flex-shrink-0",
                          m.type === 'local'
                            ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]"
                            : "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]"
                        )} />
                        <div className="flex flex-col">
                          <span className={cn(
                            "text-[15px] font-bold tracking-tight leading-none mb-1.5 transition-colors",
                            settings.aiSettings.preferredModelId === m.id ? "text-white" : "text-white/90 group-hover/item:text-white"
                          )}>{m.displayName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded font-black tracking-widest text-white/40 uppercase group-hover/item:text-white/60">{m.provider}</span>
                            <span className="text-[10px] text-white/30 font-bold uppercase tracking-tighter">{m.type}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {m.capabilities.vision && <Sparkles className="h-4 w-4 text-amber-400 opacity-60 group-hover/item:opacity-100 transition-opacity" />}
                      </div>
                    </div>
                  ))}
                {filteredModels.length === 0 && (
                  <div className="py-12 text-center bg-[#151515] rounded-3xl border border-white/5">
                    <p className="text-[11px] text-white/40 uppercase font-black tracking-widest mb-4">No {settings.aiSettings.intelligenceMode} Engines Found</p>
                    {settings.aiSettings.intelligenceMode === 'local' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mx-auto w-48 text-[11px] uppercase font-black tracking-wider h-10 bg-white/5 border-white/10 hover:bg-white/10"
                        onClick={() => {
                          setInput('show me how to add local models')
                          inputRef.current?.focus()
                        }}
                      >
                        Manual Setup
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
            <OllamaInstaller />
            <div className="max-w-md text-center animate-in fade-in zoom-in duration-700 delay-200">
              <h2 className="text-3xl font-bold tracking-tight mb-2">Hello, I'm {settings.assistantName}</h2>
              <p className="text-muted-foreground">Your privacy-first AI companion. How can I help you today?</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="glass-input border-t border-white/20 px-6 py-4">
        {/* Pending Files Preview */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {pendingFiles.map((file, index) => (
              <div
                key={index}
                className="glass px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm border border-white/20"
              >
                <Paperclip className="h-3.5 w-3.5 opacity-60" />
                <span className="font-medium">{file.name}</span>
                <button
                  onClick={() => removePendingFile(index)}
                  className="ml-1 hover:bg-white/10 rounded p-0.5 transition-colors"
                  aria-label="Remove file"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".txt,.md,.pdf,.docx"
            onChange={handleFileUpload}
          />

          <Button
            variant="ghost"
            size="icon"
            className="glass-hover flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="glass-hover flex-shrink-0"
            onClick={handleNativeFileOpen}
            title="Open in editor"
          >
            <FileEdit className="h-4 w-4" />
          </Button>

          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="glass flex-1 border-white/20 focus-visible:border-white/40 h-11"
            disabled={isLoading}
          />

          <Button
            onClick={isLoading ? stopChat : handleSend}
            size="icon"
            style={{
              backgroundColor: (input.trim() || pendingFiles.length > 0 || isLoading) ? 'rgb(var(--accent-rgb))' : undefined,
              color: (input.trim() || pendingFiles.length > 0 || isLoading) ? 'white' : undefined
            }}
            className={cn(
              "flex-shrink-0 h-11 w-11 transition-all duration-300",
              (input.trim() || pendingFiles.length > 0 || isLoading) ? "shadow-[0_0_20px_rgba(var(--accent-rgb),0.4)]" : "glass-strong"
            )}
            disabled={!input.trim() && pendingFiles.length === 0 && !isLoading}
          >
            {isLoading ? (
              <Square className="h-4 w-4 fill-current" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 px-1">
          Press Enter to send, Shift + Enter for new line
        </p>
      </div>

      {/* Editor Overlay */}
      {
        editorMode?.active && (
          <CodeEditor
            initialContent={editorMode.content}
            fileName={editorMode.fileName}
            filePath={editorMode.filePath}
            language={editorMode.language}
            onSave={handleEditorSave}
            onExit={closeEditor}
            onUpload={handleEditorUpload}
          />
        )
      }
    </div >
  )
}
