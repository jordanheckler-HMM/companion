import { useState } from 'react'
import { useStore } from '@/store'
import { OllamaService } from '@/services/OllamaService'
import { Button } from '@/components/ui/button'
import { Download, Monitor, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function OllamaInstaller() {
    const { ollamaInstallStatus, setOllamaInstallStatus } = useStore()
    const [installing, setInstalling] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [progress, setProgress] = useState('')

    const handleInstall = async () => {
        setInstalling(true)
        setError(null)
        setProgress('Downloading installer...')

        try {
            const success = await OllamaService.install((p) => setProgress(p))
            if (success) {
                setOllamaInstallStatus('installed')
            } else {
                setError('Installation failed. Please try installing Ollama manually from ollama.com')
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred during installation.')
        } finally {
            setInstalling(false)
        }
    }

    if (ollamaInstallStatus === 'installed') return null

    return (
        <div className="mx-6 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass-panel overflow-hidden border border-white/10 rounded-2xl shadow-2xl">
                <div className="relative p-6">
                    {/* Decorative Background */}
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-primary/20 blur-3xl rounded-full" />

                    <div className="relative flex flex-col md:flex-row items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 shadow-inner">
                            <Download className="h-8 w-8 text-primary" />
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            <h3 className="text-lg font-bold">Unleash Local Intelligence</h3>
                            <p className="text-sm text-muted-foreground mt-1 max-w-md">
                                Install Ollama to run powerful AI models locally on your machine.
                                Complete privacy, no internet required, and 100% free.
                            </p>
                        </div>

                        <div className="shrink-0 flex flex-col items-center gap-2">
                            <Button
                                onClick={handleInstall}
                                disabled={installing}
                                className={cn(
                                    "px-8 py-6 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg",
                                    installing ? "bg-primary/50" : "bg-primary text-primary-foreground shadow-primary/20"
                                )}
                            >
                                {installing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Installing...
                                    </>
                                ) : (
                                    <>
                                        <Monitor className="mr-2 h-4 w-4" />
                                        One-Click Setup
                                    </>
                                )}
                            </Button>
                            <a
                                href="https://ollama.com"
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] uppercase font-bold tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                            >
                                Learn more at ollama.com
                            </a>
                        </div>
                    </div>

                    {installing && (
                        <div className="mt-6 pt-4 border-t border-white/5 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold uppercase tracking-wider opacity-60">Status</span>
                                <span className="text-xs font-mono text-primary">{progress}</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-primary animate-progress-indeterminate w-1/3 rounded-full" />
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-shake">
                            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                            <div className="flex flex-col gap-1">
                                <p className="text-xs font-bold text-red-400">{error}</p>
                                <button
                                    onClick={() => window.open('https://ollama.com/download', '_blank')}
                                    className="text-[10px] underline text-red-400/60 hover:text-red-400 text-left"
                                >
                                    Download Manually
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
