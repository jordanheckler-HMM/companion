import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { ModelRegistry } from '@/services/ModelRegistry'
import { OllamaService } from '@/services/OllamaService'
import { Button } from '@/components/ui/button'
import {
    Sparkles,
    Zap,
    Shield,
    Download,
    CheckCircle2,
    ArrowRight,
    AlertTriangle,
    Loader2,
    BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function OnboardingGuide() {
    const {
        settings,
        updateSettings,
        setAvailableModels,
        clearMessages,
        setShowOnboarding
    } = useStore()
    const [step, setStep] = useState(1)
    const [ollamaReachable, setOllamaReachable] = useState(false)
    const [pulling, setPulling] = useState<string | null>(null)
    const [pullProgress, setPullProgress] = useState(0)
    const [installedModels, setInstalledModels] = useState<string[]>([])

    // Check reachability on mount
    useEffect(() => {
        const checkOllama = async () => {
            const registry = ModelRegistry.getInstance()
            await registry.syncOllamaModels(settings.aiSettings.ollamaUrl)
            setOllamaReachable(registry.isOllamaReachable)

            const models = registry.getAllModels()
                .filter(m => m.provider === 'ollama')
                .map(m => m.id)
            setInstalledModels(models)
            setAvailableModels(registry.getAllModels())
        }
        checkOllama()
        const interval = setInterval(checkOllama, 5000)
        return () => clearInterval(interval)
    }, [settings.aiSettings.ollamaUrl])

    const handlePullModel = async (modelName: string) => {
        setPulling(modelName)
        setPullProgress(0)

        try {
            const success = await OllamaService.downloadModel(modelName, (p) => {
                setPullProgress(p)
            })

            if (success) {
                const registry = ModelRegistry.getInstance()
                await registry.syncOllamaModels(settings.aiSettings.ollamaUrl)
                setAvailableModels(registry.getAllModels())
                setInstalledModels(prev => [...prev, modelName])

                // If it was the core chat model, set it as preferred
                if (modelName === ModelRegistry.CORE_CHAT_MODEL) {
                    updateSettings({
                        aiSettings: {
                            ...settings.aiSettings,
                            preferredModelId: modelName
                        }
                    })
                }
            }
        } catch (err) {
            console.error('Failed to pull model:', err)
        } finally {
            setPulling(null)
            setPullProgress(0)
        }
    }

    const isChatModelInstalled = installedModels.some(m => m === ModelRegistry.CORE_CHAT_MODEL || m.startsWith(ModelRegistry.CORE_CHAT_MODEL + ':'))
    const isEmbedModelInstalled = installedModels.some(m => m === ModelRegistry.CORE_EMBED_MODEL || m.startsWith(ModelRegistry.CORE_EMBED_MODEL + ':'))

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-center">
                            <div className="w-20 h-20 rounded-3xl bg-primary-accent/20 flex items-center justify-center border border-primary-accent/30 shadow-[0_0_40px_rgba(var(--accent-rgb),0.2)]">
                                <Sparkles className="h-10 w-10 text-primary-accent animate-pulse" />
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-black tracking-tight">Welcome to Lumora</h2>
                            <p className="text-muted-foreground text-lg max-w-md mx-auto">
                                Your private, local-first AI workspace. Let's get you set up in less than 2 minutes.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 mt-8">
                            <div className="glass-light p-4 rounded-2xl border border-white/5 flex items-start gap-4">
                                <div className="p-2 rounded-xl bg-green-500/10 text-green-400">
                                    <Shield className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm">100% Private</h4>
                                    <p className="text-xs text-muted-foreground">Your data NEVER leaves your machine. No subscriptions, no tracking.</p>
                                </div>
                            </div>
                            <div className="glass-light p-4 rounded-2xl border border-white/5 flex items-start gap-4">
                                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                                    <Zap className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm">Ultrafast Logic</h4>
                                    <p className="text-xs text-muted-foreground">Powered by your local hardware for instant, offline responses.</p>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={() => setStep(2)}
                            className="w-full py-7 rounded-2xl text-lg font-bold bg-primary-accent hover:opacity-90 transition-all shadow-xl shadow-primary-accent/20 flex items-center justify-center gap-2"
                        >
                            Get Started
                            <ArrowRight className="h-5 w-5" />
                        </Button>

                        <button
                            onClick={() => setShowOnboarding(false)}
                            className="w-full py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-white transition-colors"
                        >
                            Skip Setup
                        </button>
                    </div>
                )

            case 2:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="space-y-2 text-center">
                            <h3 className="text-2xl font-bold">Engine Check</h3>
                            <p className="text-sm text-muted-foreground">Lumora uses Ollama to run AI models on your CPU/GPU.</p>
                        </div>

                        <div className={cn(
                            "p-6 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-4 text-center",
                            ollamaReachable
                                ? "bg-green-500/5 border-green-500/20"
                                : "bg-orange-500/5 border-orange-500/20"
                        )}>
                            {ollamaReachable ? (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                                        <CheckCircle2 className="h-8 w-8 text-green-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-green-400">Ollama is running!</h4>
                                        <p className="text-xs text-muted-foreground mt-1">Connectivity established on {settings.aiSettings.ollamaUrl}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center animate-pulse">
                                        <AlertTriangle className="h-8 w-8 text-orange-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-orange-400">Ollama not detected</h4>
                                        <p className="text-xs text-muted-foreground mt-1 text-balance">
                                            Please make sure Ollama is installed and running on your machine.
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-2 w-full mt-2">
                                        <Button
                                            onClick={() => window.open('https://ollama.com/download', '_blank')}
                                            className="w-full py-5 rounded-xl font-bold border border-white/10 glass-hover"
                                        >
                                            Download Ollama
                                        </Button>
                                        <p className="text-[10px] text-muted-foreground">After installing, keep this app open. It will detect Ollama automatically.</p>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="ghost"
                                onClick={() => setStep(1)}
                                className="flex-1 py-6 rounded-xl border border-white/5"
                            >
                                Back
                            </Button>
                            <Button
                                disabled={!ollamaReachable}
                                onClick={() => setStep(3)}
                                className="flex-[2] py-6 rounded-xl font-bold bg-primary-accent shadow-lg shadow-primary-accent/20"
                            >
                                Continue
                            </Button>
                        </div>
                    </div>
                )

            case 3:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="space-y-2 text-center">
                            <h3 className="text-2xl font-bold">Initialize Minds</h3>
                            <p className="text-sm text-muted-foreground">Let's download the optimized models for your workspace.</p>
                        </div>

                        <div className="space-y-4">
                            {/* Chat Model */}
                            <div className={cn(
                                "p-5 rounded-2xl border transition-all flex items-center justify-between gap-4",
                                isChatModelInstalled ? "bg-green-500/5 border-green-500/20" : "bg-white/5 border-white/10"
                            )}>
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 rounded-xl bg-primary-accent/10">
                                        <Zap className="h-5 w-5 text-primary-accent" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">Lumora Lite</h4>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Highly Optimized Chat</p>
                                    </div>
                                </div>

                                {isChatModelInstalled ? (
                                    <div className="flex items-center gap-1.5 text-green-400 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span className="text-[10px] font-bold uppercase">Ready</span>
                                    </div>
                                ) : (
                                    <Button
                                        disabled={!!pulling}
                                        onClick={() => handlePullModel(ModelRegistry.CORE_CHAT_MODEL)}
                                        className="h-10 px-4 rounded-xl font-bold bg-primary-accent text-xs flex items-center gap-2"
                                    >
                                        {pulling === ModelRegistry.CORE_CHAT_MODEL ? (
                                            <>
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                {pullProgress}%
                                            </>
                                        ) : (
                                            <>
                                                <Download className="h-3 w-3" />
                                                Download (4GB)
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>

                            {/* Embedding Model */}
                            <div className={cn(
                                "p-5 rounded-2xl border transition-all flex items-center justify-between gap-4",
                                isEmbedModelInstalled ? "bg-green-500/5 border-green-500/20" : "bg-white/5 border-white/10"
                            )}>
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 rounded-xl bg-blue-500/10">
                                        <BookOpen className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">Neural Indexer</h4>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black text-blue-400/80">Power your Knowledge Base</p>
                                    </div>
                                </div>

                                {isEmbedModelInstalled ? (
                                    <div className="flex items-center gap-1.5 text-green-400 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span className="text-[10px] font-bold uppercase">Ready</span>
                                    </div>
                                ) : (
                                    <Button
                                        disabled={!!pulling}
                                        onClick={() => handlePullModel(ModelRegistry.CORE_EMBED_MODEL)}
                                        className="h-10 px-4 rounded-xl font-bold border border-white/10 glass-hover text-xs flex items-center gap-2"
                                    >
                                        {pulling === ModelRegistry.CORE_EMBED_MODEL ? (
                                            <>
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                {pullProgress}%
                                            </>
                                        ) : (
                                            <>
                                                <Download className="h-3 w-3" />
                                                Download (270MB)
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="ghost"
                                onClick={() => setStep(2)}
                                className="flex-1 py-6 rounded-xl border border-white/5 font-bold"
                            >
                                Back
                            </Button>
                            <Button
                                disabled={!isChatModelInstalled || pulling !== null}
                                onClick={() => setStep(4)}
                                className="flex-[2] py-6 rounded-xl font-bold bg-primary-accent shadow-lg shadow-primary-accent/20"
                            >
                                Finish Setup
                            </Button>
                        </div>
                    </div>
                )

            case 4:
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center space-y-4">
                            <div className="flex justify-center">
                                <div className="w-20 h-20 rounded-full border-4 border-primary-accent border-t-transparent animate-spin flex items-center justify-center p-1">
                                    <div className="w-full h-full rounded-full bg-primary-accent flex items-center justify-center">
                                        <CheckCircle2 className="h-10 w-10 text-white" />
                                    </div>
                                </div>
                            </div>
                            <h3 className="text-3xl font-black italic tracking-tighter">YOU ARE READY.</h3>
                            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                                Lumora is now fully initialized. All systems are Go.
                            </p>
                        </div>

                        <div className="space-y-3">
                        </div>

                        <Button
                            onClick={() => {
                                clearMessages()
                                setShowOnboarding(false)
                            }}
                            className="w-full py-8 rounded-3xl text-xl font-black uppercase tracking-[0.2em] bg-primary-accent shadow-[0_20px_40px_rgba(var(--accent-rgb),0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            Enter Workspace
                        </Button>
                    </div>
                )
        }
    }

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-6 backdrop-blur-3xl bg-black/60">
            <div className="w-full max-w-lg bg-[#0a0a0a] rounded-[40px] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden relative">
                {/* Visual Flair */}
                <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary-accent/10 blur-[120px] rounded-full" />
                <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-blue-500/10 blur-[120px] rounded-full" />

                <div className="p-10 relative">
                    {renderStep()}

                    {/* Progress Indicator */}
                    <div className="flex justify-center gap-2 mt-12">
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className={cn(
                                    "h-1.5 rounded-full transition-all duration-500",
                                    step === i ? "w-8 bg-primary-accent shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)]" : "w-1.5 bg-white/10"
                                )}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
