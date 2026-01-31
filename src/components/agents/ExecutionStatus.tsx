import { useStore } from '@/store'
import { Loader2, Zap } from 'lucide-react'

export function ExecutionStatus() {
    const { runningAutomationIds, automations, automationProgress } = useStore()

    if (runningAutomationIds.length === 0) return null

    const runningAutomations = runningAutomationIds
        .map(id => automations.find(a => a.id === id))
        .filter((a): a is any => !!a)

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3 pointer-events-none">
            {runningAutomations.map((auto) => {
                const progress = automationProgress[auto.id]
                const stepText = progress
                    ? `Step ${progress.current} of ${progress.total}`
                    : 'Initializing...'

                return (
                    <div
                        key={auto.id}
                        className="glass-strong p-4 rounded-2xl border border-primary-accent/30 shadow-2xl flex items-center gap-4 min-w-[260px] pointer-events-auto backdrop-blur-xl bg-black/40 animate-in fade-in slide-in-from-bottom-5 duration-300"
                    >
                        <div className="w-10 h-10 rounded-full bg-primary-accent/10 flex items-center justify-center relative shrink-0">
                            <Zap className="w-5 h-5 text-primary-accent animate-pulse" />
                            <div className="absolute inset-0 rounded-full border-2 border-primary-accent/40 animate-ping opacity-20" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-primary-accent/80">
                                    Running
                                </div>
                                <div className="text-[10px] font-mono text-muted-foreground">
                                    {stepText}
                                </div>
                            </div>
                            <div className="text-sm font-bold truncate text-white">
                                {auto.name}
                            </div>
                            {/* Simple Progress Bar */}
                            {progress && (
                                <div className="mt-2 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary-accent transition-all duration-500 ease-out"
                                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    />
                                </div>
                            )}
                        </div>
                        <Loader2 className="w-4 h-4 text-primary-accent animate-spin opacity-60 ml-2" />
                    </div>
                )
            })}
        </div>
    )
}
