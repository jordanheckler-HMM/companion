import { Trigger } from '@/store'
import { Clock, Calendar, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TriggerSelectorProps {
    trigger: Trigger
    onChange: (trigger: Trigger) => void
}

export function TriggerSelector({ trigger, onChange }: TriggerSelectorProps) {
    const updateTrigger = (updates: Partial<Trigger>) => {
        onChange({ ...trigger, ...updates })
    }

    const updateScheduleConfig = (updates: Partial<NonNullable<Trigger['scheduleConfig']>>) => {
        onChange({
            ...trigger,
            scheduleConfig: {
                ...trigger.scheduleConfig,
                ...updates
            } as Trigger['scheduleConfig']
        })
    }

    return (
        <div className="space-y-4">
            {/* Trigger Type Selection */}
            <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-3 block">
                    Run Trigger
                </label>
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => updateTrigger({ type: 'manual' })}
                        className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                            trigger.type === 'manual'
                                ? "border-primary-accent bg-primary-accent/10 text-foreground"
                                : "border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground"
                        )}
                    >
                        <Play className="w-5 h-5" />
                        <span className="text-xs font-medium">Manual</span>
                    </button>

                    <button
                        onClick={() => updateTrigger({ type: 'schedule', scheduleConfig: { frequency: 'daily', time: '08:00' } })}
                        className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                            trigger.type === 'schedule'
                                ? "border-primary-accent bg-primary-accent/10 text-foreground"
                                : "border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground"
                        )}
                    >
                        <Clock className="w-5 h-5" />
                        <span className="text-xs font-medium">Schedule</span>
                    </button>

                    <button
                        onClick={() => updateTrigger({ type: 'event' })}
                        disabled
                        className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all opacity-40 cursor-not-allowed",
                            "border-white/10 bg-white/5 text-muted-foreground"
                        )}
                    >
                        <Calendar className="w-5 h-5" />
                        <span className="text-xs font-medium">Event</span>
                        <span className="text-[8px] opacity-60">(Soon)</span>
                    </button>
                </div>
            </div>

            {/* Schedule Configuration */}
            {trigger.type === 'schedule' && trigger.scheduleConfig && (
                <div className="space-y-3 glass-strong p-4 rounded-xl border border-white/5">
                    {/* Frequency */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2 block">
                            Frequency
                        </label>
                        <select
                            className="glass-strong w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-white/20 border border-white/5"
                            value={trigger.scheduleConfig.frequency}
                            onChange={(e) => updateScheduleConfig({ frequency: e.target.value as any })}
                        >
                            <option value="hourly" className="bg-zinc-900">Every Hour</option>
                            <option value="daily" className="bg-zinc-900">Daily</option>
                            <option value="weekly" className="bg-zinc-900">Weekly</option>
                        </select>
                    </div>

                    {/* Time Input */}
                    {(trigger.scheduleConfig.frequency === 'daily' || trigger.scheduleConfig.frequency === 'weekly') && (
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2 block">
                                Time (24-hour)
                            </label>
                            <input
                                type="time"
                                className="glass-strong w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-white/20 border border-white/5"
                                value={trigger.scheduleConfig.time || '08:00'}
                                onChange={(e) => updateScheduleConfig({ time: e.target.value })}
                            />
                        </div>
                    )}

                    {/* Day of Week (for weekly) */}
                    {trigger.scheduleConfig.frequency === 'weekly' && (
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2 block">
                                Day of Week
                            </label>
                            <select
                                className="glass-strong w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-white/20 border border-white/5"
                                value={trigger.scheduleConfig.dayOfWeek ?? 1}
                                onChange={(e) => updateScheduleConfig({ dayOfWeek: parseInt(e.target.value) })}
                            >
                                <option value="0" className="bg-zinc-900">Sunday</option>
                                <option value="1" className="bg-zinc-900">Monday</option>
                                <option value="2" className="bg-zinc-900">Tuesday</option>
                                <option value="3" className="bg-zinc-900">Wednesday</option>
                                <option value="4" className="bg-zinc-900">Thursday</option>
                                <option value="5" className="bg-zinc-900">Friday</option>
                                <option value="6" className="bg-zinc-900">Saturday</option>
                            </select>
                        </div>
                    )}
                </div>
            )}

            {trigger.type === 'manual' && (
                <div className="text-xs text-muted-foreground italic px-1">
                    This workflow will only run when you manually trigger it.
                </div>
            )}
        </div>
    )
}
