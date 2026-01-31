import { useState, useEffect } from 'react'
import { useStore, AgentBlueprint } from '@/store'
import {
    X, Save, Bot, Sparkles, Wrench, Cpu, Brain, Zap, Search,
    FileText, Terminal, Layout, MessageSquare, Shield, Globe,
    LineChart, Code, Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AIService } from '@/services/aiService'
import { ToolSelector } from './ToolSelector'
import { cn } from '@/lib/utils'

interface AgentEditorProps {
    agentId?: string // If provided, editing existing agent
    onClose: () => void
}

export const ICON_OPTIONS = [
    { id: 'Bot', icon: Bot },
    { id: 'Sparkles', icon: Sparkles },
    { id: 'Cpu', icon: Cpu },
    { id: 'Brain', icon: Brain },
    { id: 'Zap', icon: Zap },
    { id: 'Search', icon: Search },
    { id: 'FileText', icon: FileText },
    { id: 'Terminal', icon: Terminal },
    { id: 'Layout', icon: Layout },
    { id: 'MessageSquare', icon: MessageSquare },
    { id: 'Shield', icon: Shield },
    { id: 'Globe', icon: Globe },
    { id: 'LineChart', icon: LineChart },
    { id: 'Code', icon: Code }
]

export const COLOR_OPTIONS = [
    { id: 'blue', value: '#3b82f6' },
    { id: 'purple', value: '#a855f7' },
    { id: 'pink', value: '#ec4899' },
    { id: 'red', value: '#ef4444' },
    { id: 'orange', value: '#f97316' },
    { id: 'yellow', value: '#eab308' },
    { id: 'green', value: '#22c55e' },
    { id: 'cyan', value: '#06b6d4' }
]

export function AgentEditor({ agentId, onClose }: AgentEditorProps) {
    const { agents, addAgent, updateAgent, settings } = useStore()
    const [availableModels, setAvailableModels] = useState<string[]>([])

    // Form state
    const [name, setName] = useState('')
    const [icon, setIcon] = useState('Bot')
    const [color, setColor] = useState('#3b82f6')
    const [description, setDescription] = useState('')
    const [systemPrompt, setSystemPrompt] = useState('')
    const [preferredModelId, setPreferredModelId] = useState('')
    const [enabledTools, setEnabledTools] = useState<string[]>([])

    // Load agent data if editing
    useEffect(() => {
        if (agentId) {
            const agent = agents.find(a => a.id === agentId)
            if (agent) {
                setName(agent.name)
                setIcon(agent.icon || 'Bot')
                setColor(agent.color || '#3b82f6')
                setDescription(agent.description || '')
                setSystemPrompt(agent.systemPrompt)
                setPreferredModelId(agent.preferredModelId || '')
                setEnabledTools(agent.enabledTools)
            }
        }
    }, [agentId, agents])

    // Load available models
    useEffect(() => {
        const fetchModels = async () => {
            const aiService = new AIService(settings.aiSettings)
            const type = settings.aiSettings.intelligenceMode || 'local'
            const models = await aiService.getModels(type)
            setAvailableModels(models)
        }
        fetchModels()
    }, [settings.aiSettings])

    const handleSave = () => {
        if (!name.trim()) return

        const agentData: Partial<AgentBlueprint> = {
            name,
            icon,
            color,
            description,
            systemPrompt,
            preferredModelId: preferredModelId || undefined,
            enabledTools,
        }

        if (agentId) {
            updateAgent(agentId, agentData)
        } else {
            addAgent(agentData as AgentBlueprint)
        }
        onClose()
    }

    const SelectedIcon = ICON_OPTIONS.find(i => i.id === icon)?.icon || Bot
    const currentDefaultModel = settings.aiSettings.intelligenceMode === 'local'
        ? settings.aiSettings.ollamaModel
        : settings.aiSettings.cloudModel

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="glass-panel w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-white/20 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-4">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all duration-300 ring-2 ring-white/10"
                            style={{ backgroundColor: `${color}20`, color: color }}
                        >
                            <SelectedIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">{agentId ? 'Edit Agent' : 'Create New Agent'}</h2>
                            <p className="text-xs text-muted-foreground font-medium opacity-60">Define your agent's persona and logic</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">

                    {/* Icon & Color Selection */}
                    <div className="space-y-6">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-3 block">Icon Selection</label>
                            <div className="grid grid-cols-7 gap-3">
                                {ICON_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setIcon(opt.id)}
                                        className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 border",
                                            icon === opt.id
                                                ? "glass-strong border-white/40 scale-110 shadow-lg"
                                                : "border-white/5 hover:border-white/20 bg-white/5"
                                        )}
                                        style={{ color: icon === opt.id ? color : 'inherit' }}
                                    >
                                        <opt.icon className="w-5 h-5" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-3 block">Theme Color</label>
                            <div className="flex items-center gap-3">
                                {COLOR_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setColor(opt.value)}
                                        className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ring-offset-2 ring-offset-zinc-950",
                                            color === opt.value ? "ring-2 ring-white scale-110" : "hover:scale-105"
                                        )}
                                        style={{ backgroundColor: opt.value }}
                                    >
                                        {color === opt.value && <Check className="w-4 h-4 text-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Basic Info */}
                    <div className="space-y-5">
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2 block">Agent Name</label>
                                <input
                                    type="text"
                                    className="glass-strong w-full px-5 py-4 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-white/20 transition-all border border-white/5"
                                    placeholder="e.g. Research Assistant"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2 block">Description</label>
                                <input
                                    type="text"
                                    className="glass-strong w-full px-5 py-4 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-white/20 transition-all border border-white/5"
                                    placeholder="Briefly describe what this agent does..."
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Model Selection */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2 block flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-primary-accent" />
                            Model Engine
                        </label>
                        <select
                            className="glass-strong w-full px-5 py-4 rounded-2xl text-sm appearance-none outline-none focus:ring-2 focus:ring-white/20 cursor-pointer border border-white/5"
                            value={preferredModelId}
                            onChange={e => setPreferredModelId(e.target.value)}
                        >
                            <option value="" className="bg-zinc-900">Use Global Default ({currentDefaultModel})</option>
                            {availableModels.map(model => (
                                <option key={model} value={model} className="bg-zinc-900">{model}</option>
                            ))}
                        </select>
                    </div>

                    {/* System Prompt */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2 block flex items-center gap-2">
                            <Bot className="w-3 h-3 text-primary-accent" />
                            System Directives (Prompt)
                        </label>
                        <div className="glass-strong rounded-2xl p-1 border border-white/5">
                            <textarea
                                className="w-full bg-transparent px-5 py-4 text-sm outline-none min-h-[180px] resize-none font-mono leading-relaxed"
                                placeholder="Describe the agent's persona, goal, and output format..."
                                value={systemPrompt}
                                onChange={e => setSystemPrompt(e.target.value)}
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-3 px-1 italic opacity-60">
                            Pro-tip: Be specific about the persona and formatting you expect.
                        </p>
                    </div>

                    {/* Tools */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2 block flex items-center gap-2">
                            <Wrench className="w-3 h-3 text-primary-accent" />
                            Core Capabilities
                        </label>
                        <ToolSelector
                            selectedTools={enabledTools}
                            onChange={setEnabledTools}
                        />
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-white/5">
                    <Button variant="ghost" onClick={onClose} className="rounded-xl px-6">Cancel</Button>
                    <Button
                        onClick={handleSave}
                        disabled={!name.trim()}
                        className="bg-primary-accent hover:opacity-90 text-white min-w-[140px] rounded-xl font-bold shadow-xl transition-all active:scale-95"
                    >
                        <Save className="w-4 h-4 mr-2 text-white/70" />
                        {agentId ? 'Update Agent' : 'Create Agent'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
