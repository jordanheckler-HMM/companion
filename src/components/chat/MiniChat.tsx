import { useState, useRef, useEffect } from 'react'
import { Send, X, Sparkles, Trash2, Home, Cloud } from 'lucide-react'
import { useStore } from '@/store'
import { AIService } from '@/services/aiService'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getCurrentWindow } from '@tauri-apps/api/window'
import logo from '@/assets/logo.png'

interface MiniMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    status?: 'thinking' | 'done' | 'error'
}

export const MiniChat = () => {
    const { settings, updateSettings, availableModels } = useStore()

    // Mini chat has its own local message state, separate from the main app
    const [miniMessages, setMiniMessages] = useState<MiniMessage[]>([])
    const [input, setInput] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Get the current mode from main app settings
    const currentMode = settings.aiSettings.intelligenceMode

    // Filter models based on current mode
    const filteredModels = availableModels.filter(m => {
        if (currentMode === 'local') return m.type === 'local'
        if (currentMode === 'cloud') return m.type === 'cloud'
        return true
    })

    // Get the active model (same as main app's selected model for current mode)
    const activeModel = filteredModels.find(m => m.id === settings.aiSettings.preferredModelId) || filteredModels[0]

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }

    useEffect(() => {
        scrollToBottom()
    }, [miniMessages])

    const addMiniMessage = (message: Omit<MiniMessage, 'id'>): string => {
        const id = crypto.randomUUID()
        setMiniMessages(prev => [...prev, { ...message, id }])
        return id
    }

    const updateMiniMessage = (id: string, content: string, status?: 'thinking' | 'done' | 'error') => {
        setMiniMessages(prev => prev.map(m =>
            m.id === id ? { ...m, content, ...(status ? { status } : {}) } : m
        ))
    }

    const clearMiniMessages = () => {
        setMiniMessages([])
    }

    const toggleMode = (mode: 'local' | 'cloud') => {
        updateSettings({ aiSettings: { ...settings.aiSettings, intelligenceMode: mode } })
    }

    const handleSend = async () => {
        if (!input.trim() || isStreaming) return

        const userContent = input
        addMiniMessage({
            role: 'user',
            content: userContent
        })

        setInput('')
        setIsStreaming(true)

        const assistantId = addMiniMessage({
            role: 'assistant',
            content: '',
            status: 'thinking'
        })

        try {
            const aiService = new AIService(settings.aiSettings)
            let fullContent = ''

            // Build conversation history from mini messages
            const conversationHistory = [
                { role: 'system' as const, content: settings.systemPrompt },
                ...miniMessages.map(m => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content
                })),
                { role: 'user' as const, content: userContent }
            ]

            await aiService.streamMessage(
                conversationHistory,
                (chunk) => {
                    fullContent += chunk
                    updateMiniMessage(assistantId, fullContent, 'done')
                },
                settings.aiSettings.preferredModelId
            )

            if (!fullContent) {
                updateMiniMessage(assistantId, 'No response received', 'error')
            }
        } catch (error) {
            updateMiniMessage(assistantId, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
        } finally {
            setIsStreaming(false)
        }
    }

    const closePanel = async () => {
        console.log('[MiniChat] Close button clicked')
        try {
            const win = getCurrentWindow()
            console.log('[MiniChat] Got window:', win.label)
            await win.hide()
            console.log('[MiniChat] Window hidden')
        } catch (err) {
            console.error('[MiniChat] Failed to hide window:', err)
        }
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden animate-in fade-in transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-md cursor-default select-none relative">
                {/* Drag Handle */}
                <div className="absolute inset-0 z-0" data-tauri-drag-region />

                <div className="flex items-center gap-2 pointer-events-none relative z-10 font-medium">
                    <div className="w-3 h-3" style={{
                        maskImage: `url(${logo})`,
                        maskSize: 'contain',
                        maskRepeat: 'no-repeat',
                        maskPosition: 'center',
                        WebkitMaskImage: `url(${logo})`,
                        WebkitMaskSize: 'contain',
                        WebkitMaskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                        backgroundColor: 'rgb(var(--accent-rgb))'
                    }} />
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-70">Companion</span>
                </div>

                <div className="flex items-center gap-2 relative z-20">
                    {/* Clear Chat Button */}
                    <button
                        onClick={clearMiniMessages}
                        className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                        title="Clear chat"
                    >
                        <Trash2 className="w-3.5 h-3.5 opacity-50 hover:opacity-100" />
                    </button>

                    {/* Close Button */}
                    <button
                        onClick={closePanel}
                        className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4 opacity-50" />
                    </button>
                </div>
            </div>

            {/* Mode Toggle & Model Info Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/10 backdrop-blur-sm">
                {/* Local/Cloud Toggle */}
                <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/5">
                    {(['local', 'cloud'] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => toggleMode(mode)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${currentMode === mode
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                                }`}
                        >
                            {mode === 'local' ? (
                                <Home className="w-2.5 h-2.5" />
                            ) : (
                                <Cloud className="w-2.5 h-2.5" />
                            )}
                            {mode}
                        </button>
                    ))}
                </div>

                {/* Active Model Display */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5">
                    <div className={`w-1.5 h-1.5 rounded-full ${activeModel?.type === 'local' ? 'bg-green-400' : 'bg-blue-400'
                        }`} />
                    <span className="text-[9px] font-medium text-white/60 truncate max-w-[100px]">
                        {activeModel?.displayName || activeModel?.label || settings.aiSettings.preferredModelId || 'No model'}
                    </span>
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth custom-scrollbar">
                {miniMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full opacity-30 text-center px-10">
                        <Sparkles className="w-10 h-10 mb-4 text-accent" />
                        <p className="text-xs uppercase tracking-widest">How can I help you today?</p>
                    </div>
                )}
                {miniMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`
                            max-w-[90%] p-3 rounded-2xl text-sm leading-relaxed
                            ${msg.role === 'user'
                                ? 'bg-accent text-white rounded-tr-none shadow-lg'
                                : 'bg-white/5 border border-white/10 rounded-tl-none backdrop-blur-sm text-white/90'
                            }
                        `}>
                            {msg.role === 'user' ? (
                                // User messages: plain text with better readability
                                <p className="text-white font-medium whitespace-pre-wrap break-words">{msg.content}</p>
                            ) : (
                                // Assistant messages: markdown rendered
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        pre: ({ children, className }) => {
                                            return <div className={`bg-black/30 p-2 rounded my-2 overflow-x-auto ${className || ''}`}>{children}</div>
                                        },
                                        code: ({ ...props }) => {
                                            const { node, ...rest } = props;
                                            return <code className="bg-black/20 px-1 rounded text-white/90" {...rest} />
                                        },
                                        p: ({ children }) => <p className="text-white/90 mb-2 last:mb-0">{children}</p>
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                            )}
                            {msg.status === 'thinking' && (
                                <div className="flex gap-1 mt-2">
                                    <div className="w-1 h-1 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <div className="w-1 h-1 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <div className="w-1 h-1 bg-accent rounded-full animate-bounce" />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Overlay */}
            <div className="p-4 bg-black/40 backdrop-blur-2xl border-t border-white/10">
                <div className="relative group">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSend()
                            }
                        }}
                        placeholder="Type a message..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/40 transition-all resize-none max-h-32"
                        rows={1}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isStreaming}
                        className="absolute right-2 bottom-2 p-2 bg-accent text-white rounded-lg disabled:opacity-20 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-accent/20 cursor-pointer"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}
