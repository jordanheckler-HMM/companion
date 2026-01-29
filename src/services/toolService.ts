import { URLReaderTool } from './tools/urlReaderTool'
import { WebSearchTool } from './tools/webSearchTool'
import { FileSystemTool } from './tools/fileSystemTool'
import { CodeExecutionTool } from './tools/codeExecutionTool'
import { GoogleCalendarTool } from './tools/googleCalendarTool'
import { NotionTool } from './tools/notionTool'
import { GitHubTool } from './tools/githubTool'

export interface ToolDefinition {
    name: string
    description: string
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
}

export class ToolService {
    private static tools: ToolDefinition[] = [
        {
            name: 'web_search',
            description: 'Search the web using DuckDuckGo to get real-time information.',
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
            description: 'Execute Python or JavaScript code locally.',
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
            parameters: {
                type: 'object',
                properties: {
                    operation: {
                        type: 'string',
                        description: 'The operation to perform',
                        enum: ['list', 'create', 'search']
                    },
                    count: {
                        type: 'number',
                        description: 'Number of events to return (for list operation). Default is 10.'
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
            parameters: {
                type: 'object',
                properties: {
                    operation: {
                        type: 'string',
                        description: 'The operation to perform',
                        enum: ['repos', 'issues', 'prs', 'create_issue', 'get_file']
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
        }
    ]

    static getToolDefinitions(): ToolDefinition[] {
        return this.tools
    }

    static async executeTool(name: string, args: any): Promise<ToolResult> {
        console.log(`Executing tool: ${name}`, args)

        // Robustness: Some models wrap arguments in an 'arg' or 'arguments' key
        let finalArgs = args
        if (args && typeof args === 'object') {
            if (args.arg) finalArgs = args.arg
            else if (args.arguments) finalArgs = args.arguments
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
                default:
                    return { tool: name, result: `Unknown tool: ${name}`, isError: true }
            }
            return { tool: name, result }
        } catch (error) {
            return {
                tool: name,
                result: error instanceof Error ? error.message : String(error),
                isError: true
            }
        }
    }
}
