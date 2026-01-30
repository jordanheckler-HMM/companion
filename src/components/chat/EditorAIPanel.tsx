import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import logo from '@/assets/logo.png'

interface AIMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    codeBlock?: string
}

interface EditorAIPanelProps {
    messages: AIMessage[]
    onSendMessage: (message: string) => void
    onQuickAction: (action: 'explain' | 'refactor' | 'debug' | 'comment') => void
    onApplyCode: (code: string) => void
    loading: boolean
    selectedCode?: string
    fileName: string
    language: string
}

export function EditorAIPanel({
    messages,
    onSendMessage,
    onQuickAction,
    onApplyCode,
    loading,
    selectedCode,
    fileName,
    language
}: EditorAIPanelProps) {
    const { settings } = useStore()
    const [input, setInput] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = () => {
        if (!input.trim() || loading) return
        onSendMessage(input)
        setInput('')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const extractCodeBlock = (content: string): string | null => {
        const match = content.match(/```[\w]*\n([\s\S]*?)```/)
        return match ? match[1].trim() : null
    }

    return (
        <div className="flex flex-col h-full glass-strong border-l border-white/20">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/20">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-accent" />
                        <h3 className="font-semibold text-sm">AI Assistant</h3>
                    </div>
                </div>

                {/* Intelligence Mode Tabs */}
                <div className="flex items-center gap-2 mb-2">
                    <div className="flex glass-strong rounded-lg p-0.5 border border-white/5 w-fit">
                        {(['local', 'cloud'] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => {
                                    const { updateSettings, settings } = useStore.getState();
                                    updateSettings({ aiSettings: { ...settings.aiSettings, intelligenceMode: mode } });
                                }}
                                className={cn(
                                    "px-3 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all duration-200",
                                    settings.aiSettings.intelligenceMode === mode
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                )}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Model Picker */}
                <div className="mb-2">
                    <select
                        value={settings.aiSettings.preferredModelId}
                        onChange={(e) => {
                            const { updateSettings, settings } = useStore.getState();
                            updateSettings({ aiSettings: { ...settings.aiSettings, preferredModelId: e.target.value } });
                        }}
                        className="w-full glass-hover appearance-none bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] font-medium focus:ring-1 focus:ring-white/20 cursor-pointer outline-none"
                    >
                        {useStore.getState().availableModels
                            .filter(m => {
                                if (settings.aiSettings.intelligenceMode === 'local') return m.type === 'local'
                                if (settings.aiSettings.intelligenceMode === 'cloud') return m.type === 'cloud'
                                return true
                            })
                            .map(m => (
                                <option key={m.id} value={m.id} className="bg-background text-foreground">
                                    {m.type === 'local' ? '🏠 ' : '☁️ '}{m.displayName}
                                </option>
                            ))
                        }
                    </select>
                </div>

                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight opacity-50">
                    {fileName} • {language}
                </p>
            </div>

            {/* Quick Actions */}
            <div className="p-3 border-b border-white/20">
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onQuickAction('explain')}
                        disabled={loading}
                        className="glass-hover justify-start text-xs h-8"
                    >
                        🔍 Explain{selectedCode ? ' Selection' : ' File'}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onQuickAction('refactor')}
                        disabled={loading}
                        className="glass-hover justify-start text-xs h-8"
                    >
                        🔧 Refactor
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onQuickAction('debug')}
                        disabled={loading}
                        className="glass-hover justify-start text-xs h-8"
                    >
                        🐛 Find Bugs
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onQuickAction('comment')}
                        disabled={loading}
                        className="glass-hover justify-start text-xs h-8"
                    >
                        💬 Add Comments
                    </Button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="text-center text-muted-foreground text-sm py-12">
                        <div className="h-12 w-12 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-accent/20">
                            <Sparkles className="h-6 w-6 text-accent" />
                        </div>
                        <p className="font-semibold text-foreground mb-1">How can I help with {fileName}?</p>
                        <p className="text-xs opacity-60">I can explain, refactor, or debug this code.</p>
                    </div>
                )}

                {messages.map((message) => {
                    const isUser = message.role === 'user'
                    const codeBlock = extractCodeBlock(message.content)

                    return (
                        <div
                            key={message.id}
                            className={cn(
                                "flex flex-col gap-2",
                                isUser ? "items-end" : "items-start"
                            )}
                        >
                            {!isUser && (
                                <div className="flex items-center gap-2 mb-1 px-1">
                                    <div className="h-5 w-5 rounded-md overflow-hidden border border-white/20 relative bg-black">
                                        <img src={logo} alt="Logo" className="h-full w-full object-cover scale-110 mix-blend-screen" />
                                        <div className="absolute inset-0 bg-accent mix-blend-color opacity-70 pointer-events-none" />
                                    </div>
                                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">{settings.assistantName}</span>
                                </div>
                            )}

                            <div
                                className={cn(
                                    "max-w-[90%] rounded-2xl px-4 py-3 shadow-xl transition-all relative group",
                                    isUser
                                        ? "glass-message-user"
                                        : "glass-strong border border-white/10"
                                )}
                            >
                                {message.content && (
                                    <div className={cn(
                                        "prose prose-sm max-w-none break-words leading-relaxed",
                                        (settings.theme === 'dark' || settings.theme.startsWith('glass')) ? "prose-invert" : "prose-zinc"
                                    )}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {message.content}
                                        </ReactMarkdown>
                                    </div>
                                )}

                                {codeBlock && !isUser && (
                                    <div className="mt-4 pt-3 border-t border-white/5">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onApplyCode(codeBlock)}
                                            className="w-full text-[11px] h-8 bg-accent/10 hover:bg-accent/20 text-accent font-bold uppercase tracking-tighter"
                                        >
                                            <Sparkles className="h-3 w-3 mr-2" />
                                            Apply to Editor
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}

                {loading && (
                    <div className="flex flex-col gap-2 items-start">
                        <div className="flex items-center gap-2 mb-1 px-1">
                            <div className="h-5 w-5 rounded-md overflow-hidden border border-white/20 relative bg-black">
                                <img src={logo} alt="Logo" className="h-full w-full object-cover scale-110 mix-blend-screen" />
                                <div className="absolute inset-0 bg-accent mix-blend-color opacity-70 pointer-events-none" />
                            </div>
                            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">{settings.assistantName} is thinking...</span>
                        </div>
                        <div className="glass-strong border border-white/10 rounded-2xl px-4 py-3">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-white/20">
                <div className="flex gap-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about your code..."
                        className="glass flex-1 border-white/20 text-sm h-9"
                        disabled={loading}
                    />
                    <Button
                        onClick={handleSend}
                        size="icon"
                        disabled={!input.trim() || loading}
                        className="h-9 w-9 glass-hover"
                        style={{
                            backgroundColor: input.trim() ? 'rgb(var(--accent-rgb))' : undefined,
                            color: input.trim() ? 'white' : undefined
                        }}
                    >
                        <Send className="h-3.5 w-3.5" />
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 px-1">
                    {selectedCode ? '✓ Using selected code' : 'Using full file'}
                </p>
            </div>
        </div>
    )
}
