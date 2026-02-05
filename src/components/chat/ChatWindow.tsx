import { useState, useRef, useEffect, useCallback } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { readTextFile, readFile } from '@tauri-apps/plugin-fs'
import { Send, PaperclipIcon as Paperclip, X, FileEdit, Database, Cloud, Home, Square, ChevronDown, Sparkles, Mic, MicOff, Brain, Copy, Check, Volume2 } from 'lucide-react'

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
import { OnboardingGuide } from './OnboardingGuide'
import { useStore } from '@/store'
import { getDocument } from 'pdfjs-dist'
import mammoth from 'mammoth'
import { CodeEditor } from './CodeEditor'
import logo from '@/assets/logo.png'
import { audioService } from '@/services/AudioService'
import { speechToTextService } from '@/services/SpeechToTextService'
import { textToSpeechService } from '@/services/TextToSpeechService'


interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  status?: 'thinking' | 'done' | 'error'
  modelId?: string
  modelLabel?: string
  images?: string[]
}

interface MessageBubbleProps {
  message: Message
}

function MessageBubble({ message }: MessageBubbleProps) {
  const { settings } = useStore()
  const [isCopied, setIsCopied] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleSpeak = async () => {
    if (isSpeaking) {
      textToSpeechService.stop()
      setIsSpeaking(false)
      return
    }

    setIsSpeaking(true)
    await textToSpeechService.speak(message.content)
    setIsSpeaking(false)
  }

  return (
    <div
      className={cn(
        'flex gap-2 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300 group',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <Avatar className="h-7 w-7 flex-shrink-0 border border-white/10 overflow-hidden relative bg-black">
        {!isUser && (
          <>
            <img src={logo} alt="Assistant" className="h-full w-full object-cover scale-110 mix-blend-screen" />
            <div className="absolute inset-0 bg-accent mix-blend-color opacity-70 pointer-events-none" />
          </>
        )}
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
          'px-3 py-2 rounded-xl max-w-[82%] transition-all duration-200 relative overflow-hidden group/bubble',
          isUser ? 'glass-message-user' : 'glass-message',
          !isUser && message.status === 'thinking' && 'animate-shimmer'
        )}
      >
        {!isUser && message.status === 'thinking' && (
          <div className="flex gap-1 items-center py-0.5 mb-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/60 animate-thinking-dot" />
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/60 animate-thinking-dot" style={{ animationDelay: '0.2s' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/60 animate-thinking-dot" style={{ animationDelay: '0.4s' }} />
          </div>
        )}

        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt="User upload"
                className="max-w-full max-h-[240px] rounded-md border border-white/10 object-contain"
              />
            ))}
          </div>
        )}

        {message.content && (
          <div className={cn(
            "prose prose-sm max-w-none break-words text-[13px] leading-[1.45]",
            (settings.theme === 'dark' || settings.theme.startsWith('glass')) ? "prose-invert" : "prose-zinc"
          )}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Message Actions - Now below the message */}
        <div className={cn(
          "flex gap-1 mt-1 opacity-0 group-hover/bubble:opacity-100 transition-opacity justify-end",
          isUser ? "flex-row-reverse" : "flex-row"
        )}>
          <button
            onClick={handleCopy}
            className="px-1.5 py-0.5 rounded-md bg-black/30 hover:bg-black/50 border border-white/10 text-white/50 hover:text-white transition-all flex items-center gap-1"
            title="Copy message"
          >
            {isCopied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            <span className="text-[9px] font-bold uppercase tracking-wider">Copy</span>
          </button>
          {!isUser && (
            <button
              onClick={handleSpeak}
              className={cn(
                "px-1.5 py-0.5 rounded-md border border-white/10 transition-all flex items-center gap-1",
                isSpeaking
                  ? "bg-primary-accent text-white"
                  : "bg-black/30 hover:bg-black/50 text-white/50 hover:text-white"
              )}
              title={isSpeaking ? "Stop speaking" : "Speak message"}
            >
              <Volume2 className={cn("h-3 w-3", isSpeaking && "animate-pulse")} />
              <span className="text-[9px] font-bold uppercase tracking-wider">{isSpeaking ? 'Stop' : 'Speak'}</span>
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 gap-4">
          <span className="text-[9px] text-foreground/40 font-medium block">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>

          {!isUser && message.modelLabel && (
            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/5 group-hover:border-white/10 transition-colors">
              {/* Check provider type from registry if possible, else fallback to cloud icon */}
              {settings.aiSettings.intelligenceMode === 'cloud' || (message.modelId && message.modelId.includes('gpt') || message.modelId?.includes('claude')) ? (
                <Cloud className="h-2.5 w-2.5 text-blue-400/70" />
              ) : (
                <Home className="h-2.5 w-2.5 text-green-400/70" />
              )}
              <span className="text-[8px] font-bold uppercase tracking-widest text-foreground/50 whitespace-nowrap">
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
    files,
    pendingContext,
    removePendingContext,
    clearPendingContext,
    availableModels,
    setAvailableModels,
    showOnboarding
  } = useStore()

  const [useVault, setUseVault] = useState(settings.aiSettings.enableVaultRAG || false)

  const [input, setInput] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<Array<{ name: string; content: string; type?: 'file' | 'image' }>>([])
  const [editorMode, setEditorMode] = useState<{
    active: boolean
    content: string
    fileName?: string
    filePath?: string
    language?: string
  } | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const userHasScrolledUpRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastSpokenMessageIdRef = useRef<string | null>(null)

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

  // Paste handling
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue

          // Basic size check
          if (file.size > 5 * 1024 * 1024) {
            addMessage({ role: 'assistant', content: 'Pasted image is too large (max 5MB)' })
            continue
          }

          const reader = new FileReader()
          reader.onload = (e) => {
            const result = e.target?.result as string
            setPendingFiles(prev => [...prev, { name: `pasted-image-${Date.now()}.png`, content: result, type: 'image' }])
          }
          reader.readAsDataURL(file)
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [addMessage])


  useEffect(() => {
    const aiPrompts = [] as any[] // Logic moved to handleSend. DISABLED: pendingContext.filter(ctx => ctx.type === 'ai_prompt' && ctx.prompt)
    if (aiPrompts.length > 0) {
      // Use the most recent prompt
      const prompt = aiPrompts[aiPrompts.length - 1].prompt
      if (prompt) {
        setInput(prompt)
        // Focus the input
        inputRef.current?.focus()

        // Clear these specific prompts so they don't reappear or get duplicate-sent
        // We use a small timeout to ensure the UI update has processed
        setTimeout(() => {
          // Ideally we'd remove just these IDs, but clearPendingContext wipes all.
          // For now this is fine as we just consumed them.
          // To be safer, we should probably filter and remove.
          // But clearPendingContext() is what handleSend uses too.
          clearPendingContext()
        }, 100)
      }
    }
  }, [pendingContext, clearPendingContext])

  // No longer needed here, moved to App.tsx and decentralized via store

  const handleSend = async () => {
    const userInput = input.trim()

    // Check for other context types that should allow sending without text
    const hasPendingContext = pendingContext.length > 0;

    if (!userInput && pendingFiles.length === 0 && !hasPendingContext) return
    if (isLoading) return

    setInput('')
    setIsLoading(true)
    userHasScrolledUpRef.current = false

    // Build the full message content
    // Collect prompts from pending context (ai_prompt type)
    const pendingPrompts = pendingContext.filter(ctx => ctx.type === 'ai_prompt' && ctx.prompt)
    const tableContexts = pendingContext.filter(ctx => ctx.type === 'supabase_table')

    let fullUserMessage = userInput

    // Add AI prompts
    if (pendingPrompts.length > 0) {
      const promptTexts = pendingPrompts.map(p => p.prompt).join('\n')
      fullUserMessage = fullUserMessage ? `${promptTexts} \n\n${fullUserMessage} ` : promptTexts
    }

    // Add Table queries
    if (tableContexts.length > 0) {
      const tableQueries = tableContexts.map(t => t.metadata?.query).filter(Boolean).join('\n');
      if (tableQueries) {
        fullUserMessage = fullUserMessage ? `${tableQueries}\n\n${fullUserMessage}` : tableQueries;
      }
    }

    // Separate images and text files
    const imageFiles = pendingFiles.filter(f => f.type === 'image' || f.name.match(/\.(png|jpg|jpeg|webp|gif)$/i))
    const textFiles = pendingFiles.filter(f => f.type !== 'image' && !f.name.match(/\.(png|jpg|jpeg|webp|gif)$/i))

    // Add file attachment messages (text files)
    if (textFiles.length > 0) {
      for (const file of textFiles) {
        addMessage({
          role: 'user',
          content: `Attached file: ** ${file.name}** (Session Only)`
        })
      }
    }

    // Add User Message with Image Attachments
    // Note: If we have images but no text, we still create a user message
    if (fullUserMessage || imageFiles.length > 0) {
      addMessage({
        content: fullUserMessage,
        role: 'user',
        images: imageFiles.map(f => f.content)
      })
    } else if (textFiles.length > 0 && !fullUserMessage) {
      // Just text attachments, no user message body -> do nothing extra, attachments handled above
    }

    const consumedContextIds = new Set(
      [...pendingPrompts, ...tableContexts].map(ctx => ctx.id)
    )
    if (consumedContextIds.size > 0) {
      consumedContextIds.forEach(id => removePendingContext(id))
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
      const toolsEnabled = settings.aiSettings.toolsEnabled
        ? Object.entries(settings.aiSettings.toolsEnabled).some(([key, value]) => {
          if (key === 'supabase') return !!(value as { enabled?: boolean } | undefined)?.enabled
          return value === true
        })
        : false

      const selectedModelId = QueryRouter.selectModel(
        settings.aiSettings.intelligenceMode,
        settings.aiSettings.preferredModelId,
        {
          input: fullUserMessage,
          attachmentCount: pendingFiles.length,
          toolsEnabled,
          hasImages: imageFiles.length > 0
        }
      )

      const modelDef = availableModels.find(m => m.id === selectedModelId)
      const modelLabel = modelDef ? modelDef.displayName : selectedModelId

      // Search Knowledge Base for context if enabled
      let contextText = ''
      if (useVault && knowledgeBase.length > 0) {
        const relevantChunks = await ragService.search(fullUserMessage || '', knowledgeBase, 3)
        contextText = relevantChunks.length > 0
          ? `\n\nRelevant information from user's KNOWLEDGE BASE files:\n${relevantChunks.map((c: any) => `--- KNOWLEDGE CONTEXT ---\n${c.content}\n------------------`).join('\n\n')}`
          : ''
      }

      // Add pending file content to context (Text files only)
      if (textFiles.length > 0) {
        const fileContext = textFiles.map(f => `--- ATTACHED FILE: ${f.name} ---\n${f.content}\n------------------`).join('\n\n')
        contextText += `\n\nAttached files for this conversation:\n${fileContext}`
      }

      const conversationHistory = [
        { role: 'system' as const, content: settings.systemPrompt + contextText },
        ...messages.concat(
          (fullUserMessage || imageFiles.length > 0)
            ? [{
              id: 'temp-user',
              content: fullUserMessage,
              role: 'user',
              timestamp: new Date(),
              images: imageFiles.map(f => f.content)
            }]
            : []
        ).map(m => ({
          role: m.role,
          content: m.content,
          images: m.images
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

        // 5. Remove wrapping parentheses if the model outputs thoughts in them (common in some local models)
        if (fullContent.length > 2 && fullContent.startsWith('(') && fullContent.endsWith(')')) {
          fullContent = fullContent.slice(1, -1).trim()
        }

        // Update UI based on current state
        const displayContent = thinkingContent && isThinking
          ? `*Thinking...*\n\n${thinkingContent}`
          : (thinkingContent ? `> ${thinkingContent.trim()}\n\n${fullContent}` : fullContent)

        // Keep status as 'thinking' while stream is active
        updateMessage(assistantMessageId, displayContent, 'thinking', selectedModelId, modelLabel)
      }, selectedModelId, controller.signal)

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
    const validTypes = ['application/pdf', 'text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|txt|md|docx|png|jpg|jpeg|webp|gif)$/i)) {
      addMessage({
        role: 'assistant',
        content: `Invalid file type. Please upload PDF, TXT, MD, DOCX, or Images.`
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
      } else if (file.type.startsWith('image/')) {
        // Image handling
        const reader = new FileReader()
        content = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsDataURL(file)
        })
      } else {
        content = await file.text()
      }

      // Add to pending files (not sent yet)
      setPendingFiles(prev => [...prev, {
        name: file.name,
        content,
        type: file.type.startsWith('image/') ? 'image' : 'file'
      }])
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
    setPendingFiles(prev => [...prev, { name: fileName, content, type: 'file' }])
    addMessage({
      role: 'assistant',
      content: `📤 **${fileName}** uploaded as attachment`
    })
    closeEditor()
  }

  const closeEditor = () => {
    setEditorMode(null)
  }

  // Voice functions
  const handleVoiceToggle = useCallback(async () => {
    if (!settings.voiceSettings.enabled) {
      addMessage({
        role: 'assistant',
        content: 'Voice mode is disabled. Enable it in Settings → Voice & Audio.'
      })
      return
    }

    if (isRecording) {
      // Stop recording and transcribe
      try {
        setIsRecording(false)
        const audioBlob = await audioService.stopRecording()
        const transcript = await speechToTextService.transcribe(audioBlob)

        if (transcript) {
          setInput(transcript)
          inputRef.current?.focus()
        }
      } catch (error) {
        console.error('Voice recording error:', error)
        addMessage({
          role: 'assistant',
          content: `Voice error: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      }
    } else {
      // Check permission before starting
      const permissionCheck = await audioService.checkMicrophonePermission()

      if (!permissionCheck.granted && permissionCheck.message) {
        // Show helpful message about enabling permissions
        addMessage({
          role: 'assistant',
          content: permissionCheck.message
        })
        return
      }

      // Start recording
      try {
        await audioService.startRecording()
        setIsRecording(true)
      } catch (error) {
        console.error('Failed to start recording:', error)
        addMessage({
          role: 'assistant',
          content: `Microphone error: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      }
    }
  }, [addMessage, isRecording, settings.voiceSettings.enabled])

  // Speak AI responses if voice mode AND speakResponses are enabled
  useEffect(() => {
    if (!settings.voiceSettings.enabled || !settings.voiceSettings.speakResponses) return

    const lastMessage = messages[messages.length - 1]
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.status === 'done' && lastMessage.content) {
      if (lastSpokenMessageIdRef.current === lastMessage.id) return
      lastSpokenMessageIdRef.current = lastMessage.id

      // Speak the response
      const speakResponse = async () => {
        try {
          setIsSpeaking(true)
          await textToSpeechService.speak(lastMessage.content)
          setIsSpeaking(false)

          // Auto-listen if enabled
          if (settings.voiceSettings.autoListen && !isRecording) {
            setTimeout(() => {
              handleVoiceToggle()
            }, 500)
          }
        } catch (error) {
          console.error('TTS error:', error)
          setIsSpeaking(false)
        }
      }
      speakResponse()
    }
  }, [
    messages,
    settings.voiceSettings.enabled,
    settings.voiceSettings.speakResponses,
    settings.voiceSettings.autoListen,
    isRecording,
    handleVoiceToggle,
  ])

  const filteredModels = availableModels.filter(m => {
    if (settings.aiSettings.intelligenceMode === 'local') return m.type === 'local'
    if (settings.aiSettings.intelligenceMode === 'cloud') return m.type === 'cloud'
    return true
  })
  const activeModel = filteredModels.find(m => m.id === settings.aiSettings.preferredModelId) || filteredModels[0]

  return (
    <div
      className="flex flex-col h-screen relative"
      onDragOver={(e) => e.preventDefault()}
      onDrop={async (e) => {
        e.preventDefault()
        const files = Array.from(e.dataTransfer.files)
        if (files.length === 0) return

        for (const file of files) {
          if (file.type.startsWith('image/')) {
            if (file.size > 5 * 1024 * 1024) continue
            const reader = new FileReader()
            reader.onload = (e) => {
              const result = e.target?.result as string
              setPendingFiles(prev => [...prev, { name: file.name, content: result, type: 'image' }])
            }
            reader.readAsDataURL(file)
          }
        }
      }}
    >
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
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
            <OllamaInstaller />
            <div className="max-w-md text-center animate-in fade-in zoom-in duration-700 delay-200">
              <h2 className="text-xl font-semibold tracking-tight mb-1.5">Hello, I'm {settings.assistantName}</h2>
              <p className="text-[12px] text-muted-foreground">Your privacy-first AI companion. How can I help you today?</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="glass-input border-t border-white/20 px-4 py-3">
        {/* Knowledge Base Indicator */}
        {(() => {
          // Extract unique valid sources
          const validSources = [...new Set(knowledgeBase.map(kb => {
            const fileId = kb.fileId
            if (fileId.startsWith('github-')) {
              const match = fileId.match(/^github-(.+)-readme$/)
              return `📦 ${match ? match[1] : fileId.replace('github-', '')}`
            }
            if (fileId.startsWith('notion-')) {
              return `📝 ${fileId.replace('notion-', '')}`
            }
            // Local file lookup - only return name if it exists in store
            const file = files.find(f => f.id === fileId)
            return file ? `📄 ${file.filename}` : null
          }).filter(Boolean))]

          if (validSources.length === 0) return null

          return (
            <div className="flex items-center gap-2 mb-2.5 px-2 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <Database className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[12px] text-emerald-300 flex-1 truncate">
                {`${validSources.length} source${validSources.length > 1 ? 's' : ''} indexed: ${validSources.slice(0, 3).join(', ')}${validSources.length > 3 ? '...' : ''}`}
              </span>
            </div>
          )
        })()}

        {/* Pending Files Preview */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2.5">
            {pendingFiles.map((file, index) => (
              <div
                key={index}
                className="glass px-2.5 py-1 rounded-md flex items-center gap-2 text-[12px] border border-white/20"
              >
                <Paperclip className="h-3 w-3 opacity-60" />
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

        {/* Pending Context Preview (AI Prompts from Integrations) */}
        {pendingContext.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2.5">
            {pendingContext.map((ctx) => (
              <div
                key={ctx.id}
                className="glass px-2.5 py-1 rounded-md flex items-center gap-2 text-[12px] border border-blue-500/30 bg-blue-500/10"
              >
                <span className="text-blue-400">{ctx.title}</span>
                <button
                  onClick={() => removePendingContext(ctx.id)}
                  className="ml-1 hover:bg-white/10 rounded p-0.5 transition-colors text-blue-400/70 hover:text-red-400"
                  aria-label="Remove context"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          {/* Attachments & Tools */}
          <div className="flex flex-col gap-2">
            <Button
              variant={useVault ? "default" : "outline"}
              size="icon"
              onClick={() => setUseVault(!useVault)}
              className={cn(
                "h-9 w-9 rounded-lg transition-all",
                useVault
                  ? "bg-purple-500/20 text-purple-400 border-purple-500/50 hover:bg-purple-500/30"
                  : "bg-white/5 border-white/10 hover:bg-white/10 opacity-70 hover:opacity-100"
              )}
              title={useVault ? "Vault RAG Enabled" : "Vault RAG Disabled"}
            >
              <Brain className="h-4 w-4" />
            </Button>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".txt,.md,.pdf,.docx,.png,.jpg,.jpeg,.webp,.gif"
              onChange={handleFileUpload}
            />

            <Button
              variant="ghost"
              size="icon"
              className="glass-hover flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              title="Attach file"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="glass-hover flex-shrink-0"
              onClick={handleNativeFileOpen}
              title="Open in editor"
            >
              <FileEdit className="h-3.5 w-3.5" />
            </Button>

            {/* Voice Recording Button */}
            {settings.voiceSettings.enabled && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "glass-hover flex-shrink-0 transition-all duration-300",
                  isRecording && "bg-red-500/20 border-red-500/50 animate-pulse"
                )}
                onClick={handleVoiceToggle}
                title={isRecording ? "Stop recording" : "Start voice input"}
                disabled={isSpeaking}
              >
                {isRecording ? (
                  <MicOff className="h-3.5 w-3.5 text-red-400" />
                ) : (
                  <Mic className="h-3.5 w-3.5" />
                )}
              </Button>
            )}

          </div>

          <Input

            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="glass flex-1 border-white/20 focus-visible:border-white/40 h-9"
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
              "flex-shrink-0 h-9 w-9 transition-all duration-300 border border-white/10",
              (input.trim() || pendingFiles.length > 0 || isLoading) ? "bg-accent text-white" : "glass-strong"
            )}
            disabled={!input.trim() && pendingFiles.length === 0 && !isLoading}
          >
            {isLoading ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 px-1">
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
      {showOnboarding && <OnboardingGuide />}
    </div >
  )
}
