import { useState } from 'react'
import { useStore } from '@/store'
import { Plus, Bot, Settings2, Edit, Trash2, Share, Upload, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgentEditor, ICON_OPTIONS } from './AgentEditor'
import { AutomationEditor } from './AutomationEditor'
import { WorkflowList } from './WorkflowList'
import { ask, message } from '@tauri-apps/plugin-dialog'
import { SharingService } from '@/services/SharingService'
import { cn } from '@/lib/utils'

export function AgentLab() {
    const { agents, automations, vaultPath, removeAgent } = useStore()
    const [isEditorOpen, setIsEditorOpen] = useState(false)
    const [editingAgentId, setEditingAgentId] = useState<string | undefined>(undefined)
    const [isAutomationEditorOpen, setIsAutomationEditorOpen] = useState(false)
    const [workflowAgentId, setWorkflowAgentId] = useState<string | undefined>(undefined)
    const [editingAutomationId, setEditingAutomationId] = useState<string | undefined>(undefined)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

    const handleCreateAgent = () => {
        setEditingAgentId(undefined)
        setIsEditorOpen(true)
    }

    const handleEditAgent = (id: string) => {
        setEditingAgentId(id)
        setIsEditorOpen(true)
    }

    const handleOpenWorkflow = (agentId: string) => {
        setWorkflowAgentId(agentId)
        setEditingAutomationId(undefined)
        setIsAutomationEditorOpen(true)
    }

    const handleEditAutomation = (automationId: string) => {
        setEditingAutomationId(automationId)
        setWorkflowAgentId(undefined)
        setIsAutomationEditorOpen(true)
    }

    const handleImport = async () => {
        try {
            const result = await SharingService.importFromFile()
            if (result) {
                await message(`Successfully imported ${result.type}: ${result.name}`, { title: 'Import Complete', kind: 'info' })
            }
        } catch (error) {
            await message(error instanceof Error ? error.message : String(error), { title: 'Import Failed', kind: 'error' })
        }
    }

    const handleExportAgent = async (id: string, name: string) => {
        try {
            await SharingService.exportAgent(id)
            await message(`Agent "${name}" exported successfully.`, { title: 'Export Complete', kind: 'info' })
        } catch (error) {
            await message(error instanceof Error ? error.message : String(error), { title: 'Export Failed', kind: 'error' })
        }
    }

    return (
        <div className="h-full flex flex-col bg-background/50 relative">
            {isEditorOpen && (
                <AgentEditor
                    agentId={editingAgentId}
                    onClose={() => setIsEditorOpen(false)}
                />
            )}

            {isAutomationEditorOpen && (
                <AutomationEditor
                    automationId={editingAutomationId}
                    defaultAgentId={workflowAgentId}
                    onClose={() => {
                        setIsAutomationEditorOpen(false)
                        setWorkflowAgentId(undefined)
                        setEditingAutomationId(undefined)
                    }}
                />
            )}

            {/* Header */}
            <div className="glass-theme border-b border-white/10 px-6 py-8 flex items-end justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Bot className="w-6 h-6 text-primary-accent" />
                        Agent Lab
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 text-foreground/60">
                        Create autonomous agents and define their workflows
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        onClick={handleImport}
                        className="gap-2 text-muted-foreground hover:text-white"
                    >
                        <Upload className="w-4 h-4" />
                        Import
                    </Button>

                    {!vaultPath && (
                        <div className="text-xs text-yellow-400 bg-yellow-500/10 px-3 py-1.5 rounded-lg border border-yellow-500/20 flex items-center gap-2">
                            <span>⚠️ Vault not configured</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs hover:bg-yellow-500/20"
                                onClick={() => useStore.getState().setCurrentView('settings')}
                            >
                                Fix
                            </Button>
                        </div>
                    )}
                    <Button
                        onClick={handleCreateAgent}
                        className="bg-primary-accent hover:opacity-90 text-white shadow-lg gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        New Agent
                    </Button>
                </div>
            </div>

            {/* View Toggle Bar */}
            <div className="px-6 py-2 flex items-center justify-between bg-white/5 border-b border-white/5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {agents.length} Agent{agents.length !== 1 ? 's' : ''} Configured
                </div>
                <div className="flex bg-black/40 border border-white/10 rounded-lg p-0.5">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={cn(
                            "p-1.5 rounded-md transition-all",
                            viewMode === 'grid' ? "bg-white/10 text-primary-accent" : "text-muted-foreground hover:text-white"
                        )}
                        title="Grid View"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={cn(
                            "p-1.5 rounded-md transition-all",
                            viewMode === 'list' ? "bg-white/10 text-primary-accent" : "text-muted-foreground hover:text-white"
                        )}
                        title="List View"
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 overflow-y-auto">
                {agents.length === 0 ? (
                    <div className="h-[400px] flex flex-col items-center justify-center text-center p-8 glass-card rounded-2xl border-dashed border-white/20">
                        <div className="w-16 h-16 rounded-full bg-primary-accent/10 flex items-center justify-center mb-4">
                            <Bot className="w-8 h-8 text-primary-accent" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No agents created yet</h3>
                        <p className="text-muted-foreground max-w-sm mb-6">
                            Create your first AI agent to start automating tasks and generating content in your vault.
                        </p>
                        <Button
                            onClick={handleCreateAgent}
                            className="bg-primary-accent hover:opacity-90 text-white shadow-lg"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Create First Agent
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={handleImport}
                            className="mt-4 gap-2 text-muted-foreground hover:text-white"
                        >
                            <Upload className="w-4 h-4" />
                            Import Agent from File
                        </Button>
                    </div>
                ) : (
                    <div className={cn(
                        viewMode === 'grid'
                            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                            : "space-y-3"
                    )}>
                        {agents.map(agent => {
                            const IconComponent = ICON_OPTIONS.find(i => i.id === agent.icon)?.icon || Bot
                            const color = agent.color || '#3b82f6'

                            if (viewMode === 'list') {
                                return (
                                    <div key={agent.id} className="glass-card p-3 rounded-xl hover:bg-white/5 transition-all group flex items-center gap-4 relative overflow-hidden border border-white/5">
                                        <div
                                            className="absolute left-0 top-0 bottom-0 w-1 opacity-40"
                                            style={{ backgroundColor: color }}
                                        />
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shadow-inner shrink-0"
                                            style={{ backgroundColor: `${color}15`, color: color }}
                                        >
                                            <IconComponent className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-sm truncate">{agent.name}</h4>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground uppercase font-bold tracking-tighter">
                                                    {agent.preferredModelId || 'Default'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground truncate opacity-70">
                                                {agent.description || 'No description provided.'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0">
                                            <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider hidden sm:block">
                                                {automations.filter(a => a.pipeline.some(step => step.agentId === agent.id)).length} Workflows
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 text-[11px] hover:bg-white/10 rounded-lg px-2"
                                                    onClick={() => handleOpenWorkflow(agent.id)}
                                                >
                                                    <Settings2 className="w-3.5 h-3.5 mr-1" />
                                                    Workflow
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEditAgent(agent.id)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-white"
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeAgent(agent.id)}
                                                    className="h-8 w-8 text-red-400/60 hover:text-red-400"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }

                            return (
                                <div key={agent.id} className="glass-card p-5 rounded-2xl hover:bg-white/5 transition-all group relative overflow-hidden">
                                    {/* Accent Background Glow */}
                                    <div
                                        className="absolute -right-4 -top-4 w-24 h-24 blur-[60px] opacity-20 transition-opacity group-hover:opacity-40"
                                        style={{ backgroundColor: color }}
                                    />

                                    <div className="flex items-start justify-between mb-4 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-inner border border-white/5"
                                                style={{ backgroundColor: `${color}15`, color: color }}
                                            >
                                                <IconComponent className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold tracking-tight">{agent.name}</h4>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60 truncate max-w-[120px]" title={agent.preferredModelId || 'Default Engine'}>
                                                    {agent.preferredModelId || 'Default Engine'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleExportAgent(agent.id, agent.name)}
                                                className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-white/10"
                                                title="Export Agent"
                                            >
                                                <Share className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEditAgent(agent.id)}
                                                className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-white/10"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={async (e) => {
                                                    e.stopPropagation()
                                                    e.preventDefault()
                                                    console.log('[AgentLab] Delete button clicked for agent:', agent.id, agent.name)

                                                    try {
                                                        const confirmed = await ask(`Are you sure you want to delete ${agent.name}? Any workflows using this agent will be deactivated.`, {
                                                            title: 'Delete Agent',
                                                            kind: 'warning'
                                                        })
                                                        console.log('[AgentLab] Confirm result:', confirmed)

                                                        if (confirmed) {
                                                            console.log('[AgentLab] Calling removeAgent...')
                                                            removeAgent(agent.id)
                                                            console.log('[AgentLab] removeAgent called')
                                                        }
                                                    } catch (err) {
                                                        console.error('[AgentLab] Dialog error:', err)
                                                        // Fallback if dialog fails
                                                        if (window.confirm(`Delete ${agent.name}?`)) {
                                                            removeAgent(agent.id)
                                                        }
                                                    }
                                                }}
                                                className="h-8 w-8 text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <p className="text-xs text-foreground/70 line-clamp-2 mb-6 h-8 leading-relaxed relative z-10">
                                        {agent.description || 'Dedicated workforce agent ready for deployment.'}
                                    </p>

                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5 relative z-10">
                                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                            {automations.filter(a => a.pipeline.some(step => step.agentId === agent.id)).length} Workflow{automations.filter(a => a.pipeline.some(step => step.agentId === agent.id)).length !== 1 ? 's' : ''}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs border-white/10 bg-black/20 hover:bg-white/10 rounded-lg group/btn shadow-sm"
                                                style={{ borderColor: `${color}30` }}
                                                onClick={() => handleOpenWorkflow(agent.id)}
                                            >
                                                <Settings2 className="w-3 h-3 mr-1.5 transition-transform group-hover/btn:rotate-90" />
                                                Workflow
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Workflows Section */}
                {automations.length > 0 && (
                    <div className="px-6 pb-8">
                        <WorkflowList onEdit={handleEditAutomation} />
                    </div>
                )}
            </div>
        </div>
    )
}
