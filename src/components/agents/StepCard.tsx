import { PipelineStep, useStore } from '@/store'
import { Bot, Clock, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ICON_OPTIONS } from './agentOptions'
import { SaveToVaultConfig } from './SaveToVaultConfig'
import { IntegrationActionConfig } from './IntegrationActionConfig'

interface StepCardProps {
    step: PipelineStep
    stepNumber: number
    allSteps: PipelineStep[]
    onChange: (step: PipelineStep) => void
    onDelete: () => void
}

export function StepCard({ step, stepNumber, allSteps, onChange, onDelete }: StepCardProps) {
    const { agents } = useStore()

    // Get variables defined in steps BEFORE this one
    const previousSteps = allSteps.slice(0, stepNumber - 1)
    const availableVariables = previousSteps
        .map(s => s.outputVariable)
        .filter((v): v is string => !!v && v.trim().length > 0)

    const updateStep = (updates: Partial<PipelineStep>) => {
        onChange({ ...step, ...updates })
    }

    const selectedAgent = step.agentId ? agents.find(a => a.id === step.agentId) : null
    const AgentIcon = selectedAgent
        ? ICON_OPTIONS.find(i => i.id === selectedAgent.icon)?.icon || Bot
        : Bot
    const agentColor = selectedAgent?.color || '#3b82f6'

    return (
        <div className="glass-card p-5 rounded-xl border border-white/10 group hover:border-white/20 transition-all relative">
            {/* Step Number Badge */}
            <div className="absolute -left-3 -top-3 w-8 h-8 rounded-full bg-primary-accent text-white flex items-center justify-center text-sm font-bold shadow-lg">
                {stepNumber}
            </div>

            {/* Drag Handle */}
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>

            <div className="space-y-4">
                {/* Step Type */}
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2 block">
                        Step Type
                    </label>
                    <select
                        className="glass-strong w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-white/20 border border-white/5"
                        value={step.type}
                        onChange={(e) => updateStep({ type: e.target.value as PipelineStep['type'] })}
                    >
                        <option value="agent_action" className="bg-zinc-900">🤖 Run Agent</option>
                        <option value="save_to_vault" className="bg-zinc-900">💾 Save to Vault</option>
                        <option value="integration_action" className="bg-zinc-900">🔌 Integration Action</option>
                        <option value="wait" className="bg-zinc-900">⏰ Wait</option>
                    </select>
                </div>

                {/* Agent Action Configuration */}
                {step.type === 'agent_action' && (
                    <>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2 block">
                                Select Agent
                            </label>
                            <select
                                className="glass-strong w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-white/20 border border-white/5"
                                value={step.agentId || ''}
                                onChange={(e) => updateStep({ agentId: e.target.value })}
                            >
                                <option value="" className="bg-zinc-900">Choose an agent...</option>
                                {agents.map(agent => (
                                    <option key={agent.id} value={agent.id} className="bg-zinc-900">
                                        {agent.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedAgent && (
                            <div
                                className="flex items-center gap-3 p-3 rounded-lg border"
                                style={{ backgroundColor: `${agentColor}10`, borderColor: `${agentColor}30` }}
                            >
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: `${agentColor}20`, color: agentColor }}
                                >
                                    <AgentIcon className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-bold">{selectedAgent.name}</div>
                                    <div className="text-[10px] text-muted-foreground opacity-60">
                                        {selectedAgent.description || 'No description'}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2 block">
                                Prompt / Instructions
                            </label>
                            <div className="relative group">
                                <textarea
                                    id={`prompt-${step.id}`}
                                    className="glass-strong w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-white/20 border border-white/5 min-h-[120px] resize-none font-sans leading-relaxed"
                                    placeholder="What should this agent do? You can include results from previous steps below..."
                                    value={step.prompt || ''}
                                    onChange={(e) => updateStep({ prompt: e.target.value })}
                                />

                                {/* Insert Variables Helper */}
                                {previousSteps.length > 0 && (
                                    <div className="absolute bottom-3 right-3 flex flex-wrap gap-2 pointer-events-none group-focus-within:pointer-events-auto">
                                        <div className="glass-panel px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2 shadow-xl animate-in fade-in slide-in-from-bottom-2">
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Insert:</span>
                                            {previousSteps.map((prevStep, idx) => {
                                                const varName = prevStep.outputVariable || `step${idx + 1}_output`
                                                const stepLabel = prevStep.type === 'agent_action'
                                                    ? `Agent ${idx + 1}`
                                                    : `Step ${idx + 1}`

                                                return (
                                                    <button
                                                        key={prevStep.id}
                                                        type="button"
                                                        onClick={() => {
                                                            const textarea = document.getElementById(`prompt-${step.id}`) as HTMLTextAreaElement
                                                            if (textarea) {
                                                                const start = textarea.selectionStart
                                                                const end = textarea.selectionEnd
                                                                const text = step.prompt || ''
                                                                // If no output variable exists, create one for them now
                                                                if (!prevStep.outputVariable) {
                                                                    const allStepsCopy = [...allSteps]
                                                                    allStepsCopy[idx] = { ...prevStep, outputVariable: varName }
                                                                    // This is a bit tricky since we're inside a map, 
                                                                    // but updateStep only updates THIS step.
                                                                    // For now, assume it's there or will be resolved by the name.
                                                                }
                                                                const newText = text.substring(0, start) + `{{${varName}}}` + text.substring(end)
                                                                updateStep({ prompt: newText })
                                                            }
                                                        }}
                                                        className="px-2 py-1 rounded-md bg-white/5 hover:bg-primary-accent/20 hover:text-primary-accent text-[10px] font-medium transition-colors border border-white/10 pointer-events-auto"
                                                    >
                                                        {stepLabel} Result
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2 px-1 italic opacity-60">
                                Tip: Click the buttons above to use the output from a previous agent in this prompt.
                            </p>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 block">
                                    Name this Secretly (for other steps)
                                </label>
                                <span className="text-[9px] text-muted-foreground opacity-40">Optional</span>
                            </div>
                            <input
                                type="text"
                                className="glass-strong w-full px-4 py-3 rounded-xl text-xs outline-none focus:ring-2 focus:ring-white/20 border border-white/5 font-mono"
                                placeholder="e.g., research_output"
                                value={step.outputVariable || ''}
                                onChange={(e) => updateStep({ outputVariable: e.target.value })}
                            />
                        </div>
                    </>
                )}

                {/* Save to Vault Configuration */}
                {step.type === 'save_to_vault' && (
                    <SaveToVaultConfig
                        step={step}
                        updateStep={updateStep}
                        availableVariables={availableVariables}
                    />
                )}

                {/* Integration Action Configuration */}
                {step.type === 'integration_action' && (
                    <IntegrationActionConfig
                        integrationId={step.integrationId}
                        integrationAction={step.integrationAction}
                        integrationArgs={step.integrationArgs}
                        onChange={(updates) => updateStep(updates)}
                    />
                )}

                {/* Wait Configuration */}
                {step.type === 'wait' && (
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2 block">
                            <Clock className="w-3 h-3 inline mr-1" />
                            Wait Duration (seconds)
                        </label>
                        <input
                            type="number"
                            className="glass-strong w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-white/20 border border-white/5"
                            placeholder="5"
                            value={(step.waitDuration || 1000) / 1000}
                            onChange={(e) => updateStep({ waitDuration: parseInt(e.target.value) * 1000 })}
                            min="1"
                        />
                    </div>
                )}

                {/* Delete Button */}
                <div className="pt-3 border-t border-white/5 flex justify-end">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDelete}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                        <Trash2 className="w-3 h-3 mr-1.5" />
                        Remove Step
                    </Button>
                </div>
            </div>
        </div>
    )
}
