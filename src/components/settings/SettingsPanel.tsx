import { useState, useEffect } from 'react'
import { open } from '@tauri-apps/plugin-shell'
import { useStore } from '@/store'
import { TestTube, Sparkles, ChevronDown, Folder, Mic, Volume2, Mail, Globe, ExternalLink } from 'lucide-react'
import { VaultService } from '@/services/VaultService'
import { Button } from '@/components/ui/button'
import { AIService } from '@/services/aiService'
import { ToolService } from '@/services/toolService'
import { SettingsSection } from './SettingsSection'
import { GlassSlider } from './GlassSlider'
import { LiveThemePreview } from './LiveThemePreview'

export function SettingsPanel() {
    const { settings, updateSettings, vaultPath, setVaultPath } = useStore()
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
    const [availableModels, setAvailableModels] = useState<string[]>([])
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])

    const toolStatusMap = ToolService.getToolDefinitions().reduce((acc, tool) => {
        acc[tool.name] = tool
        return acc
    }, {} as Record<string, { status?: string; statusMessage?: string }>)

    const statusBadge = (status?: string) => {
        switch (status) {
            case 'active':
                return { label: '🟢 Active', className: 'bg-green-500/15 text-green-300 border-green-500/30' }
            case 'limited':
                return { label: '🟡 Limited', className: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' }
            case 'wip':
                return { label: '🟠 Work in Progress', className: 'bg-orange-500/15 text-orange-300 border-orange-500/30' }
            default:
                return { label: '🔴 Disabled', className: 'bg-red-500/15 text-red-300 border-red-500/30' }
        }
    }


    // Fetch models for the default selector
    useEffect(() => {
        const fetchModels = async () => {
            const aiService = new AIService(settings.aiSettings)
            // Filter models by the current provider type (local or cloud)
            const type = settings.aiSettings.intelligenceMode || 'local'
            const models = await aiService.getModels(type)
            setAvailableModels(models)
        }
        fetchModels()
    }, [settings.aiSettings])

    // Load available system voices
    useEffect(() => {
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices()
            setAvailableVoices(voices)
        }

        loadVoices()
        window.speechSynthesis.onvoiceschanged = loadVoices
    }, [])

    const handleVoicePreview = () => {
        const utterance = new SpeechSynthesisUtterance('Hello, I am your companion. How can I help you today?')
        const voice = availableVoices.find(v => v.name === settings.voiceSettings.localVoice)
        if (voice) utterance.voice = voice
        utterance.rate = settings.voiceSettings.speakingRate
        window.speechSynthesis.speak(utterance)
    }


    const handleTestConnection = async () => {
        setTesting(true)
        setTestResult(null)

        const aiService = new AIService(settings.aiSettings)
        const result = await aiService.testConnection()

        setTestResult(result)
        setTesting(false)
    }

    const applyPreset = (preset: 'crystal' | 'frost' | 'obsidian') => {
        const presets = {
            crystal: {
                theme: 'glass-crystal' as const,
                glassIntensity: 8,
                accentTintStrength: 5,
                glassBlur: 15,
            },
            frost: {
                theme: 'glass-frost' as const,
                glassIntensity: 25,
                accentTintStrength: 30,
                glassBlur: 50,
            },
            obsidian: {
                theme: 'glass-obsidian' as const,
                glassIntensity: 60,
                accentTintStrength: 60,
                glassBlur: 100,
            }
        }
        updateSettings(presets[preset])
    }

    const handleSliderChange = (key: string, value: number) => {
        updateSettings({
            [key]: value,
            theme: 'glass-custom'
        } as any)
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="glass-theme border-b border-white/10 px-6 py-8">
                <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                <p className="text-sm text-muted-foreground mt-1 text-foreground/60">Configure your companion and appearance</p>
            </div>

            <div className="p-6 pb-20">
                <div className="max-w-3xl space-y-8">

                    {/* VISUAL STYLE SECTION */}
                    <SettingsSection title="Appearance" defaultOpen={false}>
                        <div className="space-y-6 bg-foreground/5 p-5 rounded-2xl border border-foreground/5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-3 block">Theme Mode</label>
                                    <div className="flex bg-foreground/5 p-1 rounded-xl">
                                        {(['dark', 'light', 'glass-frost'] as const).map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => updateSettings({ theme: t as any })}
                                                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${(settings.theme === t || (t === 'glass-frost' && settings.theme.startsWith('glass')))
                                                    ? 'bg-foreground text-zinc-950 shadow-md'
                                                    : 'hover:bg-foreground/10'
                                                    }`}
                                            >
                                                {t.includes('glass') ? 'Glass' : t.charAt(0).toUpperCase() + t.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-3 block">Accent Color</label>
                                    <div className="flex gap-2.5 flex-wrap">
                                        {(['blue', 'purple', 'green', 'orange', 'pink', 'cyan'] as const).map((color) => {
                                            const colorMap: Record<string, string> = {
                                                blue: 'rgb(59, 130, 246)',
                                                purple: 'rgb(168, 85, 247)',
                                                green: 'rgb(34, 197, 94)',
                                                orange: 'rgb(249, 115, 22)',
                                                pink: 'rgb(236, 72, 153)',
                                                cyan: 'rgb(45, 212, 191)',
                                            }
                                            return (
                                                <button
                                                    key={color}
                                                    onClick={() => updateSettings({ accentColor: color })}
                                                    style={{ backgroundColor: colorMap[color] }}
                                                    className={`w-7 h-7 rounded-full transition-all duration-200 hover:scale-125 shadow-md ${settings.accentColor === color
                                                        ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110'
                                                        : 'opacity-80'
                                                        }`}
                                                />
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {settings.theme.startsWith('glass') && (
                                <div className="space-y-6 pt-4 border-t border-foreground/5 animate-in fade-in slide-in-from-top-2">
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-3 block">Glass Variation Presets</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {(['crystal', 'frost', 'obsidian'] as const).map((p) => (
                                                <button
                                                    key={p}
                                                    onClick={() => applyPreset(p)}
                                                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${settings.theme === `glass-${p}`
                                                        ? 'bg-primary-accent border-primary-accent text-white shadow-lg'
                                                        : 'border-foreground/10 hover:border-foreground/20 glass-hover'
                                                        }`}
                                                >
                                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-4 block">Fine-Grained Controls</label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                            <div className="space-y-2">
                                                <GlassSlider
                                                    label="Opacity Intensity"
                                                    value={settings.glassIntensity}
                                                    onChange={(val) => handleSliderChange('glassIntensity', val)}
                                                />
                                                <GlassSlider
                                                    label="Accent Tint Strength"
                                                    value={settings.accentTintStrength}
                                                    onChange={(val) => handleSliderChange('accentTintStrength', val)}
                                                />
                                                <GlassSlider
                                                    label="Background Blur"
                                                    value={settings.glassBlur}
                                                    onChange={(val) => handleSliderChange('glassBlur', val)}
                                                />
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <p className="text-[10px] font-bold text-foreground/40 mb-2">LIVE THEME PREVIEW</p>
                                                <LiveThemePreview />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </SettingsSection>

                    {/* AI ASSISTANT SECTION */}
                    <SettingsSection title="AI Assistant" defaultOpen={false}>
                        <div className="space-y-5 bg-foreground/5 p-5 rounded-2xl border border-foreground/5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 block">Assistant Identity</label>
                                    <input
                                        type="text"
                                        className="glass-strong w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-foreground/20 shadow-sm"
                                        placeholder="Companion"
                                        value={settings.assistantName}
                                        onChange={(e) => updateSettings({ assistantName: e.target.value })}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Advanced Mode</span>
                                    <button
                                        onClick={() => setShowAdvanced(!showAdvanced)}
                                        className={`w-8 h-4 rounded-full relative transition-all duration-300 ${showAdvanced ? 'bg-primary-accent' : 'bg-foreground/10'}`}
                                    >
                                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-300 ${showAdvanced ? 'left-4.5' : 'left-0.5'}`} />
                                    </button>
                                </div>
                            </div>

                            {showAdvanced && (
                                <div className="space-y-4 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 block">Core Instructions (System Prompt)</label>
                                    <textarea
                                        className="glass-strong w-full px-4 py-4 rounded-xl text-sm outline-none focus:ring-1 focus:ring-foreground/20 min-h-[140px] resize-none shadow-sm"
                                        placeholder="You are a helpful AI assistant..."
                                        value={settings.systemPrompt}
                                        onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>
                    </SettingsSection>

                    {/* AI CONFIG SECTION */}
                    <SettingsSection title="Backend Configuration" defaultOpen={false}>
                        <div className="space-y-6 bg-foreground/5 p-5 rounded-2xl border border-foreground/5">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 block">AI Engine Provider</label>
                                <div className="flex bg-foreground/5 p-1 rounded-xl">
                                    {(['local', 'cloud'] as const).map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => updateSettings({ aiSettings: { ...settings.aiSettings, intelligenceMode: p } })}
                                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${settings.aiSettings.intelligenceMode === p
                                                ? 'bg-foreground text-zinc-950 shadow-md'
                                                : 'hover:bg-foreground/10'
                                                }`}
                                        >
                                            {p === 'local' ? 'Local (Ollama)' : 'Cloud API'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {settings.aiSettings.intelligenceMode === 'local' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                    {showAdvanced && (
                                        <div>
                                            <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 block">Ollama Endpoint URL</label>
                                            <input
                                                type="text"
                                                className="glass-strong w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-foreground/20"
                                                placeholder="http://localhost:11434"
                                                value={settings.aiSettings.ollamaUrl}
                                                onChange={(e) =>
                                                    updateSettings({
                                                        aiSettings: { ...settings.aiSettings, ollamaUrl: e.target.value },
                                                    })
                                                }
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 block flex items-center gap-1.5">
                                            Default Chat Model
                                            <Sparkles className="h-3 w-3" style={{ color: 'rgb(var(--accent-rgb))' }} />
                                        </label>
                                        <div className="relative">
                                            <select
                                                className="glass-strong w-full px-4 py-2.5 rounded-xl text-sm appearance-none outline-none focus:ring-1 focus:ring-foreground/20 cursor-pointer"
                                                value={settings.aiSettings.preferredModelId}
                                                onChange={(e) =>
                                                    updateSettings({
                                                        aiSettings: {
                                                            ...settings.aiSettings,
                                                            preferredModelId: e.target.value
                                                        },
                                                    })
                                                }
                                            >
                                                {availableModels.length > 0 ? (
                                                    availableModels.map((model) => (
                                                        <option key={model} value={model} className="bg-background">
                                                            {model}
                                                        </option>
                                                    ))
                                                ) : (
                                                    <option disabled>No models found</option>
                                                )}
                                            </select>
                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
                                        </div>
                                    </div>
                                    {showAdvanced && (
                                        <div>
                                            <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 block flex items-center gap-1.5">
                                                Embedding Model
                                                <Sparkles className="h-3 w-3" style={{ color: 'rgb(var(--accent-rgb))' }} />
                                            </label>
                                            <div className="relative">
                                                <select
                                                    className="glass-strong w-full px-4 py-2.5 rounded-xl text-sm appearance-none outline-none focus:ring-1 focus:ring-foreground/20 cursor-pointer"
                                                    value={settings.aiSettings.ollamaEmbeddingModel || 'nomic-embed-text'}
                                                    onChange={(e) =>
                                                        updateSettings({
                                                            aiSettings: {
                                                                ...settings.aiSettings,
                                                                ollamaEmbeddingModel: e.target.value
                                                            },
                                                        })
                                                    }
                                                >
                                                    {availableModels.length > 0 ? (
                                                        availableModels.map((model) => (
                                                            <option key={model} value={model} className="bg-background">
                                                                {model}
                                                            </option>
                                                        ))
                                                    ) : (
                                                        <option value="nomic-embed-text">nomic-embed-text (default)</option>
                                                    )}
                                                </select>
                                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-1.5 opacity-60">
                                                Used for Knowledge Base searching. <code className="bg-foreground/5 px-1 rounded">nomic-embed-text</code> recommended.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {settings.aiSettings.intelligenceMode === 'cloud' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 block">Cloud Provider</label>
                                        <select
                                            className="glass-strong w-full px-4 py-2.5 rounded-xl text-sm appearance-none outline-none focus:ring-1 focus:ring-foreground/20"
                                            value={settings.aiSettings.cloudProvider}
                                            onChange={(e) =>
                                                updateSettings({
                                                    aiSettings: {
                                                        ...settings.aiSettings,
                                                        cloudProvider: e.target.value as 'openai' | 'anthropic' | 'google',
                                                    },
                                                })
                                            }
                                        >
                                            <option value="openai" className="bg-background">OpenAI</option>
                                            <option value="anthropic" className="bg-background">Anthropic</option>
                                            <option value="google" className="bg-background">Google Gemini</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 block">
                                            {settings.aiSettings.cloudProvider === 'google' ? 'Google API Key' :
                                                settings.aiSettings.cloudProvider === 'anthropic' ? 'Anthropic API Key' : 'OpenAI API Key'}
                                        </label>
                                        <input
                                            type="password"
                                            className="glass-strong w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-foreground/20"
                                            placeholder={settings.aiSettings.cloudProvider === 'google' ? 'AIza...' :
                                                settings.aiSettings.cloudProvider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                                            value={
                                                settings.aiSettings.cloudProvider === 'google' ? (settings.aiSettings.googleApiKey || '') :
                                                    settings.aiSettings.cloudProvider === 'anthropic' ? (settings.aiSettings.anthropicApiKey || '') :
                                                        (settings.aiSettings.openaiApiKey || '')
                                            }
                                            onChange={(e) => {
                                                const provider = settings.aiSettings.cloudProvider
                                                const keyField = provider === 'google' ? 'googleApiKey' :
                                                    provider === 'anthropic' ? 'anthropicApiKey' : 'openaiApiKey'

                                                updateSettings({
                                                    aiSettings: {
                                                        ...settings.aiSettings,
                                                        [keyField]: e.target.value
                                                    },
                                                })
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 block">Default Cloud Model</label>
                                        <div className="relative">
                                            <select
                                                className="glass-strong w-full px-4 py-2.5 rounded-xl text-sm appearance-none outline-none focus:ring-1 focus:ring-foreground/20 cursor-pointer"
                                                value={settings.aiSettings.preferredModelId}
                                                onChange={(e) =>
                                                    updateSettings({
                                                        aiSettings: {
                                                            ...settings.aiSettings,
                                                            // Update preferredModelId directly
                                                            preferredModelId: e.target.value
                                                        },
                                                    })
                                                }
                                            >
                                                {availableModels.length > 0 ? (
                                                    availableModels.filter(m => {
                                                        const provider = settings.aiSettings.cloudProvider
                                                        if (provider === 'openai') return m.startsWith('gpt')
                                                        if (provider === 'anthropic') return m.startsWith('claude')
                                                        if (provider === 'google') return m.startsWith('gemini')
                                                        return true
                                                    }).map((model) => (
                                                        <option key={model} value={model} className="bg-background">
                                                            {model}
                                                        </option>
                                                    ))
                                                ) : (
                                                    <option disabled>No models found for this provider</option>
                                                )}
                                            </select>
                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-2">
                                <Button
                                    onClick={handleTestConnection}
                                    disabled={testing}
                                    className="bg-primary-accent hover:opacity-90 text-white shadow-lg shadow-primary-accent/20 px-6 py-3 rounded-xl text-sm font-bold w-full flex items-center justify-center gap-2 hover:scale-[1.02] transition-all active:scale-[0.98]"
                                >
                                    <TestTube className="w-4 h-4" />
                                    {testing ? 'Verifying...' : 'Test AI Connection'}
                                </Button>
                                {testResult && (
                                    <div
                                        className={`mt-3 text-xs p-3 rounded-xl flex items-center gap-2 shadow-sm ${testResult.success
                                            ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                                            : 'bg-red-500/15 text-red-400 border border-red-500/20'
                                            }`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${testResult.success ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                                        {testResult.message}
                                    </div>
                                )}
                            </div>
                        </div>
                    </SettingsSection>


                    {/* VAULT CONFIG SECTION */}
                    <SettingsSection title="Vault Configuration" defaultOpen={false}>
                        <div className="space-y-4 bg-foreground/5 p-5 rounded-2xl border border-foreground/5">
                            <p className="text-xs text-muted-foreground mb-4">
                                Choose a local folder where your agents will store their work.
                                This can be an existing Obsidian vault or any directory on your computer.
                            </p>

                            <div className="flex items-end gap-3">
                                <div className="flex-1">
                                    <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 block">Vault Path</label>
                                    <div className="glass-strong w-full px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 text-foreground/60 cursor-not-allowed">
                                        <Folder className="w-4 h-4 opacity-50" />
                                        <span className="truncate">
                                            {vaultPath || 'No vault selected'}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    onClick={async () => {
                                        const path = await VaultService.selectVaultLocation()
                                        if (path) {
                                            setVaultPath(path)
                                        }
                                    }}
                                    className="bg-primary-accent hover:opacity-90 text-white shadow-lg px-4 py-2.5 rounded-xl text-sm font-bold h-[42px]"
                                >
                                    Choose Folder
                                </Button>
                            </div>

                            {vaultPath && (
                                <div className="mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                            try {
                                                await VaultService.writeToVault('test-write.txt', 'Vault connection test successful from Settings Panel')
                                                alert(`Success! Wrote to ${vaultPath}/test-write.txt. Check your folder.`)
                                            } catch (err: any) {
                                                console.error(err)
                                                alert(`Failed to write to vault: ${err.message}`)
                                            }
                                        }}
                                        className="text-xs h-8 border-white/10 hover:bg-white/5"
                                    >
                                        Test Vault Permissions
                                    </Button>
                                    <p className="text-[10px] text-green-400 mt-2 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                        Vault Active
                                    </p>
                                </div>
                            )}
                        </div>
                    </SettingsSection>

                    {/* AI TOOLS SECTION */}
                    <SettingsSection title="AI Tools" defaultOpen={false}>
                        <div className="space-y-4 bg-foreground/5 p-5 rounded-2xl border border-foreground/5">
                            <p className="text-xs text-muted-foreground mb-2">Enable or disable built-in tools for the AI assistant.</p>

                            {[
                                { id: 'web_search', name: 'Web Search', description: 'Search the web using DuckDuckGo', icon: '🌐' },
                                { id: 'url_reader', name: 'URL Reader', description: 'URL Reader', icon: '📄' },
                                { id: 'file_system', name: 'File System', description: 'Read/write local files (requires confirmation)', icon: '📁' },
                                { id: 'execute_code', name: 'Code Execution', description: 'Run Python/JS code (requires confirmation)', icon: '🚀' },
                            ].map((tool) => (
                                <div
                                    key={tool.id}
                                    className={`flex items-center justify-between glass-hover p-3 rounded-xl border border-white/5 transition-all ${['wip', 'disabled'].includes(toolStatusMap[tool.id]?.status || 'disabled') ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{tool.icon}</span>
                                        <div>
                                            <h4 className="text-sm font-semibold">{tool.name}</h4>
                                            <p className="text-[11px] text-muted-foreground">{tool.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            const badge = statusBadge(toolStatusMap[tool.id]?.status)
                                            return (
                                                <span
                                                    title={toolStatusMap[tool.id]?.statusMessage || 'Tool is disabled.'}
                                                    className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-semibold tracking-wide ${badge.className}`}
                                                >
                                                    {badge.label}
                                                </span>
                                            )
                                        })()}
                                        <button
                                            disabled={['wip', 'disabled'].includes(toolStatusMap[tool.id]?.status || 'disabled')}
                                            onClick={() => {
                                                if (['wip', 'disabled'].includes(toolStatusMap[tool.id]?.status || 'disabled')) return
                                            const key = tool.id as keyof typeof settings.aiSettings.toolsEnabled
                                            const currentTools = settings.aiSettings.toolsEnabled || {
                                                web_search: true,
                                                url_reader: true,
                                                file_system: true,
                                                execute_code: true,
                                                google_calendar: true,
                                                notion: true,
                                                github: true,
                                            }
                                            const enabled = !currentTools[key]
                                            updateSettings({
                                                aiSettings: {
                                                    ...settings.aiSettings,
                                                    toolsEnabled: {
                                                        ...currentTools,
                                                        [key]: enabled
                                                    }
                                                }
                                            })
                                        }}
                                            className={`w-10 h-5 rounded-full relative transition-all duration-300 ${(['wip', 'disabled'].includes(toolStatusMap[tool.id]?.status || 'disabled'))
                                                ? 'bg-foreground/10 cursor-not-allowed'
                                                : ((settings.aiSettings.toolsEnabled?.[tool.id as keyof typeof settings.aiSettings.toolsEnabled] ?? true)
                                                    ? 'bg-primary-accent shadow-[0_0_10px_rgba(var(--accent-rgb),0.3)]'
                                                    : 'bg-foreground/10')
                                                }`}
                                        >
                                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${(settings.aiSettings.toolsEnabled?.[tool.id as keyof typeof settings.aiSettings.toolsEnabled] ?? true)
                                                ? 'left-6'
                                                : 'left-1'
                                                }`} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SettingsSection>

                    {/* INTEGRATIONS SECTION */}
                    <SettingsSection title="Integration Keys" defaultOpen={false}>
                        <div className="space-y-6 bg-foreground/5 p-5 rounded-2xl border border-foreground/5">
                            <p className="text-xs text-muted-foreground mb-2">Configure API keys for external tools.</p>

                            {/* Google Calendar */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 block">Google Calendar API Key</label>
                                <input
                                    type="password"
                                    className="glass-strong w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-foreground/20"
                                    placeholder="AIza..."
                                    value={settings.aiSettings.googleCalendarApiKey || ''}
                                    onChange={(e) =>
                                        updateSettings({
                                            aiSettings: { ...settings.aiSettings, googleCalendarApiKey: e.target.value },
                                        })
                                    }
                                />
                                <p className="text-[10px] text-muted-foreground mt-1.5 opacity-60 hover:opacity-100 transition-opacity">
                                    Get key from <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="underline hover:text-white">Google Cloud Console</a> → Enable Calendar API → Create API Key
                                </p>
                                <div className="mt-3">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/70 mb-2 block">Google Calendar OAuth Token (for write access)</label>
                                    <input
                                        type="password"
                                        className="glass-strong w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-foreground/20"
                                        placeholder="ya29..."
                                        value={settings.aiSettings.googleCalendarOAuthToken || ''}
                                        onChange={(e) =>
                                            updateSettings({
                                                aiSettings: { ...settings.aiSettings, googleCalendarOAuthToken: e.target.value },
                                            })
                                        }
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1.5 opacity-60 hover:opacity-100 transition-opacity">
                                        OAuth tokens enable create/modify. API keys are read-only and limited to public calendars.
                                    </p>
                                </div>
                            </div>

                            {/* Notion */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 block">Notion Integration Token</label>
                                <input
                                    type="password"
                                    className="glass-strong w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-foreground/20"
                                    placeholder="secret_..."
                                    value={settings.aiSettings.notionApiKey || ''}
                                    onChange={(e) =>
                                        updateSettings({
                                            aiSettings: { ...settings.aiSettings, notionApiKey: e.target.value },
                                        })
                                    }
                                />
                                <p className="text-[10px] text-muted-foreground mt-1.5 opacity-60 hover:opacity-100 transition-opacity">
                                    Create integration at <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer" className="underline hover:text-white">Notion Integrations</a> → Copy token
                                </p>
                            </div>

                            {/* GitHub */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 block">GitHub Token (PAT or OAuth)</label>
                                <input
                                    type="password"
                                    className="glass-strong w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-foreground/20"
                                    placeholder="ghp_..."
                                    value={settings.aiSettings.githubApiKey || ''}
                                    onChange={(e) =>
                                        updateSettings({
                                            aiSettings: { ...settings.aiSettings, githubApiKey: e.target.value },
                                        })
                                    }
                                />
                                <p className="text-[10px] text-muted-foreground mt-1.5 opacity-60 hover:opacity-100 transition-opacity">
                                    Generate token at <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="underline hover:text-white">GitHub Settings</a> → New Token (classic) → Apply 'repo' scope
                                </p>
                            </div>

                            {/* Supabase */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 block">Supabase Configuration</label>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        className="glass-strong w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-foreground/20"
                                        placeholder="Project URL (https://xyz.supabase.co)"
                                        value={settings.aiSettings.toolsEnabled?.supabase?.supabaseUrl || ''}
                                        onChange={(e) => {
                                            const currentTools = settings.aiSettings.toolsEnabled || {
                                                web_search: true,
                                                url_reader: true,
                                                file_system: true,
                                                execute_code: true,
                                                google_calendar: true,
                                                notion: true,
                                                github: true,
                                                supabase: { enabled: true, supabaseUrl: '', supabaseKey: '' }
                                            }
                                            const currentSupabase = currentTools.supabase || { enabled: true, supabaseUrl: '', supabaseKey: '' }

                                            updateSettings({
                                                aiSettings: {
                                                    ...settings.aiSettings,
                                                    toolsEnabled: {
                                                        ...currentTools,
                                                        supabase: {
                                                            ...currentSupabase,
                                                            supabaseUrl: e.target.value,
                                                            enabled: true
                                                        }
                                                    }
                                                }
                                            })
                                        }}
                                    />
                                    <input
                                        type="password"
                                        className="glass-strong w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-foreground/20"
                                        placeholder="Service Role Key (for full table access)"
                                        value={settings.aiSettings.toolsEnabled?.supabase?.supabaseKey || ''}
                                        onChange={(e) => {
                                            const currentTools = settings.aiSettings.toolsEnabled || {
                                                web_search: true,
                                                url_reader: true,
                                                file_system: true,
                                                execute_code: true,
                                                google_calendar: true,
                                                notion: true,
                                                github: true,
                                                supabase: { enabled: true, supabaseUrl: '', supabaseKey: '' }
                                            }
                                            const currentSupabase = currentTools.supabase || { enabled: true, supabaseUrl: '', supabaseKey: '' }

                                            updateSettings({
                                                aiSettings: {
                                                    ...settings.aiSettings,
                                                    toolsEnabled: {
                                                        ...currentTools,
                                                        supabase: {
                                                            ...currentSupabase,
                                                            supabaseKey: e.target.value,
                                                            enabled: true
                                                        }
                                                    }
                                                }
                                            })
                                        }}
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1.5 opacity-60 hover:opacity-100 transition-opacity">
                                    Use the <strong>Service Role Key</strong> for full table access. Get it from <a href="https://supabase.com/dashboard/project/_/settings/api" target="_blank" rel="noreferrer" className="underline hover:text-white">Supabase Dashboard</a> → Project Settings → API
                                </p>
                            </div>
                        </div>
                    </SettingsSection>

                    {/* VOICE & AUDIO SECTION */}
                    <SettingsSection title="Voice & Audio" defaultOpen={false}>
                        <div className="bg-foreground/5 p-6 rounded-2xl border border-foreground/5 space-y-6">
                            {/* Enable Voice Mode */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-sm font-medium">Enable Voice Mode</label>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 opacity-60">
                                        Allow speaking to the AI and hearing responses
                                    </p>
                                </div>
                                <button
                                    onClick={() =>
                                        updateSettings({
                                            voiceSettings: {
                                                ...settings.voiceSettings,
                                                enabled: !settings.voiceSettings.enabled,
                                            },
                                        })
                                    }
                                    className={`relative w-11 h-6 rounded-full transition-colors ${settings.voiceSettings.enabled ? 'bg-primary-accent' : 'bg-foreground/20'
                                        }`}
                                >
                                    <div
                                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.voiceSettings.enabled ? 'translate-x-5' : ''
                                            }`}
                                    />
                                </button>
                            </div>

                            {settings.voiceSettings.enabled && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                                    {/* STT Engine */}
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 flex items-center gap-2">
                                            <Mic className="h-3 w-3" />
                                            Speech-to-Text Engine
                                        </label>
                                        <div className="flex bg-foreground/5 p-1 rounded-xl">
                                            {(['local', 'cloud'] as const).map((engine) => (
                                                <button
                                                    key={engine}
                                                    onClick={() =>
                                                        updateSettings({
                                                            voiceSettings: {
                                                                ...settings.voiceSettings,
                                                                sttEngine: engine,
                                                            },
                                                        })
                                                    }
                                                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${settings.voiceSettings.sttEngine === engine
                                                        ? 'bg-foreground text-zinc-950 shadow-md'
                                                        : 'hover:bg-foreground/10'
                                                        }`}
                                                >
                                                    {engine === 'local' ? 'Local (Private)' : 'Cloud (OpenAI)'}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1.5 opacity-60">
                                            {settings.voiceSettings.sttEngine === 'local'
                                                ? 'Uses browser Web Speech API (privacy-first)'
                                                : 'Uses OpenAI Whisper API (requires API key)'}
                                        </p>
                                    </div>

                                    {/* TTS Engine */}
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 flex items-center gap-2">
                                            <Volume2 className="h-3 w-3" />
                                            Text-to-Speech Engine
                                        </label>
                                        <div className="flex bg-foreground/5 p-1 rounded-xl">
                                            {(['local', 'cloud'] as const).map((engine) => (
                                                <button
                                                    key={engine}
                                                    onClick={() =>
                                                        updateSettings({
                                                            voiceSettings: {
                                                                ...settings.voiceSettings,
                                                                ttsEngine: engine,
                                                            },
                                                        })
                                                    }
                                                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${settings.voiceSettings.ttsEngine === engine
                                                        ? 'bg-foreground text-zinc-950 shadow-md'
                                                        : 'hover:bg-foreground/10'
                                                        }`}
                                                >
                                                    {engine === 'local' ? 'Local (macOS)' : 'Cloud (OpenAI)'}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1.5 opacity-60">
                                            {settings.voiceSettings.ttsEngine === 'local'
                                                ? 'Uses macOS native voices (free, offline)'
                                                : 'Uses OpenAI TTS API (premium quality, requires API key)'}
                                        </p>
                                    </div>

                                    {/* Voice Selection */}
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 block">
                                            Voice
                                        </label>
                                        {settings.voiceSettings.ttsEngine === 'cloud' ? (
                                            <select
                                                className="glass-strong w-full px-4 py-2.5 rounded-xl text-sm appearance-none outline-none focus:ring-1 focus:ring-foreground/20"
                                                value={settings.voiceSettings.cloudVoice}
                                                onChange={(e) =>
                                                    updateSettings({
                                                        voiceSettings: {
                                                            ...settings.voiceSettings,
                                                            cloudVoice: e.target.value as any,
                                                        },
                                                    })
                                                }
                                            >
                                                <option value="alloy">Alloy (Neutral)</option>
                                                <option value="echo">Echo (Deep)</option>
                                                <option value="fable">Fable (Expressive)</option>
                                                <option value="onyx">Onyx (Authoritative)</option>
                                                <option value="nova">Nova (Balanced)</option>
                                                <option value="shimmer">Shimmer (Soft)</option>
                                            </select>
                                        ) : (
                                            <select
                                                className="glass-strong w-full px-4 py-2.5 rounded-xl text-sm appearance-none outline-none focus:ring-1 focus:ring-foreground/20"
                                                value={settings.voiceSettings.localVoice}
                                                onChange={(e) =>
                                                    updateSettings({
                                                        voiceSettings: {
                                                            ...settings.voiceSettings,
                                                            localVoice: e.target.value,
                                                        },
                                                    })
                                                }
                                            >
                                                {availableVoices.map((voice) => (
                                                    <option key={voice.name} value={voice.name}>
                                                        {voice.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    {/* Speaking Rate */}
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-2 block">
                                            Speaking Rate: {settings.voiceSettings.speakingRate.toFixed(1)}x
                                        </label>
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="2.0"
                                            step="0.1"
                                            value={settings.voiceSettings.speakingRate}
                                            onChange={(e) =>
                                                updateSettings({
                                                    voiceSettings: {
                                                        ...settings.voiceSettings,
                                                        speakingRate: parseFloat(e.target.value),
                                                    },
                                                })
                                            }
                                            className="w-full h-2 bg-foreground/10 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>

                                    {/* Speak Responses */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="text-sm font-medium">Speak Responses</label>
                                            <p className="text-[10px] text-muted-foreground mt-0.5 opacity-60">
                                                AI will speak its responses aloud
                                            </p>
                                        </div>
                                        <button
                                            onClick={() =>
                                                updateSettings({
                                                    voiceSettings: {
                                                        ...settings.voiceSettings,
                                                        speakResponses: !settings.voiceSettings.speakResponses,
                                                    },
                                                })
                                            }
                                            className={`relative w-11 h-6 rounded-full transition-colors ${settings.voiceSettings.speakResponses ? 'bg-primary-accent' : 'bg-foreground/20'
                                                }`}
                                        >
                                            <div
                                                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.voiceSettings.speakResponses ? 'translate-x-5' : ''
                                                    }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Auto-Listen */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="text-sm font-medium">Auto-Listen</label>
                                            <p className="text-[10px] text-muted-foreground mt-0.5 opacity-60">
                                                Automatically reactivate mic after AI speaks
                                            </p>
                                        </div>
                                        <button
                                            onClick={() =>
                                                updateSettings({
                                                    voiceSettings: {
                                                        ...settings.voiceSettings,
                                                        autoListen: !settings.voiceSettings.autoListen,
                                                    },
                                                })
                                            }
                                            className={`relative w-11 h-6 rounded-full transition-colors ${settings.voiceSettings.autoListen ? 'bg-primary-accent' : 'bg-foreground/20'
                                                }`}
                                        >
                                            <div
                                                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.voiceSettings.autoListen ? 'translate-x-5' : ''
                                                    }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Preview Button */}
                                    {settings.voiceSettings.ttsEngine === 'local' && (
                                        <Button
                                            onClick={handleVoicePreview}
                                            className="w-full"
                                            variant="outline"
                                        >
                                            <Volume2 className="h-4 w-4 mr-2" />
                                            Preview Voice
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </SettingsSection>

                    {/* ABOUT SECTION */}
                    <SettingsSection title="Support & About" defaultOpen={false}>
                        <div className="space-y-6">
                            {/* Contact & Links Card */}
                            <div className="bg-foreground/5 p-6 rounded-2xl border border-foreground/5 space-y-5">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Software Version</span>
                                    <span className="text-xs font-mono bg-foreground/10 px-2 py-0.5 rounded-full opacity-70">v1.2.4-stable</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Build Type</span>
                                    <span className="text-xs font-mono bg-primary-accent/20 text-primary-accent px-2 py-0.5 rounded-full">Developer Edition</span>
                                </div>

                                <div className="pt-4 border-t border-foreground/5 space-y-3">
                                    <button
                                        onClick={() => open('mailto:hymetalab@gmail.com')}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl glass-hover border border-white/5 transition-all text-sm group text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-primary-accent/10 flex items-center justify-center text-primary-accent group-hover:bg-primary-accent group-hover:text-white transition-colors">
                                            <Mail className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold">Support Email</p>
                                            <p className="text-xs text-foreground/50">hymetalab@gmail.com</p>
                                        </div>
                                        <ExternalLink className="w-3 h-3 opacity-30 group-hover:opacity-100" />
                                    </button>

                                    <button
                                        onClick={() => open('https://hymetalab-home-base-203204719108.us-west1.run.app')}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary-accent text-white shadow-lg shadow-primary-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm group text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                            <Globe className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold">HYMetaLab Homebase</p>
                                            <p className="text-xs text-white/70">Visit the lab research hub</p>
                                        </div>
                                        <ExternalLink className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Detailed About Section */}
                            <div className="bg-foreground/5 p-6 rounded-2xl border border-foreground/5 space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-primary-accent">About HYMetaLab</h4>

                                <div className="space-y-4 text-sm leading-relaxed text-foreground/80">
                                    <p>
                                        HYMetaLab is an independent research lab focused on the scientific study of <strong>coherence, resilience, and meaning</strong> in intelligent systems—human, artificial, and collective.
                                    </p>

                                    <p>
                                        The lab develops open, reproducible frameworks for understanding how systems stay aligned, recover from disruption, and accumulate value over time without drifting, fragmenting, or collapsing. Our work bridges <strong>information theory, complex systems, and applied AI</strong>, with an emphasis on measurement over speculation.
                                    </p>

                                    <p>
                                        This app is a practical extension of that research. It is designed to be <strong>local-first, privacy-respecting, and transparent</strong>, giving users direct access to tools built on HYMetaLab’s coherence science without requiring cloud dependency or data extraction.
                                    </p>

                                    <div className="p-4 bg-foreground/5 rounded-xl border border-white/5 italic text-xs text-foreground/60">
                                        All research and software produced by HYMetaLab operates under a formal institutional charter and published validation protocols. Claims are versioned, assumptions are disclosed, and uncertainty is treated as a first-class signal—not a failure.
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-foreground/40">Motto</p>
                                            <p className="text-xs font-medium italic">Integrity → Resilience → Meaning</p>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <p className="text-[10px] font-bold uppercase text-foreground/40">Founded & Directed By</p>
                                            <p className="text-xs font-medium">Jordan Anthony Heckler</p>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-foreground/5">
                                        <p className="text-[10px] text-foreground/40 leading-relaxed uppercase font-bold tracking-tight">
                                            Status: Independent, open research lab
                                        </p>
                                        <p className="text-[10px] text-foreground/40 mt-1">
                                            This software stores data locally on your device and is never used for training or analysis without explicit user consent.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </SettingsSection>

                </div>
            </div>
        </div>
    )
}
