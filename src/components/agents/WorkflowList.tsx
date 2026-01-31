import { Automation, useStore } from '@/store'
import { Play, Edit, Trash2, Clock, Workflow, Pause, CheckCircle2, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { automationService } from '@/services/AutomationService'
import { schedulerService } from '@/services/SchedulerService'
import { cn } from '@/lib/utils'
import { ask } from '@tauri-apps/plugin-dialog'

interface WorkflowListProps {
    onEdit: (automationId: string) => void
}

export function WorkflowList({ onEdit }: WorkflowListProps) {
    const { automations, agents, updateAutomation, removeAutomation } = useStore()

    const handleRunNow = async (automationId: string) => {
        await automationService.runNow(automationId)
    }

    const handleToggleActive = (automation: Automation) => {
        const newActiveState = !automation.isActive
        updateAutomation(automation.id, { isActive: newActiveState })

        if (newActiveState) {
            automationService.startAutomation(automation.id)
        } else {
            automationService.stopAutomation(automation.id)
        }
    }

    const handleDelete = async (e: React.MouseEvent, automationId: string) => {
        e.stopPropagation()
        e.preventDefault()
        console.log('[WorkflowList] Delete clicked for automation:', automationId)

        try {
            const confirmed = await ask('Are you sure you want to delete this workflow?', {
                title: 'Delete Workflow',
                kind: 'warning'
            })
            console.log('[WorkflowList] Confirm result:', confirmed)

            if (confirmed) {
                console.log('[WorkflowList] Calling removeAutomation...')
                automationService.stopAutomation(automationId)
                removeAutomation(automationId)
                console.log('[WorkflowList] removeAutomation called')
            }
        } catch (err) {
            console.error('[WorkflowList] Dialog error:', err)
            if (window.confirm('Delete workflow?')) {
                automationService.stopAutomation(automationId)
                removeAutomation(automationId)
            }
        }
    }

    const getInvolvedAgents = (automation: Automation): string[] => {
        const agentIds = new Set<string>()
        automation.pipeline.forEach(step => {
            if (step.agentId) {
                agentIds.add(step.agentId)
            }
        })
        return Array.from(agentIds)
    }

    const getTriggerDisplay = (automation: Automation): string => {
        const { trigger } = automation
        if (trigger.type === 'manual') {
            return 'Manual'
        }
        if (trigger.type === 'schedule' && trigger.scheduleConfig) {
            const { frequency, time, dayOfWeek } = trigger.scheduleConfig
            if (frequency === 'hourly') return 'Every hour'
            if (frequency === 'daily') return `Daily at ${time || '08:00'}`
            if (frequency === 'weekly') {
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                return `${days[dayOfWeek ?? 1]} at ${time || '08:00'}`
            }
        }
        return 'Unknown'
    }

    const getNextRunTime = (automation: Automation): string | null => {
        if (!automation.isActive || automation.trigger.type !== 'schedule') {
            return null
        }
        const job = schedulerService.getJob(automation.id)
        if (job) {
            return job.nextRun.toLocaleString()
        }
        return null
    }

    if (automations.length === 0) {
        return null
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                        <Workflow className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold tracking-tight">Your Workflows</h3>
                        <p className="text-xs text-muted-foreground">
                            {automations.filter(a => a.isActive).length} active • {automations.length} total
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid gap-4">
                {automations.map(automation => {
                    const involvedAgents = getInvolvedAgents(automation)
                    const nextRun = getNextRunTime(automation)

                    return (
                        <div
                            key={automation.id}
                            className="glass-card p-5 rounded-2xl border border-white/10 hover:border-white/20 transition-all group relative overflow-hidden"
                        >
                            {/* Status Indicator */}
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary-accent to-transparent opacity-50"
                                style={{ opacity: automation.isActive ? 1 : 0.2 }} />

                            <div className="space-y-4">
                                {/* Header */}
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h4 className="font-bold text-base truncate">{automation.name}</h4>
                                            {automation.isActive ? (
                                                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 px-2 py-1 rounded-lg border border-green-500/30">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-white/5 text-muted-foreground px-2 py-1 rounded-lg border border-white/10">
                                                    <Circle className="w-3 h-3" />
                                                    Inactive
                                                </span>
                                            )}
                                        </div>
                                        {automation.description && (
                                            <p className="text-xs text-foreground/70 mb-3">{automation.description}</p>
                                        )}

                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3 h-3" />
                                                {getTriggerDisplay(automation)}
                                            </div>
                                            <div className="h-3 w-px bg-white/10" />
                                            <div>
                                                {automation.pipeline.length} {automation.pipeline.length === 1 ? 'step' : 'steps'}
                                            </div>
                                            {involvedAgents.length > 0 && (
                                                <>
                                                    <div className="h-3 w-px bg-white/10" />
                                                    <div className="flex items-center gap-1">
                                                        {involvedAgents.slice(0, 2).map(agentId => {
                                                            const agent = agents.find(a => a.id === agentId)
                                                            return (
                                                                <span key={agentId} className="text-primary-accent font-medium">
                                                                    {agent?.name}
                                                                </span>
                                                            )
                                                        })}
                                                        {involvedAgents.length > 2 && (
                                                            <span className="opacity-60">+{involvedAgents.length - 2}</span>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {nextRun && (
                                            <div className="mt-2 text-[10px] text-blue-400 bg-blue-500/10 px-2 py-1 rounded inline-block">
                                                Next run: {nextRun}
                                            </div>
                                        )}

                                        {automation.lastRunAt && (
                                            <div className="mt-2 text-[10px] text-muted-foreground italic">
                                                Last run: {new Date(automation.lastRunAt).toLocaleString()}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRunNow(automation.id)}
                                            className="h-8 text-xs border border-white/10 bg-white/5 hover:bg-white/10 rounded-lg"
                                            title="Run now"
                                        >
                                            <Play className="w-3 h-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleToggleActive(automation)}
                                            className={cn(
                                                "h-8 text-xs border rounded-lg",
                                                automation.isActive
                                                    ? "border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400"
                                                    : "border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-400"
                                            )}
                                            title={automation.isActive ? "Pause" : "Activate"}
                                        >
                                            {automation.isActive ? (
                                                <Pause className="w-3 h-3" />
                                            ) : (
                                                <Play className="w-3 h-3" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onEdit(automation.id)}
                                            className="h-8 text-xs border border-white/10 bg-white/5 hover:bg-white/10 rounded-lg"
                                            title="Edit"
                                        >
                                            <Edit className="w-3 h-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => handleDelete(e, automation.id)}
                                            className="h-8 text-xs border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
