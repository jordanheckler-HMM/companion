import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { TeamService, Team, TeamThread, TeamMessage, TeamMember } from '@/services/TeamService'
import { AIService } from '@/services/aiService'
import { RAGService } from '@/services/ragService'
import { ModelRegistry } from '@/services/ModelRegistry'
import {
    Users, Plus, Hash, Send, Paperclip, X, Mic, MicOff,
    ChevronDown, Database, Brain, Square, UserPlus,
    Trash2, LogOut, Pencil, Check, Loader2, Upload, FileText, Trash, Settings,
    Cloud, Home, Sparkles, Shield, ShieldAlert
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import logo from '@/assets/logo.png'
import { speechToTextService } from '@/services/SpeechToTextService'

interface PendingFile {
    name: string
    content: string
    type: string
}

export function TeamWorkspace() {
    const { settings, updateSettings, availableModels, setAvailableModels } = useStore()

    // Team state
    const [teams, setTeams] = useState<Team[]>([])
    const [activeTeam, setActiveTeam] = useState<Team | null>(null)
    const [threads, setThreads] = useState<TeamThread[]>([])
    const [activeThread, setActiveThread] = useState<TeamThread | null>(null)
    const [members, setMembers] = useState<TeamMember[]>([])
    const [messages, setMessages] = useState<TeamMessage[]>([])

    // Chat state
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isStreaming, setIsStreaming] = useState(false)
    const [streamingContent, setStreamingContent] = useState('')
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
    const [useTeamVault, setUseTeamVault] = useState(true)
    const [vaultSources, setVaultSources] = useState<string[]>([])
    const [showVaultManager, setShowVaultManager] = useState(false)
    const [isIndexing, setIsIndexing] = useState(false)

    // Voice state
    const [isRecording, setIsRecording] = useState(false)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])

    // UI state
    const [showCreateThread, setShowCreateThread] = useState(false)
    const [showInvite, setShowInvite] = useState(false)
    const [newTeamName, setNewTeamName] = useState('')
    const [newThreadName, setNewThreadName] = useState('')
    const [inviteEmail, setInviteEmail] = useState('')

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const realtimeChannelRef = useRef<ReturnType<typeof TeamService.subscribeToThread> | null>(null)

    // Management state
    const [showTeamMenu, setShowTeamMenu] = useState(false)
    const [editTeamName, setEditTeamName] = useState('')
    const [isRenaming, setIsRenaming] = useState(false)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
    const [editThreadName, setEditThreadName] = useState('')

    // Load teams and current user on mount
    useEffect(() => {
        loadTeams()
        TeamService.getCurrentUserId().then(setCurrentUserId)
    }, [])

    // Load threads when team changes
    useEffect(() => {
        if (activeTeam) {
            loadThreads()
            loadMembers()
            loadVaultSources()
        }
    }, [activeTeam?.id])

    // Load messages and subscribe when thread changes
    useEffect(() => {
        if (activeThread) {
            // Clear old messages first, then load new ones
            setMessages([])

            const fetchAndSubscribe = async () => {
                const data = await TeamService.getMessages(activeThread.id)
                setMessages(data)

                // Now subscribe for future messages
                if (realtimeChannelRef.current) {
                    realtimeChannelRef.current.unsubscribe()
                }

                const channel = TeamService.subscribeToThread(activeThread.id, (newMessage) => {
                    setMessages(prev => {
                        // Avoid duplicates
                        if (prev.some(m => m.id === newMessage.id)) return prev
                        return [...prev, newMessage]
                    })
                })

                realtimeChannelRef.current = channel
            }

            fetchAndSubscribe()
        }

        return () => {
            if (realtimeChannelRef.current) {
                realtimeChannelRef.current.unsubscribe()
            }
        }
    }, [activeThread?.id])

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, streamingContent])

    const loadTeams = async () => {
        const data = await TeamService.getMyTeams()
        setTeams(data)
        if (data.length > 0 && !activeTeam) {
            setActiveTeam(data[0])
        }
    }

    const loadThreads = async () => {
        if (!activeTeam) return
        const data = await TeamService.getThreads(activeTeam.id)
        setThreads(data)
        if (data.length > 0 && !activeThread) {
            setActiveThread(data[0])
        }
    }

    const loadMembers = async () => {
        if (!activeTeam) return
        const data = await TeamService.getTeamMembers(activeTeam.id)
        setMembers(data)
    }

    const loadVaultSources = async () => {
        if (!activeTeam) return
        const sources = await TeamService.getTeamVaultSources(activeTeam.id)
        setVaultSources(sources)
    }

    const createTeam = async () => {
        if (!newTeamName.trim()) return
        try {
            const team = await TeamService.createTeam(newTeamName)
            if (team) {
                setTeams(prev => [team, ...prev])
                setActiveTeam(team)
                // Create default "General" thread
                const thread = await TeamService.createThread(team.id, 'General')
                if (thread) {
                    setThreads([thread])
                    setActiveThread(thread)
                }
            }
            setNewTeamName('')
        } catch (err: unknown) {
            console.error('Failed to create team:', err)
        }
    }

    const createThread = async () => {
        if (!newThreadName.trim() || !activeTeam) return
        try {
            const thread = await TeamService.createThread(activeTeam.id, newThreadName)
            if (thread) {
                setThreads(prev => [...prev, thread])
                setActiveThread(thread)
            }
            setNewThreadName('')
            setShowCreateThread(false)
        } catch (err: unknown) {
            console.error('Failed to create thread:', err)
        }
    }

    const handleUpdateThread = async (threadId: string) => {
        if (!editThreadName.trim()) return
        try {
            await TeamService.updateThread(threadId, editThreadName)
            setThreads(prev => prev.map(t => t.id === threadId ? { ...t, name: editThreadName } : t))
            if (activeThread?.id === threadId) {
                setActiveThread(prev => prev ? { ...prev, name: editThreadName } : null)
            }
            setEditingThreadId(null)
        } catch (err) {
            console.error('Failed to update thread:', err)
        }
    }

    const handleDeleteThread = async (threadId: string, threadName: string) => {
        if (!confirm(`Delete thread "#${threadName}"? All messages will be lost.`)) return
        try {
            await TeamService.deleteThread(threadId)
            setThreads(prev => prev.filter(t => t.id !== threadId))
            if (activeThread?.id === threadId) {
                setActiveThread(null)
            }
        } catch (err) {
            console.error('Failed to delete thread:', err)
        }
    }

    const inviteMember = async () => {
        if (!inviteEmail.trim() || !activeTeam) return
        try {
            await TeamService.inviteMember(activeTeam.id, inviteEmail)
            await loadMembers()
            setInviteEmail('')
            setShowInvite(false)
        } catch (err: unknown) {
            console.error('Failed to invite:', err)
            if (err instanceof Error) {
                alert(err.message)
            }
        }
    }

    const isOwner = activeTeam?.owner_id === currentUserId

    const handleDeleteTeam = async () => {
        if (!activeTeam) return
        if (!confirm(`Are you sure you want to delete "${activeTeam.name}"? This cannot be undone.`)) return

        try {
            await TeamService.deleteTeam(activeTeam.id)
            setTeams(prev => prev.filter(t => t.id !== activeTeam.id))
            setActiveTeam(teams.length > 1 ? teams.find(t => t.id !== activeTeam.id) || null : null)
        } catch (err) {
            console.error('Failed to delete team:', err)
            alert('Failed to delete team')
        }
    }

    const handleLeaveTeam = async () => {
        if (!activeTeam) return
        if (!confirm(`Are you sure you want to leave "${activeTeam.name}"?`)) return

        try {
            await TeamService.leaveTeam(activeTeam.id)
            setTeams(prev => prev.filter(t => t.id !== activeTeam.id))
            setActiveTeam(teams.length > 1 ? teams.find(t => t.id !== activeTeam.id) || null : null)
        } catch (err) {
            console.error('Failed to leave team:', err)
            alert('Failed to leave team')
        }
    }

    const handleRenameTeam = async () => {
        if (!activeTeam || !editTeamName.trim()) return

        try {
            await TeamService.updateTeam(activeTeam.id, editTeamName)
            setTeams(prev => prev.map(t => t.id === activeTeam.id ? { ...t, name: editTeamName } : t))
            setActiveTeam({ ...activeTeam, name: editTeamName })
            setIsRenaming(false)
        } catch (err) {
            console.error('Failed to rename team:', err)
            alert('Failed to rename team')
        }
    }

    const handleRemoveMember = async (userId: string, username: string) => {
        if (!activeTeam) return
        if (!confirm(`Remove ${username} from the team?`)) return

        try {
            await TeamService.removeMember(activeTeam.id, userId)
            await loadMembers()
        } catch (err) {
            console.error('Failed to remove member:', err)
            alert('Failed to remove member')
        }
    }

    const handleUpdateMemberRole = async (userId: string, role: 'admin' | 'member') => {
        if (!activeTeam) return
        try {
            await TeamService.updateMemberRole(activeTeam.id, userId, role)
            await loadMembers()
        } catch (err) {
            console.error('Failed to update member role:', err)
            alert('Failed to update role')
        }
    }

    const handleDeleteVaultSource = async (source: string) => {
        if (!activeTeam) return
        if (!confirm(`Remove "${source}" and all its knowledge from the team vault?`)) return

        try {
            await TeamService.deleteTeamVaultSource(activeTeam.id, source)
            await loadVaultSources()
        } catch (err) {
            console.error('Failed to delete vault source:', err)
            alert('Failed to delete vault source')
        }
    }

    const handleVaultUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!activeTeam || !e.target.files?.[0]) return
        const file = e.target.files[0]

        setIsIndexing(true)
        try {
            const reader = new FileReader()
            reader.onload = async (event) => {
                const content = event.target?.result as string
                const ragService = new RAGService(settings.aiSettings)
                const embedding = await ragService.generateEmbedding(content.substring(0, 3000))

                await TeamService.indexToTeamVault(activeTeam.id, content, file.name, embedding)
                await loadVaultSources()
                alert('Successfully added to team vault')
            }
            reader.readAsText(file)
        } catch (err) {
            console.error('Failed to upload to vault:', err)
            alert('Failed to upload to vault')
        } finally {
            setIsIndexing(false)
        }
    }

    const handleSend = async () => {
        if (!input.trim() && pendingFiles.length === 0) return
        if (!activeThread) return

        const userMessage = input.trim()
        setInput('')
        setIsLoading(true)

        // Build context from files
        let context = ''
        if (pendingFiles.length > 0) {
            context = pendingFiles.map(f => `[File: ${f.name}]\n${f.content}`).join('\n\n')
            setPendingFiles([])
        }

        // Send human message
        await TeamService.sendMessage(activeThread.id, userMessage, 'human')

        // Build AI prompt with context
        let fullPrompt = userMessage
        if (context) {
            fullPrompt = `${context}\n\n${userMessage}`
        }

        // Get team vault context if enabled
        if (useTeamVault && activeTeam) {
            try {
                const ragService = new RAGService(settings.aiSettings)
                const queryEmbedding = await ragService.generateEmbedding(userMessage)

                if (queryEmbedding) {
                    const teamResults = await TeamService.searchTeamVault(activeTeam.id, queryEmbedding, 3)

                    if (teamResults.length > 0) {
                        const vaultContext = teamResults.map(c => c.content).join('\n\n')
                        fullPrompt = `[Team Knowledge Context]\n${vaultContext}\n\n[User Question]\n${userMessage}`
                    }
                }
            } catch (err) {
                console.warn('Team vault search failed:', err)
            }
        }

        // Stream AI response
        setIsStreaming(true)
        setStreamingContent('')

        try {
            const modelId = settings.aiSettings.preferredModelId ||
                (settings.aiSettings.intelligenceMode === 'local'
                    ? settings.aiSettings.ollamaModel
                    : 'gpt-4o')

            const modelInfo = ModelRegistry.getInstance().getModelById(modelId)
            const modelLabel = modelInfo?.displayName || modelId

            let fullResponse = ''
            const aiService = new AIService(settings.aiSettings)

            // Convert team messages to AI conversation history
            // We take the last 15 messages for context to keep it snappy
            const history: any[] = messages.slice(-15).map(m => ({
                role: m.sender_type === 'model' ? 'assistant' : 'user',
                content: m.sender_type === 'model' ? m.content : `${m.sender_name}: ${m.content}`
            }))

            // Add the current message with its context (vault + files)
            history.push({
                role: 'user',
                content: `(Current Message) ${fullPrompt}`
            })

            // Add a system instruction hidden from UI but passed to AI
            const teamContextMsg = {
                role: 'system',
                content: `You are participating in a group chat for the team "${activeTeam?.name || 'Unknown'}" in the channel "#${activeThread?.name || 'Unknown'}". 
                Every user message is prefixed with their name (e.g., "Name: message"). 
                Maintain context of who said what. ${useTeamVault ? 'You have access to the Team Vault and should prioritize its information if relevant.' : ''}`
            }

            await aiService.streamMessage(
                [teamContextMsg, ...history],
                (chunk: string) => {
                    fullResponse += chunk
                    setStreamingContent(fullResponse)
                },
                modelId
            )

            // Send AI response as message
            await TeamService.sendMessage(
                activeThread.id,
                fullResponse,
                'model',
                modelLabel,
                { modelId }
            )

            setStreamingContent('')
        } catch (err: unknown) {
            if (err instanceof Error && err.name !== 'AbortError') {
                console.error('AI error:', err)
                await TeamService.sendMessage(
                    activeThread.id,
                    `Error: ${err.message}`,
                    'model',
                    'System'
                )
            }
        } finally {
            setIsLoading(false)
            setIsStreaming(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files) return

        for (const file of Array.from(files)) {
            const reader = new FileReader()
            reader.onload = async (event) => {
                const content = event.target?.result as string
                setPendingFiles(prev => [...prev, {
                    name: file.name,
                    content: content.slice(0, 10000), // Limit content
                    type: file.type
                }])
            }
            reader.readAsText(file)
        }
        e.target.value = ''
    }

    const removePendingFile = (index: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index))
    }

    const handleVoiceToggle = async () => {
        if (isRecording) {
            // Stop recording
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop()
            }
            setIsRecording(false)
        } else {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                const mediaRecorder = new MediaRecorder(stream)
                mediaRecorderRef.current = mediaRecorder
                audioChunksRef.current = []

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        audioChunksRef.current.push(e.data)
                    }
                }

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
                    stream.getTracks().forEach(track => track.stop())

                    try {
                        const transcript = await speechToTextService.transcribe(audioBlob)
                        setInput(prev => prev + transcript)
                    } catch (err) {
                        console.error('Transcription error:', err)
                    }
                }

                mediaRecorder.start()
                setIsRecording(true)
            } catch (err) {
                console.error('Microphone error:', err)
            }
        }
    }

    // If no teams, show create team UI
    if (teams.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
                    <Users className="h-16 w-16 mx-auto mb-4 text-[rgb(var(--accent-rgb))]" />
                    <h2 className="text-2xl font-bold mb-2">Create Your First Team</h2>
                    <p className="text-foreground/60 mb-6">
                        Teams let you collaborate with others using shared AI agents and knowledge.
                    </p>
                    <div className="flex gap-2">
                        <Input
                            value={newTeamName}
                            onChange={(e) => setNewTeamName(e.target.value)}
                            placeholder="Team name..."
                            className="flex-1"
                            onKeyDown={(e) => e.key === 'Enter' && createTeam()}
                        />
                        <Button onClick={createTeam} disabled={!newTeamName.trim()}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex h-full">
            {/* Team Sidebar */}
            <div className="w-64 glass-sidebar flex flex-col border-r border-white/10">
                {/* Team Selector with Dropdown */}
                <div className="p-3 border-b border-white/10">
                    <button
                        onClick={() => setShowTeamMenu(!showTeamMenu)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg glass hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-[rgb(var(--accent-rgb))]" />
                            {isRenaming ? (
                                <Input
                                    value={editTeamName}
                                    onChange={(e) => setEditTeamName(e.target.value)}
                                    className="h-6 text-sm px-1 w-32"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleRenameTeam()
                                        if (e.key === 'Escape') setIsRenaming(false)
                                    }}
                                />
                            ) : (
                                <span className="font-semibold truncate">{activeTeam?.name}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {isRenaming ? (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleRenameTeam() }}
                                    className="p-1 rounded hover:bg-white/10"
                                >
                                    <Check className="h-3 w-3 text-green-400" />
                                </button>
                            ) : (
                                <ChevronDown className={cn(
                                    "h-4 w-4 text-foreground/40 transition-transform",
                                    showTeamMenu && "rotate-180"
                                )} />
                            )}
                        </div>
                    </button>
                </div>

                {/* Team Dropdown Menu - Fixed Positioning */}
                {showTeamMenu && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowTeamMenu(false)}
                        />

                        {/* Dropdown */}
                        <div className="absolute left-3 right-3 top-[4.5rem] bg-[#1a1a1a] rounded-lg border border-white/20 shadow-2xl z-50 overflow-hidden">
                            {/* Team List */}
                            <div className="max-h-48 overflow-y-auto">
                                {teams.map(team => (
                                    <button
                                        key={team.id}
                                        onClick={() => {
                                            setActiveTeam(team)
                                            setActiveThread(null)
                                            setThreads([])
                                            setShowTeamMenu(false)
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                                            activeTeam?.id === team.id
                                                ? "bg-[rgb(var(--accent-rgb))]/20 text-[rgb(var(--accent-rgb))]"
                                                : "hover:bg-white/5"
                                        )}
                                    >
                                        <Users className="h-3.5 w-3.5" />
                                        <span className="truncate flex-1">{team.name}</span>
                                        {team.owner_id === currentUserId && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">Owner</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Management Actions */}
                            <div className="border-t border-white/10 p-1">
                                {isOwner ? (
                                    <>
                                        <button
                                            onClick={() => {
                                                setEditTeamName(activeTeam?.name || '')
                                                setIsRenaming(true)
                                                setShowTeamMenu(false)
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 rounded text-foreground/70"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                            Rename Team
                                        </button>
                                        <button
                                            onClick={() => { setShowTeamMenu(false); handleDeleteTeam() }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-500/10 rounded text-red-400"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete Team
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => { setShowTeamMenu(false); handleLeaveTeam() }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-500/10 rounded text-red-400"
                                    >
                                        <LogOut className="h-3.5 w-3.5" />
                                        Leave Team
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setShowTeamMenu(false)
                                        setNewTeamName('')
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 rounded text-foreground/70"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Create New Team
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* Threads List */}
                <div className="flex-1 overflow-y-auto p-2">
                    <div className="flex items-center justify-between px-2 py-1 mb-2">
                        <span className="text-xs font-bold text-foreground/40 uppercase tracking-wider">Threads</span>
                        <button
                            onClick={() => setShowCreateThread(!showCreateThread)}
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                        >
                            <Plus className="h-4 w-4 text-foreground/60" />
                        </button>
                    </div>

                    {showCreateThread && (
                        <div className="mb-2 px-2">
                            <Input
                                value={newThreadName}
                                onChange={(e) => setNewThreadName(e.target.value)}
                                placeholder="Thread name..."
                                className="text-sm"
                                onKeyDown={(e) => e.key === 'Enter' && createThread()}
                                autoFocus
                            />
                        </div>
                    )}

                    {threads.map(thread => (
                        <div key={thread.id} className="group relative">
                            {editingThreadId === thread.id ? (
                                <div className="px-2 py-1">
                                    <Input
                                        value={editThreadName}
                                        onChange={(e) => setEditThreadName(e.target.value)}
                                        className="h-8 text-sm"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleUpdateThread(thread.id)
                                            if (e.key === 'Escape') setEditingThreadId(null)
                                        }}
                                        autoFocus
                                        onBlur={() => setEditingThreadId(null)}
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 group/item">
                                    <button
                                        onClick={() => setActiveThread(thread)}
                                        className={cn(
                                            "flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
                                            activeThread?.id === thread.id
                                                ? "bg-[rgb(var(--accent-rgb))]/20 text-[rgb(var(--accent-rgb))]"
                                                : "hover:bg-white/5 text-foreground/70"
                                        )}
                                    >
                                        <Hash className="h-4 w-4" />
                                        <span className="truncate text-sm">{thread.name}</span>
                                    </button>

                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                        {(isOwner || thread.created_by === currentUserId) && (
                                            <>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setEditingThreadId(thread.id)
                                                        setEditThreadName(thread.name)
                                                    }}
                                                    className="p-1 rounded hover:bg-white/10 text-foreground/40 hover:text-foreground/70"
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDeleteThread(thread.id, thread.name)
                                                    }}
                                                    className="p-1 rounded hover:bg-red-500/10 text-foreground/40 hover:text-red-400"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-2 border-t border-white/10">
                    <div className="flex items-center justify-between px-2 py-1 mb-2">
                        <span className="text-xs font-bold text-foreground/40 uppercase tracking-wider">Team Vault</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-foreground/40">{vaultSources.length}</span>
                            <button
                                onClick={() => setShowVaultManager(true)}
                                className="p-1 rounded hover:bg-white/10 text-foreground/40 hover:text-foreground/80 transition-colors"
                            >
                                <Settings className="h-3 w-3" />
                            </button>
                        </div>
                    </div>
                    {vaultSources.slice(0, 3).map((source, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1 text-xs text-foreground/60">
                            <Database className="h-3 w-3" />
                            <span className="truncate">{source}</span>
                        </div>
                    ))}
                </div>

                {/* Members Section with Management */}
                <div className="p-2 border-t border-white/10">
                    <div className="flex items-center justify-between px-2 py-1 mb-2">
                        <span className="text-xs font-bold text-foreground/40 uppercase tracking-wider">Members ({members.length})</span>
                        <button
                            onClick={() => setShowInvite(!showInvite)}
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                        >
                            <UserPlus className="h-4 w-4 text-foreground/60" />
                        </button>
                    </div>

                    {showInvite && (
                        <div className="mb-2 px-2 flex gap-1">
                            <Input
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="Email..."
                                className="text-sm flex-1"
                                onKeyDown={(e) => e.key === 'Enter' && inviteMember()}
                            />
                            <Button size="sm" onClick={inviteMember}>
                                <Plus className="h-3 w-3" />
                            </Button>
                        </div>
                    )}

                    <div className="space-y-1 px-2">
                        {members.map(member => (
                            <div
                                key={member.user_id}
                                className="flex items-center gap-2 py-1 group"
                            >
                                <Avatar className="h-6 w-6 border border-white/10">
                                    <AvatarFallback className="text-xs bg-[rgb(var(--accent-rgb))]/20">
                                        {member.profile?.username?.[0]?.toUpperCase() || '?'}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-foreground/70 truncate flex-1">
                                    {member.profile?.username || 'Unknown'}
                                </span>
                                {member.role === 'admin' && (
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-400">Admin</span>
                                )}
                                {isOwner && member.user_id !== currentUserId && (
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleUpdateMemberRole(member.user_id, member.role === 'admin' ? 'member' : 'admin')}
                                            className={cn(
                                                "p-1 rounded hover:bg-white/10 transition-colors",
                                                member.role === 'admin' ? "text-yellow-400" : "text-foreground/40"
                                            )}
                                            title={member.role === 'admin' ? "Revoke Admin" : "Promote to Admin"}
                                        >
                                            {member.role === 'admin' ? <ShieldAlert className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                                        </button>
                                        <button
                                            onClick={() => handleRemoveMember(member.user_id, member.profile?.username || 'this member')}
                                            className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-opacity"
                                            title="Remove from Team"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
                {/* Thread Header */}
                <div className="h-14 glass border-b border-white/10 flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                        <Hash className="h-5 w-5 text-[rgb(var(--accent-rgb))]" />
                        <span className="font-semibold">{activeThread?.name || 'Select a thread'}</span>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Intelligence Mode Tabs */}
                        <div className="flex glass rounded-lg p-0.5 border border-white/5">
                            {(['local', 'cloud'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => updateSettings({ aiSettings: { ...settings.aiSettings, intelligenceMode: mode } })}
                                    className={cn(
                                        "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all duration-200",
                                        settings.aiSettings.intelligenceMode === mode
                                            ? "bg-[rgb(var(--accent-rgb))] text-white shadow-lg"
                                            : "text-foreground/40 hover:text-foreground/60 hover:bg-white/5"
                                    )}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>

                        {/* Model Selector */}
                        {(() => {
                            const filteredModels = availableModels.filter(m => {
                                if (settings.aiSettings.intelligenceMode === 'local') return m.type === 'local'
                                if (settings.aiSettings.intelligenceMode === 'cloud') return m.type === 'cloud'
                                return true
                            })
                            const activeModel = filteredModels.find(m => m.id === settings.aiSettings.preferredModelId) || filteredModels[0]

                            return (
                                <div className="relative group/model">
                                    <div className="flex items-center gap-1.5 glass-hover px-2.5 py-1 rounded-lg cursor-pointer border border-white/5 hover:border-white/20 transition-all">
                                        <div
                                            className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                activeModel?.type === 'local' ? "bg-green-400" : "bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                            )}
                                        />
                                        <span className="text-[11px] font-semibold whitespace-nowrap">
                                            {activeModel?.displayName || 'Select Model'}
                                        </span>
                                        <ChevronDown className="h-3 w-3 opacity-30" />
                                    </div>

                                    {/* Dropdown */}
                                    <div className="absolute top-full right-0 mt-2 w-64 bg-[#0c0c0c] border border-white/20 rounded-2xl shadow-2xl opacity-0 invisible group-hover/model:opacity-100 group-hover/model:visible transition-all duration-200 z-[100] p-3 backdrop-blur-3xl">
                                        <div className="px-1 mb-2 flex items-center justify-between">
                                            <span className="text-[10px] uppercase font-black tracking-widest text-[rgb(var(--accent-rgb))]">Models</span>
                                            <button
                                                onClick={async () => {
                                                    const aiService = new AIService(settings.aiSettings)
                                                    await aiService.getModels()
                                                    setAvailableModels(ModelRegistry.getInstance().getAllModels())
                                                }}
                                                className="p-1 px-1.5 rounded-lg bg-white/5 hover:bg-[rgb(var(--accent-rgb))]/20 transition-all"
                                            >
                                                <Sparkles className="h-3 w-3" />
                                            </button>
                                        </div>

                                        <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                                            {filteredModels.map((m) => (
                                                <div
                                                    key={m.id}
                                                    onClick={() => updateSettings({ aiSettings: { ...settings.aiSettings, preferredModelId: m.id } })}
                                                    className={cn(
                                                        "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200 border",
                                                        settings.aiSettings.preferredModelId === m.id
                                                            ? "bg-[rgb(var(--accent-rgb))]/10 border-[rgb(var(--accent-rgb))]/40"
                                                            : "bg-transparent border-transparent hover:bg-white/5"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center justify-center w-5 h-5">
                                                            {m.type === 'local' ? (
                                                                <Home className="h-3 w-3 text-green-400/70" />
                                                            ) : (
                                                                <Cloud className="h-3 w-3 text-blue-400/70" />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-white/90 leading-tight">{m.displayName}</span>
                                                            <span className="text-[9px] text-white/30 uppercase tracking-tighter font-medium">{m.provider}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}

                        <div className="h-6 w-px bg-white/10 mx-1" />

                        <button
                            onClick={() => setUseTeamVault(!useTeamVault)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                                useTeamVault
                                    ? "bg-[rgb(var(--accent-rgb))]/20 text-[rgb(var(--accent-rgb))] border border-[rgb(var(--accent-rgb))]/30"
                                    : "glass text-foreground/60"
                            )}
                        >
                            <Brain className="h-3.5 w-3.5" />
                            Team Vault
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map(msg => (
                        <MessageBubble key={msg.id} message={msg} theme={settings.theme} />
                    ))}

                    {/* Streaming message */}
                    {isStreaming && streamingContent && (
                        <div className="flex gap-3">
                            <Avatar className="h-8 w-8 border border-white/10 bg-black">
                                <img src={logo} alt="AI" className="h-full w-full object-cover scale-110 mix-blend-screen" />
                                <div className="absolute inset-0 bg-accent mix-blend-color opacity-70 pointer-events-none" />
                            </Avatar>
                            <div className="glass-message px-4 py-3 rounded-2xl max-w-[85%]">
                                <div className="prose prose-sm max-w-none prose-invert">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {streamingContent}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 glass-input">
                    {/* Pending Files */}
                    {pendingFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {pendingFiles.map((file, i) => (
                                <div key={i} className="glass px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                                    <Paperclip className="h-3.5 w-3.5" />
                                    <span className="truncate max-w-[150px]">{file.name}</span>
                                    <button onClick={() => removePendingFile(i)} className="hover:text-red-400">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        {/* File Upload */}
                        <label className="p-2 rounded-lg glass hover:bg-white/10 cursor-pointer transition-colors">
                            <Paperclip className="h-5 w-5 text-foreground/60" />
                            <input type="file" className="hidden" multiple onChange={handleFileUpload} />
                        </label>

                        {/* Voice */}
                        <button
                            onClick={handleVoiceToggle}
                            className={cn(
                                "p-2 rounded-lg transition-colors",
                                isRecording ? "bg-red-500/20 text-red-400" : "glass hover:bg-white/10 text-foreground/60"
                            )}
                        >
                            {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                        </button>

                        {/* Input */}
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={`Message #${activeThread?.name || 'thread'}...`}
                            className="flex-1"
                            disabled={isLoading || !activeThread}
                        />

                        {/* Send / Stop */}
                        {isStreaming ? (
                            <Button variant="destructive" disabled>
                                <Square className="h-4 w-4" />
                            </Button>
                        ) : (
                            <Button onClick={handleSend} disabled={isLoading || (!input.trim() && pendingFiles.length === 0)}>
                                <Send className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
                {/* Vault Manager Modal */}
                {showVaultManager && activeTeam && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowVaultManager(false)}
                        />
                        <div className="relative w-full max-w-2xl bg-[#1a1a1a] border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Database className="h-5 w-5 text-[rgb(var(--accent-rgb))]" />
                                    <h2 className="text-lg font-semibold">Team Vault Management</h2>
                                </div>
                                <button
                                    onClick={() => setShowVaultManager(false)}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-6 flex-1 overflow-y-auto">
                                <div className="mb-6">
                                    <h3 className="text-sm font-semibold mb-2 text-foreground/60 uppercase tracking-wider">Add Knowledge</h3>
                                    <div className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center gap-4 hover:border-white/20 transition-colors relative">
                                        <input
                                            type="file"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={handleVaultUpload}
                                            disabled={isIndexing}
                                        />
                                        {isIndexing ? (
                                            <Loader2 className="h-8 w-8 text-[rgb(var(--accent-rgb))] animate-spin" />
                                        ) : (
                                            <Upload className="h-8 w-8 text-foreground/20" />
                                        )}
                                        <div className="text-center">
                                            <p className="font-medium text-foreground/80">Click or drag to upload knowledge</p>
                                            <p className="text-xs text-foreground/40 mt-1">Files will be indexed and shared with the entire team</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-semibold mb-2 text-foreground/60 uppercase tracking-wider">Indexed Sources ({vaultSources.length})</h3>
                                    <div className="space-y-2">
                                        {vaultSources.map((source, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 glass rounded-lg group">
                                                <div className="flex items-center gap-3">
                                                    <FileText className="h-4 w-4 text-foreground/40" />
                                                    <span className="text-sm font-medium">{source}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteVaultSource(source)}
                                                    className="p-2 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded-lg transition-all"
                                                >
                                                    <Trash className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                        {vaultSources.length === 0 && (
                                            <div className="text-center py-8 text-foreground/40">
                                                <Database className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                                <p className="text-sm">No knowledge indexed yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// Message bubble component
interface MessageBubbleProps {
    message: TeamMessage
    theme: string
}

function MessageBubble({ message, theme }: MessageBubbleProps) {
    const isHuman = message.sender_type === 'human'
    const isAgent = message.sender_type === 'agent'

    return (
        <div className={cn(
            "flex gap-3",
            isHuman ? "flex-row-reverse" : "flex-row"
        )}>
            <Avatar className="h-8 w-8 flex-shrink-0 border border-white/10">
                {!isHuman && (
                    <>
                        <img src={logo} alt="AI" className="h-full w-full object-cover scale-110 mix-blend-screen" />
                        <div className="absolute inset-0 bg-accent mix-blend-color opacity-70 pointer-events-none" />
                    </>
                )}
                <AvatarFallback className={isHuman ? "bg-background/20" : ""}>
                    {isHuman ? message.sender_name?.[0]?.toUpperCase() || 'U' : ''}
                </AvatarFallback>
            </Avatar>

            <div className={cn(
                "px-4 py-3 rounded-2xl max-w-[85%] shadow-lg",
                isHuman ? "glass-message-user" : "glass-message"
            )}>
                {/* Sender label */}
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-foreground/60">
                        {message.sender_name}
                    </span>
                    {message.sender_type !== 'human' && (
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                            isAgent ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                        )}>
                            {isAgent ? 'Agent' : 'AI'}
                        </span>
                    )}
                </div>

                <div className={cn(
                    "prose prose-sm max-w-none break-words",
                    (theme === 'dark' || theme.startsWith('glass')) ? "prose-invert" : "prose-zinc"
                )}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                    </ReactMarkdown>
                </div>

                <span className="text-[10px] text-foreground/40 font-medium block mt-2">
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    )
}
