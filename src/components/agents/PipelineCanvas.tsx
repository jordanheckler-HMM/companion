import { PipelineStep } from '@/store'
import { Plus, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StepCard } from './StepCard'

interface PipelineCanvasProps {
    steps: PipelineStep[]
    onChange: (steps: PipelineStep[]) => void
}

export function PipelineCanvas({ steps, onChange }: PipelineCanvasProps) {
    const addStep = (type: PipelineStep['type'] = 'agent_action') => {
        const newStep: PipelineStep = {
            id: crypto.randomUUID(),
            type,
            agentId: undefined,
            prompt: '',
            outputVariable: ''
        }
        onChange([...steps, newStep])
    }

    const updateStep = (index: number, updatedStep: PipelineStep) => {
        const newSteps = [...steps]
        newSteps[index] = updatedStep
        onChange(newSteps)
    }

    const deleteStep = (index: number) => {
        onChange(steps.filter((_, i) => i !== index))
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 flex items-center gap-2">
                    <Workflow className="w-3 h-3 text-primary-accent" />
                    Pipeline Steps
                </label>
                <span className="text-xs text-muted-foreground">
                    {steps.length} {steps.length === 1 ? 'step' : 'steps'}
                </span>
            </div>

            {steps.length === 0 ? (
                <div className="glass-card p-8 rounded-2xl border-dashed border-white/20 text-center">
                    <div className="w-12 h-12 rounded-full bg-primary-accent/10 flex items-center justify-center mx-auto mb-4">
                        <Workflow className="w-6 h-6 text-primary-accent" />
                    </div>
                    <h4 className="text-sm font-bold mb-2">No Steps Yet</h4>
                    <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
                        Build your automation pipeline by adding steps. Each step can run an agent, save results, or perform actions.
                    </p>
                    <Button
                        onClick={() => addStep('agent_action')}
                        className="bg-primary-accent hover:opacity-90 text-white rounded-xl"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add First Step
                    </Button>
                </div>
            ) : (
                <div className="space-y-6">
                    {steps.map((step, index) => (
                        <div key={step.id} className="relative">
                            <StepCard
                                step={step}
                                stepNumber={index + 1}
                                allSteps={steps}
                                onChange={(updated) => updateStep(index, updated)}
                                onDelete={() => deleteStep(index)}
                            />

                            {/* Connector Line */}
                            {index < steps.length - 1 && (
                                <div className="flex items-center justify-center my-2">
                                    <div className="w-px h-6 bg-gradient-to-b from-white/20 to-transparent" />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Add Step Button */}
                    <div className="flex items-center justify-center">
                        <Button
                            onClick={() => addStep('agent_action')}
                            variant="outline"
                            className="border-white/10 bg-white/5 hover:bg-white/10 rounded-xl gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Add Step
                        </Button>
                    </div>
                </div>
            )}

            {steps.length > 0 && (
                <div className="glass-strong p-4 rounded-xl border border-white/5 mt-6">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-lg">💡</span>
                        </div>
                        <div className="text-xs text-foreground/70 leading-relaxed">
                            <strong className="text-foreground">Pipeline Execution:</strong> Steps run sequentially. Use output variables to pass data between steps. For example, Step 1's output can be referenced in Step 2 using <code className="bg-white/5 px-1 py-0.5 rounded text-[10px]">{"{{step1_output}}"}</code>.
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
