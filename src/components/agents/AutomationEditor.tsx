import { useState, useEffect } from 'react'
import { useStore, Automation, PipelineStep, Trigger } from '@/store'
import { X, Save, Play, Pause, Workflow, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TriggerSelector } from './TriggerSelector'
import { PipelineCanvas } from './PipelineCanvas'
import { automationService } from '@/services/AutomationService'
import { SharingService } from '@/services/SharingService'
import { message } from '@tauri-apps/plugin-dialog'
import { cn } from '@/lib/utils'

interface AutomationEditorProps {
    automationId?: string
    defaultAgentId?: string  // Pre-select agent for first step
    onClose: () => void
}

export function AutomationEditor({ automationId, defaultAgentId, onClose }: AutomationEditorProps) {
    const { automations, addAutomation, updateAutomation } = useStore()

    // Form state
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [trigger, setTrigger] = useState<Trigger>({ type: 'manual' })
    const [pipeline, setPipeline] = useState<PipelineStep[]>([])
    const [isActive, setIsActive] = useState(false)

    // Load automation data if editing
    useEffect(() => {
        if (automationId) {
            const automation = automations.find(a => a.id === automationId)
            if (automation) {
                setName(automation.name)
                setDescription(automation.description || '')
                setTrigger(automation.trigger)
                setPipeline(automation.pipeline)
                setIsActive(automation.isActive)
            }
        } else if (defaultAgentId) {
            // Initialize with default agent in first step
            setPipeline([
                {
                    id: crypto.randomUUID(),
                    type: 'agent_action',
                    agentId: defaultAgentId,
                    prompt: '',
                    outputVariable: 'result'
                }
            ])
        }
    }, [automationId, automations, defaultAgentId])

    const handleSave = () => {
        if (!name.trim()) {
            alert('Please enter a workflow name')
            return
        }

        if (pipeline.length === 0) {
            alert('Please add at least one step to your workflow')
            return
        }

        // Validation for each step
        for (let i = 0; i < pipeline.length; i++) {
            const step = pipeline[i]
            const stepNum = i + 1

            if (step.type === 'agent_action') {
                if (!step.agentId) {
                    alert(`Step ${stepNum}: Please select an agent.`)
                    return
                }
                if (!step.prompt || !step.prompt.trim()) {
                    alert(`Step ${stepNum}: Please provide instructions for the agent.`)
                    return
                }
            } else if (step.type === 'save_to_vault') {
                if (!step.vaultPath) {
                    alert(`Step ${stepNum}: Please specify where to save the file in your vault.`)
                    return
                }
            }
        }

        const automationData: Partial<Automation> = {
            name,
            description,
            trigger,
            pipeline,
            isActive
        }

        if (automationId) {
            updateAutomation(automationId, automationData)
        } else {
            const newId = crypto.randomUUID()
            addAutomation({
                ...automationData,
                id: newId,
                createdAt: new Date().toISOString()
            } as Automation)

            // If active, start the automation
            if (isActive) {
                automationService.startAutomation(newId)
            }
        }

        onClose()
    }

    const handleRunNow = () => {
        if (automationId) {
            automationService.runNow(automationId)
        }
    }

    const handleToggleActive = () => {
        const newActiveState = !isActive
        setIsActive(newActiveState)

        if (automationId) {
            if (newActiveState) {
                automationService.startAutomation(automationId)
            } else {
                automationService.stopAutomation(automationId)
            }
        }
    }

    const handleExport = async () => {
        if (!automationId) return
        try {
            await SharingService.exportAutomation(automationId)
            await message(`Workflow "${name}" exported successfully.`, { title: 'Export Complete', kind: 'info' })
        } catch (error) {
            await message(error instanceof Error ? error.message : String(error), { title: 'Export Failed', kind: 'error' })
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300 overflow-y-auto">
            <div className="glass-panel w-full max-w-4xl my-8 flex flex-col rounded-3xl border border-white/20 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                            <Workflow className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">
                                {automationId ? 'Edit Workflow' : 'Create New Workflow'}
                            </h2>
                            <p className="text-xs text-muted-foreground font-medium opacity-60">
                                Build multi-step automation pipelines
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {automationId && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleExport}
                                    className="border-white/10 bg-white/5 hover:bg-white/10 rounded-xl gap-2"
                                    title="Export Workflow"
                                >
                                    <Share className="w-4 h-4" />
                                    Export
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRunNow}
                                    className="border-white/10 bg-white/5 hover:bg-white/10 rounded-xl"
                                >
                                    <Play className="w-3 h-3 mr-1.5" />
                                    Run Now
                                </Button>
                            </>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2 block">
                                Workflow Name
                            </label>
                            <input
                                type="text"
                                className="glass-strong w-full px-5 py-4 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-white/20 transition-all border border-white/5"
                                placeholder="e.g., Daily News Summary"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2 block">
                                Description (optional)
                            </label>
                            <input
                                type="text"
                                className="glass-strong w-full px-5 py-4 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-white/20 transition-all border border-white/5"
                                placeholder="Briefly describe what this workflow does..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Trigger Configuration */}
                    <div>
                        <TriggerSelector
                            trigger={trigger}
                            onChange={setTrigger}
                        />
                    </div>

                    {/* Pipeline */}
                    <div>
                        <PipelineCanvas
                            steps={pipeline}
                            onChange={setPipeline}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex items-center justify-between gap-3 bg-white/5 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleToggleActive}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all",
                                isActive
                                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                    : "bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10"
                            )}
                        >
                            {isActive ? (
                                <>
                                    <Pause className="w-4 h-4" />
                                    Active
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" />
                                    Inactive
                                </>
                            )}
                        </button>
                        {isActive && trigger.type === 'schedule' && (
                            <span className="text-xs text-muted-foreground italic">
                                Workflow will run automatically
                            </span>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            className="rounded-xl px-6"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!name.trim() || pipeline.length === 0}
                            className="bg-primary-accent hover:opacity-90 text-white min-w-[140px] rounded-xl font-bold shadow-xl transition-all active:scale-95"
                        >
                            <Save className="w-4 h-4 mr-2 text-white/70" />
                            {automationId ? 'Update' : 'Create'} Workflow
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
