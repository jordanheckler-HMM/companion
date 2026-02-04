import { useState, useEffect } from 'react'
import { FileText, Github, Calendar, AlertCircle, Database } from 'lucide-react'
import { useStore } from '@/store'

interface IntegrationActionConfigProps {
    integrationId?: string
    integrationAction?: string
    integrationArgs?: Record<string, string>
    onChange: (updates: {
        integrationId?: string
        integrationAction?: string
        integrationArgs?: Record<string, string>
    }) => void
}

const INTEGRATIONS = [
    {
        id: 'notion',
        name: 'Notion',
        icon: FileText,
        actions: [
            { id: 'create_page', name: 'Create Page', args: ['parentId', 'title', 'content'] },
            { id: 'search', name: 'Search Pages', args: ['query'] },
            { id: 'get_page', name: 'Get Page Content', args: ['pageId'] }
        ]
    },
    {
        id: 'github',
        name: 'GitHub',
        icon: Github,
        actions: [
            { id: 'create_issue', name: 'Create Issue', args: ['repo', 'title', 'body', 'labels'] },
            { id: 'list_issues', name: 'List Issues', args: ['repo', 'state'] },
            { id: 'get_file', name: 'Get File Content', args: ['repo', 'path'] }
        ]
    },
    {
        id: 'google_calendar',
        name: 'Google Calendar',
        icon: Calendar,
        actions: [
            { id: 'create_event', name: 'Create Event', args: ['title', 'startTime', 'endTime', 'description'] },
            { id: 'list_events', name: 'List Events', args: ['count'] }
        ]
    },
    {
        id: 'supabase',
        name: 'Supabase',
        icon: Database,
        actions: [
            { id: 'query', name: 'Query Table', args: ['table', 'select', 'filter', 'limit', 'order'] },
            { id: 'insert', name: 'Insert Row', args: ['table', 'data'] },
            { id: 'rpc', name: 'Call Function (RPC)', args: ['functionName', 'args'] }
        ]
    }
]

const PRESETS: Record<string, Array<{
    name: string
    description: string
    actionId: string
    args: Record<string, string>
}>> = {
    supabase: [
        {
            name: "Pull New Leads",
            description: "Get the 10 most recent new leads",
            actionId: "query",
            args: { table: "leads", select: "*", filter: "status=new", limit: "10", order: "created_at:desc" }
        },
        {
            name: "Daily Health Check",
            description: "Get recent error logs",
            actionId: "query",
            args: { table: "logs", select: "*", filter: "level=error", limit: "50", order: "created_at:desc" }
        },
        {
            name: "Top Users",
            description: "Get top 5 users by revenue",
            actionId: "query",
            args: { table: "users", select: "*", limit: "5", order: "revenue:desc" }
        }
    ],
    notion: [
        {
            name: "Daily Journal",
            description: "Create a new daily entry",
            actionId: "create_page",
            args: { title: "{{date}} Journal", parentId: "YOUR_DATABASE_ID", content: "## Daily Goals\n- [ ] " }
        },
        {
            name: "Search Pages",
            description: "Find pages mentioning a topic",
            actionId: "search",
            args: { query: "{{topic}}" }
        }
    ],
    github: [
        {
            name: "List Bugs",
            description: "Get open bug issues",
            actionId: "list_issues",
            args: { repo: "owner/repo", state: "open", labels: "bug" }
        },
        {
            name: "Morning Review",
            description: "Get recent pull requests",
            actionId: "list_issues",
            args: { repo: "owner/repo", state: "open" }
        }
    ],
    google_calendar: [
        {
            name: "Today's Schedule",
            description: "Get events for the next 12 hours",
            actionId: "list_events",
            args: { count: "10" }
        },
        {
            name: "Block Focus Time",
            description: "Create a 1-hour focus block",
            actionId: "create_event",
            args: { title: "Focus Time", duration: "60", description: "Deep work session" }
        }
    ]
}

export function IntegrationActionConfig({ integrationId, integrationAction, integrationArgs, onChange }: IntegrationActionConfigProps) {
    const { settings } = useStore()
    const [selectedIntegration, setSelectedIntegration] = useState(integrationId)
    const [selectedAction, setSelectedAction] = useState(integrationAction)
    const [args, setArgs] = useState<Record<string, string>>(integrationArgs || {})

    useEffect(() => {
        setSelectedIntegration(integrationId)
        setSelectedAction(integrationAction)
        setArgs(integrationArgs || {})
    }, [integrationId, integrationAction, integrationArgs])

    const handleIntegrationChange = (id: string) => {
        setSelectedIntegration(id)
        setSelectedAction(undefined)
        setArgs({})
        onChange({ integrationId: id, integrationAction: undefined, integrationArgs: {} })
    }

    const handleActionChange = (actionId: string) => {
        setSelectedAction(actionId)
        // Reset args but keep common ones if useful? Nah, safer to reset.
        setArgs({})
        onChange({ integrationId: selectedIntegration, integrationAction: actionId, integrationArgs: {} })
    }

    const handleArgChange = (key: string, value: string) => {
        const newArgs = { ...args, [key]: value }
        setArgs(newArgs)
        onChange({ integrationId: selectedIntegration, integrationAction: selectedAction, integrationArgs: newArgs })
    }

    const handlePresetSelect = (preset: typeof PRESETS['supabase'][0]) => {
        setSelectedAction(preset.actionId)
        setArgs(preset.args)
        onChange({ integrationId: selectedIntegration, integrationAction: preset.actionId, integrationArgs: preset.args })
    }

    const currentIntegration = INTEGRATIONS.find(i => i.id === selectedIntegration)
    const currentAction = currentIntegration?.actions.find(a => a.id === selectedAction)

    const isConnected = (id: string) => {
        switch (id) {
            case 'notion': return !!settings.aiSettings.notionApiKey
            case 'github': return !!settings.aiSettings.githubApiKey
            case 'google_calendar': return !!settings.aiSettings.googleCalendarApiKey
            case 'supabase': return !!settings.aiSettings.toolsEnabled?.supabase?.enabled
            default: return true
        }
    }

    return (
        <div className="space-y-4">
            {/* Integration Selector */}
            <div className="grid grid-cols-3 gap-2">
                {INTEGRATIONS.map(integration => {
                    const Icon = integration.icon
                    const isSelected = selectedIntegration === integration.id
                    const connected = isConnected(integration.id)

                    return (
                        <div
                            key={integration.id}
                            onClick={() => handleIntegrationChange(integration.id)}
                            className={`
                                cursor-pointer rounded-lg border p-3 flex flex-col items-center gap-2 transition-all
                                ${isSelected
                                    ? 'bg-primary-accent/10 border-primary-accent text-primary-accent'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                }
                            `}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="text-xs font-medium">{integration.name}</span>
                            {!connected && (
                                <div className="absolute top-1 right-1">
                                    <AlertCircle className="w-3 h-3 text-yellow-500" />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Connection Warning */}
            {selectedIntegration && !isConnected(selectedIntegration) && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
                    <div className="text-xs text-yellow-200">
                        <p className="font-semibold">Not Connected</p>
                        <p>Please configure your API key in Settings to use this integration.</p>
                    </div>
                </div>
            )}


            {/* Action Selector */}
            {selectedIntegration && currentIntegration && (
                <div className="space-y-4">
                    {PRESETS[selectedIntegration] && (
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Smart Presets</label>
                            <div className="grid grid-cols-1 gap-2">
                                {PRESETS[selectedIntegration].map((preset, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handlePresetSelect(preset)}
                                        className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-colors text-left group"
                                    >
                                        <div>
                                            <div className="text-sm font-medium text-cyan-400 group-hover:text-cyan-300">{preset.name}</div>
                                            <div className="text-xs text-muted-foreground">{preset.description}</div>
                                        </div>
                                        <div className="text-[10px] px-2 py-1 rounded bg-black/40 text-muted-foreground">
                                            Auto-fill
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Manual Action</label>
                        <select
                            value={selectedAction || ''}
                            onChange={(e) => handleActionChange(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyan-500/50"
                        >
                            <option value="" disabled>Select an action...</option>
                            {currentIntegration.actions.map(action => (
                                <option key={action.id} value={action.id}>{action.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Argument Inputs */}
                    {currentAction && (
                        <div className="space-y-3 pt-2 border-t border-white/5">
                            {currentAction.args.map(argKey => (
                                <div key={argKey} className="space-y-1">
                                    <label className="text-xs text-muted-foreground capitalize">{argKey.replace(/([A-Z])/g, ' $1').trim()}</label>
                                    <input
                                        type="text"
                                        value={args[argKey] || ''}
                                        onChange={(e) => handleArgChange(argKey, e.target.value)}
                                        placeholder={`Enter ${argKey}...`}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-cyan-500/50"
                                    />
                                    <p className="text-[10px] text-white/30">Use <span className="text-cyan-400 font-mono">{'{{variable}}'}</span> to insert values from previous steps.</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
