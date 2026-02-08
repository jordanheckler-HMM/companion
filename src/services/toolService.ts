import { URLReaderTool } from './tools/urlReaderTool'
import { WebSearchTool } from './tools/webSearchTool'
import { FileSystemTool } from './tools/fileSystemTool'
import { CodeExecutionTool } from './tools/codeExecutionTool'
import { GoogleCalendarTool } from './tools/googleCalendarTool'
import { NotionTool } from './tools/notionTool'
import { GitHubTool } from './tools/githubTool'
import { NotificationTool } from './tools/notificationTool'
import { SupabaseTool } from './tools/supabaseTool'
import { CreateAgentTool } from './tools/createAgentTool'
import { CreateWorkflowTool } from './tools/createWorkflowTool'

import { ErrorLogger, ErrorSeverity } from '../utils/errorLogger'


export type ToolStatus = 'active' | 'limited' | 'wip' | 'disabled'

export interface ToolDefinition {
    name: string
    description: string
    status?: ToolStatus
    statusMessage?: string
    allowedActions?: string[]
    parameters: {
        type: 'object'
        properties: Record<string, {
            type: string
            description: string
            enum?: string[]
            items?: {
                type: string
            }
        }>
        required: string[]
    }
}

export interface ToolResult {
    tool: string
    result: string
    isError?: boolean
    error?: {
        error: 'TOOL_NOT_READY'
        tool: string
        status: ToolStatus
        message: string
    }
}

export class ToolService {
    private static readonly DEFAULT_STATUS_MESSAGE: Record<ToolStatus, string> = {
        active: 'Tool is active.',
        limited: 'Tool is limited.',
        wip: 'Tool is a work in progress.',
        disabled: 'Tool is disabled.'
    }

    private static tools: ToolDefinition[] = [
        {
            name: 'web_search',
            description: 'Search the web using DuckDuckGo to get real-time information.',
            status: 'wip',
            statusMessage: 'Web Search is still being finalized and cannot run yet.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The search query'
                    }
                },
                required: ['query']
            }
        },
        {
            name: 'url_reader',
            description: 'Fetch and read the content of a specific URL.',
            status: 'active',
            parameters: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'The URL to read'
                    }
                },
                required: ['url']
            }
        },
        {
            name: 'file_system',
            description: 'Perform file system operations: read, write, or list files.',
            status: 'active',
            parameters: {
                type: 'object',
                properties: {
                    operation: {
                        type: 'string',
                        description: 'The operation to perform',
                        enum: ['read', 'write', 'list']
                    },
                    path: {
                        type: 'string',
                        description: 'The file or directory path'
                    },
                    content: {
                        type: 'string',
                        description: 'Content to write (for write operation)'
                    }
                },
                required: ['operation', 'path']
            }
        },
        {
            name: 'execute_code',
            description: 'Execute local Python or JavaScript code for computation-only tasks (file/network/process operations are blocked).',
            status: 'active',
            parameters: {
                type: 'object',
                properties: {
                    language: {
                        type: 'string',
                        description: 'The programming language',
                        enum: ['python', 'javascript']
                    },
                    code: {
                        type: 'string',
                        description: 'The code to execute'
                    }
                },
                required: ['language', 'code']
            }
        },
        {
            name: 'google_calendar',
            description: 'Interact with Google Calendar. CAUTION: This tool requires a Google Calendar API Key configured in Settings.',
            status: 'wip',
            statusMessage: 'Google Calendar integration is still in progress and cannot run yet.',
            parameters: {
                type: 'object',
                properties: {
                    operation: {
                        type: 'string',
                        description: 'The operation to perform',
                        enum: ['list', 'create', 'search']
                    },
                    phase: {
                        type: 'string',
                        description: 'Execution phase: discovery, prepare, execute',
                        enum: ['discovery', 'prepare', 'execute']
                    },
                    confirm: {
                        type: 'boolean',
                        description: 'Explicit confirmation for execution'
                    },
                    confirmationId: {
                        type: 'string',
                        description: 'Confirmation ID from prepare phase'
                    },
                    count: {
                        type: 'number',
                        description: 'Number of events to return (for list operation). Default is 10.'
                    },
                    calendarId: {
                        type: 'string',
                        description: 'Calendar ID (optional; defaults to "primary" for OAuth, required for public API key access)'
                    },
                    publicCalendar: {
                        type: 'boolean',
                        description: 'Set true to acknowledge calendar is public when using API key'
                    },
                    title: {
                        type: 'string',
                        description: 'Event title (required for create operation)'
                    },
                    startTime: {
                        type: 'string',
                        description: 'Event start time in ISO format (required for create operation)'
                    },
                    endTime: {
                        type: 'string',
                        description: 'Event end time in ISO format (required for create operation)'
                    },
                    description: {
                        type: 'string',
                        description: 'Event description (optional for create operation)'
                    },
                    timeZone: {
                        type: 'string',
                        description: 'Event time zone (optional for create operation)'
                    },
                    location: {
                        type: 'string',
                        description: 'Event location (optional for create operation)'
                    },
                    query: {
                        type: 'string',
                        description: 'Search query (required for search operation)'
                    }
                },
                required: ['operation']
            }
        },
        {
            name: 'notion',
            description: 'Interact with Notion workspace. CAUTION: This tool requires a Notion Integration Token configured in Settings.',
            status: 'limited',
            statusMessage: 'Notion is limited to read-only operations (search, get).',
            allowedActions: ['search', 'get'],
            parameters: {
                type: 'object',
                properties: {
                    operation: {
                        type: 'string',
                        description: 'The operation to perform',
                        enum: ['search', 'get', 'create']
                    },
                    query: {
                        type: 'string',
                        description: 'Search query (for search operation). Leave empty to list recent pages.'
                    },
                    pageId: {
                        type: 'string',
                        description: 'Page ID (required for get operation)'
                    },
                    title: {
                        type: 'string',
                        description: 'Page title (required for create operation)'
                    },
                    parentId: {
                        type: 'string',
                        description: 'Parent page ID (required for create operation)'
                    },
                    content: {
                        type: 'string',
                        description: 'Page content (optional for create operation)'
                    }
                },
                required: ['operation']
            }
        },
        {
            name: 'github',
            description: 'Interact with GitHub. CAUTION: This tool requires a GitHub Personal Access Token configured in Settings.',
            status: 'limited',
            statusMessage: 'GitHub is limited to read-only operations (repos, issues, prs, get_file).',
            allowedActions: ['repos', 'issues', 'prs', 'get_file'],
            parameters: {
                type: 'object',
                properties: {
                    operation: {
                        type: 'string',
                        description: 'The operation to perform',
                        enum: ['repos', 'issues', 'prs', 'create_issue', 'get_file']
                    },
                    phase: {
                        type: 'string',
                        description: 'Execution phase: discovery, prepare, execute',
                        enum: ['discovery', 'prepare', 'execute']
                    },
                    confirm: {
                        type: 'boolean',
                        description: 'Explicit confirmation for execution'
                    },
                    confirmationId: {
                        type: 'string',
                        description: 'Confirmation ID from prepare phase'
                    },
                    repo: {
                        type: 'string',
                        description: 'Repository in format "owner/repo" (required for issues, prs, create_issue, get_file)'
                    },
                    path: {
                        type: 'string',
                        description: 'File path (optional for get_file operation, defaults to README.md)'
                    },
                    username: {
                        type: 'string',
                        description: 'GitHub username (optional. Leave empty/undefined to list the authenticated user\'s repositories)'
                    },
                    state: {
                        type: 'string',
                        description: 'Issue/PR state (optional, default: open)',
                        enum: ['open', 'closed', 'all']
                    },
                    limit: {
                        type: 'number',
                        description: 'Number of items to return (optional, default 10)'
                    },
                    title: {
                        type: 'string',
                        description: 'Issue title (required for create_issue operation)'
                    },
                    body: {
                        type: 'string',
                        description: 'Issue description (optional for create_issue operation)'
                    },
                    labels: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Issue labels (optional for create_issue operation)'
                    }
                },
                required: ['operation']
            }
        },
        {
            name: 'send_notification',
            description: 'Send a native system notification to the user.',
            status: 'active',
            parameters: {
                type: 'object',
                properties: {
                    title: {
                        type: 'string',
                        description: 'The title of the notification'
                    },
                    body: {
                        type: 'string',
                        description: 'The message body of the notification'
                    }
                },
                required: ['title', 'body']
            }
        },
        {
            name: 'supabase',
            description: 'Interact with a connected Supabase project (BYOK). Use this to query tables or manage data.',
            status: 'limited',
            statusMessage: 'Supabase is limited to read-only operations (list_tables, get_tables, get_sample_rows, count_rows, query).',
            allowedActions: ['list_tables', 'get_tables', 'get_sample_rows', 'count_rows', 'query'],
            parameters: {
                type: 'object',
                properties: {
                    operation: {
                        type: 'string',
                        description: 'The operation to perform',
                        enum: ['list_tables', 'get_tables', 'get_sample_rows', 'count_rows', 'query', 'insert', 'update']
                    },
                    phase: {
                        type: 'string',
                        description: 'Execution phase: discovery, prepare, execute',
                        enum: ['discovery', 'prepare', 'execute']
                    },
                    confirm: {
                        type: 'boolean',
                        description: 'Explicit confirmation for execution'
                    },
                    confirmationId: {
                        type: 'string',
                        description: 'Confirmation ID from prepare phase'
                    },
                    privacyBoundary: {
                        type: 'string',
                        description: 'Privacy boundary for writes',
                        enum: ['personal', 'team']
                    },
                    sync: {
                        type: 'boolean',
                        description: 'Explicitly confirm this write is a sync from local state'
                    },
                    table: {
                        type: 'string',
                        description: 'Table name (required for query, insert, update, get_sample_rows, count_rows)'
                    },
                    limit: {
                        type: 'number',
                        description: 'Number of rows to return (optional for get_sample_rows, default 5)'
                    },
                    query: {
                        type: 'object',
                        description: 'Query object for "query" operation (e.g. { select: "*", eq: { id: 1 } })'
                    },
                    data: {
                        type: 'object',
                        description: 'Data object for insert/update'
                    },
                    id: {
                        type: 'string',
                        description: 'Row ID for update operation'
                    }
                },
                required: ['operation']
            }
        },
        {
            name: 'create_agent',
            description: 'Create a new specialized AI agent. Agents have their own system prompts and can be used in workflows.',
            status: 'active',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Name of the agent' },
                    description: { type: 'string', description: 'Short description of the agent' },
                    systemPrompt: { type: 'string', description: 'The system prompt that defines the agent\'s personality and role' },
                    icon: { type: 'string', description: 'Lucide icon name (e.g., Bot, Brain, Code, Terminal, Sparkles)' },
                    color: { type: 'string', description: 'Hex color code (e.g., #3b82f6)' },
                    enabledTools: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of tool names this agent is allowed to use'
                    }
                },
                required: ['name', 'systemPrompt']
            }
        },
        {
            name: 'create_workflow',
            description: 'Create a new automation workflow. Workflows are pipelines of steps triggered by events or schedules.',
            status: 'active',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Name of the workflow' },
                    description: { type: 'string', description: 'Description of what the workflow does' },
                    trigger: {
                        type: 'object',
                        description: 'Trigger configuration (e.g., { type: "manual" }, { type: "schedule", scheduleConfig: { frequency: "daily", time: "09:00" } })'
                    },
                    pipeline: {
                        type: 'array',
                        items: { type: 'object' },
                        description: 'Array of pipeline steps. Each step needs a type (agent_action, wait, condition, integration_action) and config.'
                    }
                },
                required: ['name', 'trigger', 'pipeline']
            }
        }
    ]

    private static normalizeTool(def: ToolDefinition): ToolDefinition {
        const status = def.status ?? 'disabled'
        const statusMessage = def.statusMessage ?? ToolService.DEFAULT_STATUS_MESSAGE[status]
        return {
            ...def,
            status,
            statusMessage
        }
    }

    private static getToolDefinition(name: string): ToolDefinition | undefined {
        return ToolService.getToolDefinitions().find(t => t.name === name)
    }

    private static getActionName(args: any): string | undefined {
        if (!args || typeof args !== 'object') return undefined
        if (typeof args.operation === 'string') return args.operation
        if (typeof args.action === 'string') return args.action
        if (typeof args.command === 'string') return args.command
        return undefined
    }

    private static buildToolNotReadyResult(name: string, status: ToolStatus, message: string): ToolResult {
        const payload = {
            error: 'TOOL_NOT_READY',
            tool: name,
            status,
            message
        } as const
        return {
            tool: name,
            result: JSON.stringify(payload, null, 2),
            isError: true,
            error: payload
        }
    }

    static getToolDefinitions(): ToolDefinition[] {
        return this.tools.map(ToolService.normalizeTool)
    }

    static getToolStatusSnapshot(): Array<Pick<ToolDefinition, 'name' | 'status' | 'statusMessage' | 'allowedActions'>> {
        return ToolService.getToolDefinitions().map(({ name, status, statusMessage, allowedActions }) => ({
            name,
            status,
            statusMessage,
            allowedActions
        }))
    }

    static async executeTool(name: string, args: any): Promise<ToolResult> {
        console.log(`Executing tool: ${name}`, args)

        // Robustness: Some models wrap arguments in an 'arg' or 'arguments' key
        let finalArgs = args
        if (args && typeof args === 'object') {
            if (args.arg) finalArgs = args.arg
            else if (args.arguments) finalArgs = args.arguments
        }

        const toolDefinition = ToolService.getToolDefinition(name)
        const toolStatus = toolDefinition?.status ?? 'disabled'
        const statusMessage = toolDefinition?.statusMessage ?? ToolService.DEFAULT_STATUS_MESSAGE[toolStatus]

        if (!toolDefinition) {
            return ToolService.buildToolNotReadyResult(name, 'disabled', 'Tool is not registered.')
        }

        if (toolStatus === 'wip' || toolStatus === 'disabled') {
            return ToolService.buildToolNotReadyResult(name, toolStatus, statusMessage)
        }

        if (toolStatus === 'limited') {
            const action = ToolService.getActionName(finalArgs)
            const allowedActions = toolDefinition.allowedActions || []
            if (!action || !allowedActions.includes(action)) {
                return ToolService.buildToolNotReadyResult(name, toolStatus, statusMessage)
            }
        }

        try {
            let result: string
            switch (name) {
                case 'web_search':
                    result = await WebSearchTool.search(finalArgs.query)
                    break
                case 'url_reader':
                    result = await URLReaderTool.read(finalArgs.url)
                    break
                case 'file_system':
                    result = await FileSystemTool.execute(finalArgs.operation, finalArgs.path, finalArgs.content)
                    break
                case 'execute_code':
                    result = await CodeExecutionTool.execute(finalArgs.language, finalArgs.code)
                    break
                case 'google_calendar':
                    result = await GoogleCalendarTool.execute(finalArgs.operation, finalArgs)
                    break
                case 'notion':
                    result = await NotionTool.execute(finalArgs.operation, finalArgs)
                    break
                case 'github':
                    result = await GitHubTool.execute(finalArgs.operation, finalArgs)
                    break
                case 'send_notification':
                    result = await NotificationTool.notify(finalArgs.title, finalArgs.body)
                    break
                case 'supabase':
                    result = await new SupabaseTool().execute(finalArgs.operation, finalArgs)
                    break
                case 'create_agent':
                    result = await CreateAgentTool.execute(finalArgs)
                    break
                case 'create_workflow':
                    result = await CreateWorkflowTool.execute(finalArgs)
                    break


                default:
                    return { tool: name, result: `Unknown tool: ${name}`, isError: true }
            }
            return { tool: name, result }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)

            ErrorLogger.log(
                `Tool execution failed: ${name}`,
                ErrorSeverity.ERROR,
                'ToolService',
                { tool: name, args },
                error
            )

            return {
                tool: name,
                result: `Error executing ${name}: ${errorMessage}`,
                isError: true
            }
        }
    }
}
