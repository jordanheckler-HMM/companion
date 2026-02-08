import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIService } from './aiService'
import { AISettings } from '../store'
import * as httpPlugin from '@tauri-apps/plugin-http'

// Mock dependencies
vi.mock('./toolService', () => ({
    ToolService: {
        executeTool: vi.fn(),
        getToolDefinitions: vi.fn().mockReturnValue([]),
        getToolStatusSnapshot: vi.fn().mockReturnValue([])
    }
}))

vi.mock('../store', () => ({
    StorageService: {
        getSettings: vi.fn(),
        saveSettings: vi.fn()
    }
}))

// Mock ModelRegistry
vi.mock('./ModelRegistry', () => ({
    ModelRegistry: {
        getInstance: vi.fn().mockReturnValue({
            getModelById: vi.fn().mockImplementation((id) => {
                if (id === 'gpt-4') {
                    return {
                        id: 'gpt-4',
                        provider: 'openai',
                        contextWindow: 128000,
                        displayName: 'GPT-4 Turbo'
                    }
                }
                return undefined
            }),
            getAllModels: vi.fn().mockReturnValue([])
        })
    }
}))

describe('AIService', () => {
    let aiService: AIService
    // Corrected AISettings matching the interface
    const mockSettings: AISettings = {
        intelligenceMode: 'cloud',
        preferredModelId: 'gpt-4',
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: 'llama2',
        providerType: 'cloud',
        cloudProvider: 'openai',
        apiKey: 'test-key', // Replaced openaiKey
        googleApiKey: '',
        cloudModel: 'gpt-4',
        systemPrompt: 'test prompt'
    } as any // Cast to allow missing optional properties like toolsEnabled

    beforeEach(() => {
        vi.clearAllMocks()
        // Reset fetch mock
        vi.mocked(httpPlugin.fetch).mockReset()
        aiService = new AIService(mockSettings)
    })

    it('should initialize with settings', () => {
        expect(aiService).toBeDefined()
    })

    it('should handle streaming response from OpenAI', async () => {
        const consoleSpy = vi.spyOn(console, 'error')

        // Mock ReadableStream with proper SSE format
        const stream = new ReadableStream({
            start(controller) {
                const chunk = { choices: [{ delta: { content: 'Hello' } }] }
                const payload = `data: ${JSON.stringify(chunk)}\n\n`
                controller.enqueue(new TextEncoder().encode(payload))
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
                controller.close()
            }
        })

        // Mock fetch for OpenAI to return the stream
        vi.mocked(httpPlugin.fetch).mockResolvedValueOnce({
            ok: true,
            body: stream as any,
            headers: new Headers()
        } as any)

        const onChunk = vi.fn()
        const history = [{ role: 'user', content: 'Hi' }]

        await aiService.streamMessage(history as any, onChunk)

        if (consoleSpy.mock.calls.length > 0) {
            console.log('Console errors during test:', consoleSpy.mock.calls)
        }

        expect(httpPlugin.fetch).toHaveBeenCalledWith(
            expect.stringContaining('api.openai.com'),
            expect.any(Object)
        )

        expect(onChunk).toHaveBeenCalled()
        expect(onChunk).toHaveBeenCalledWith('Hello')
    })

    it('should handle tool calls in response', async () => {
        const createWorkflowArgs = {
            name: 'Release "Hotfix" Workflow',
            trigger: {
                type: 'manual',
                config: { source: 'ops-console' }
            },
            pipeline: [
                {
                    type: 'agent_action',
                    config: {
                        agentId: 'agent_triage',
                        prompt: 'Analyze "P0" incidents and return JSON with keys: "service", "impact".'
                    }
                },
                {
                    type: 'integration_action',
                    config: {
                        integration: 'supabase',
                        args: {
                            operation: 'query',
                            query: 'select * from "incidents" where note = \'He said "ship it"\'',
                            params: [
                                { key: 'severity', values: ['critical', 'high'] },
                                { key: 'tags', values: ['on-call', 'postmortem "required"'] }
                            ]
                        }
                    }
                }
            ]
        }

        const supabaseArgs = {
            operation: 'query',
            query: 'select id, payload from "events" where payload->>\'source\' = \'api\'',
            filters: [
                {
                    column: 'metadata',
                    operator: 'contains',
                    value: {
                        labels: ['release', 'edge-case "quoted"'],
                        notes: 'Line 1\nLine 2 with "quotes"'
                    }
                }
            ],
            options: {
                orderBy: [{ column: 'created_at', direction: 'desc' }],
                limit: 25
            }
        }

        const createAgentArgs = {
            name: 'Ops "Incident" Agent',
            role: 'Summarize incidents and propose remediation.',
            systemPrompt: 'Use strict JSON output. Preserve escaped quotes like \\"this\\".',
            capabilities: ['analysis', 'triage'],
            tools: [
                {
                    name: 'supabase',
                    config: {
                        allowedOps: ['query', 'count_rows'],
                        defaults: {
                            schema: 'public',
                            tags: ['ops', 'incident "response"']
                        }
                    }
                }
            ]
        }

        const content = [
            `[TOOL:create_workflow]${JSON.stringify(createWorkflowArgs)}[/TOOL]`,
            `[TOOL:supabase]${JSON.stringify(supabaseArgs)}[/TOOL]`,
            `[TOOL:create_agent]${JSON.stringify(createAgentArgs)}[/TOOL]`
        ].join('\n')

        const toolCalls = (aiService as any).extractToolCalls(content)

        expect(toolCalls).toHaveLength(3)
        expect(toolCalls[0]).toEqual({ name: 'create_workflow', arguments: createWorkflowArgs })
        expect(toolCalls[1]).toEqual({ name: 'supabase', arguments: supabaseArgs })
        expect(toolCalls[2]).toEqual({ name: 'create_agent', arguments: createAgentArgs })
    })

    it('should parse Gemini native function calls with deeply nested arguments and escaped quotes', async () => {
        const parts = [
            {
                functionCall: {
                    name: 'create_workflow',
                    args: {
                        name: 'Deploy "Canary" Workflow',
                        trigger: { type: 'manual' },
                        pipeline: [
                            {
                                type: 'condition',
                                config: {
                                    rules: [
                                        { field: 'status', op: 'eq', value: 'ready' },
                                        { field: 'note', op: 'contains', value: 'contains "quoted" phrase' }
                                    ]
                                }
                            }
                        ]
                    }
                }
            },
            {
                functionCall: {
                    name: 'supabase',
                    args: {
                        operation: 'query',
                        query: 'select * from "users" where profile->>\'nickname\' = \'JH "admin"\'',
                        joins: [
                            {
                                table: 'teams',
                                on: ['users.team_id', 'teams.id']
                            }
                        ]
                    }
                }
            },
            {
                functionCall: {
                    name: 'create_agent',
                    args: {
                        name: 'Reviewer',
                        systemPrompt: 'Reject responses that omit escaped chars like \\\\".',
                        onboarding: {
                            checklist: ['Read docs', 'Run "smoke" checks'],
                            metadata: { owner: 'platform' }
                        }
                    }
                }
            }
        ]

        const toolCalls = (aiService as any).extractGeminiToolCalls(parts)

        expect(toolCalls).toHaveLength(3)
        expect(toolCalls[0].name).toBe('create_workflow')
        expect(toolCalls[0].arguments.pipeline[0].config.rules[1].value).toBe('contains "quoted" phrase')
        expect(toolCalls[1].name).toBe('supabase')
        expect(toolCalls[1].arguments.query).toContain('"users"')
        expect(toolCalls[2].name).toBe('create_agent')
        expect(toolCalls[2].arguments.systemPrompt).toContain('escaped chars')
    })

    it('should handle errors gracefully', async () => {
        vi.mocked(httpPlugin.fetch).mockRejectedValueOnce(new Error('Network error'))

        const onChunk = vi.fn()
        const history = [{ role: 'user', content: 'Hi' }]

        try {
            await aiService.streamMessage(history as any, onChunk)
        } catch (error) {
            expect(error).toBeDefined()
        }
    })
})
