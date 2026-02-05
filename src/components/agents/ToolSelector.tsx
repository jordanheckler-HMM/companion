import { Check, AlertCircle } from 'lucide-react'
import { useStore } from '@/store'
import { ToolService } from '@/services/toolService'

const AVAILABLE_TOOLS = [
    { id: 'web_search', name: 'Web Search', description: 'Search the internet for information' },
    { id: 'file_operations', name: 'File System', description: 'Read and write files in the Vault' },
    { id: 'execute_command', name: 'Terminal', description: 'Run shell commands (Sandbox)', dangerous: true },
    { id: 'browser', name: 'Browser', description: 'Visit and interact with websites', beta: true },
    { id: 'notion', name: 'Notion', description: 'Read and write to Notion pages', integration: true },
    { id: 'github', name: 'GitHub', description: 'Manage issues, PRs, and repos', integration: true },
    { id: 'google_calendar', name: 'Google Calendar', description: 'Manage calendar events', integration: true },
]

interface ToolSelectorProps {
    selectedTools: string[]
    onChange: (tools: string[]) => void
}

export function ToolSelector({ selectedTools, onChange }: ToolSelectorProps) {
    const { settings } = useStore()
    const { aiSettings } = settings
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

    const isConnected = (toolId: string) => {
        switch (toolId) {
            case 'notion': return !!aiSettings.notionApiKey
            case 'github': return !!aiSettings.githubApiKey
            case 'google_calendar': return !!(aiSettings.googleCalendarApiKey || aiSettings.googleCalendarOAuthToken)
            default: return true
        }
    }

    const toggleTool = (toolId: string) => {
        if (selectedTools.includes(toolId)) {
            onChange(selectedTools.filter(t => t !== toolId))
        } else {
            onChange([...selectedTools, toolId])
        }
    }

    return (
        <div className="glass-strong rounded-xl overflow-hidden">
            <div className="bg-white/5 px-4 py-2 border-b border-white/5">
                <p className="text-xs font-semibold text-muted-foreground">Available Tools</p>
            </div>
            <div className="divide-y divide-white/5">
                {AVAILABLE_TOOLS.map(tool => {
                    const isSelected = selectedTools.includes(tool.id)
                    const connected = isConnected(tool.id)
                    const statusInfo = toolStatusMap[tool.id]
                    const status = statusInfo?.status || 'disabled'
                    const badge = statusBadge(status)
                    const isUnavailable = status === 'wip' || status === 'disabled'

                    return (
                        <div
                            key={tool.id}
                            onClick={() => {
                                if (isUnavailable) return
                                toggleTool(tool.id)
                            }}
                            className={`flex items-center justify-between p-3 transition-colors ${isUnavailable ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${isSelected ? 'bg-primary-accent/10' : 'hover:bg-white/5'}`}
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{tool.name}</span>
                                    {tool.dangerous && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Risky</span>}
                                    {tool.beta && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Beta</span>}
                                    <span
                                        title={statusInfo?.statusMessage || 'Tool is disabled.'}
                                        className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-semibold tracking-wide ${badge.className}`}
                                    >
                                        {badge.label}
                                    </span>
                                    {tool.integration && !connected && (
                                        <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            Not Connected
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">{tool.description}</p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-primary-accent border-primary-accent' : 'border-white/20'}`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
