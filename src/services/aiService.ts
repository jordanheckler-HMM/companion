import { AISettings } from '../store'
import { ToolService, ToolDefinition } from './toolService'
import { ModelRegistry, ModelDefinition } from './ModelRegistry'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { ErrorLogger, ErrorSeverity } from '../utils/errorLogger'

// Note: Use native `fetch` for Ollama (localhost) requests due to Tauri HTTP plugin issues with loopback

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system'
    content: string
    images?: string[]
}

export interface ChatResponse {
    message: string
    error?: string
    toolCalls?: { name: string; arguments: any }[]
}

interface StreamProviderResult {
    toolCalls?: { name: string; arguments: any }[]
}

/**
 * AI Service to handle communication with both local (Ollama) and cloud AI providers
 */
export class AIService {
    private settings: AISettings

    private static EDITOR_INSTRUCTIONS = `**Editor Capability:**
When appropriate, you can suggest the user open the editor to collaboratively work on documents, code, or long-form content. The user can also manually open the editor using the edit button.

To automatically activate the editor with content you've written, use this special syntax at the end of your message:

[EDITOR:START]
<content to edit>
[EDITOR:END]

The editor will open with this content pre-loaded. The user can then edit, save, or upload the result as an attachment.

**Suggest using the editor when:**
- Writing code snippets longer than 20 lines
- Creating configuration files or structured documents
- Drafting long documents, articles, or documentation
- Making detailed edits to existing content
- Working on multi-line JSON, YAML, or similar formats`;

    constructor(settings: AISettings) {
        this.settings = settings
    }

    /**
     * Update AI settings
     */
    updateSettings(settings: AISettings) {
        this.settings = settings
    }

    /**
     * Send a chat message to the configured AI provider, handling tool calls if necessary
     */
    async sendMessage(messages: ChatMessage[], explicitModelId?: string): Promise<ChatResponse> {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 min for multi-tool tasks

        try {
            const registry = ModelRegistry.getInstance()
            const modelId = explicitModelId || this.settings.preferredModelId || 'gpt-3.5-turbo'
            const model = registry.getModelById(modelId)

            if (!model) {
                const error = `Model ${modelId} not found in registry.`
                ErrorLogger.log(error, ErrorSeverity.ERROR, 'AIService', { modelId })
                return { message: '', error }
            }

            // Inject tool definitions and temporal context into system prompt
            const useNativeToolCalling = this.shouldUseNativeToolCalling(model)
            const toolSystemMsg = this.getToolSystemPrompt(useNativeToolCalling)
            const temporalContext = this.getTemporalContext()
            const injectedContext = [
                temporalContext,
                toolSystemMsg,
                AIService.EDITOR_INSTRUCTIONS
            ].filter(Boolean).join('\n\n')
            const currentMessages = [...messages]

            // Find system message or add one
            const systemMsgIndex = currentMessages.findIndex(m => m.role === 'system')
            if (systemMsgIndex !== -1) {
                currentMessages[systemMsgIndex].content += "\n\n" + injectedContext
            } else {
                currentMessages.unshift({ role: 'system', content: injectedContext })
            }

            let maxIterations = 5 // Prevent infinite loops

            while (maxIterations > 0) {
                let response: ChatResponse
                try {
                    response = await this.retryOperation(async () => {
                        if (model.provider === 'ollama') {
                            return await this.sendToOllama(currentMessages, model)
                        } else {
                            return await this.sendToCloudProvider(currentMessages, model)
                        }
                    }, `SendMessage (${model.provider})`)
                } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : 'Unknown error during request'
                    ErrorLogger.log(`Failed to send message: ${errorMsg}`, ErrorSeverity.ERROR, 'AIService', { modelId: model.id }, err)
                    return { message: '', error: errorMsg }
                }

                if (response.error) return response

                // Check for tool calls in the response
                const toolCalls =
                    response.toolCalls && response.toolCalls.length > 0
                        ? response.toolCalls
                        : this.extractToolCalls(response.message)
                if (toolCalls.length === 0) {
                    return response
                }

                // Execute tools
                if (response.message.trim()) {
                    currentMessages.push({ role: 'assistant', content: response.message })
                }

                for (const toolCall of toolCalls) {
                    const result = await ToolService.executeTool(toolCall.name, toolCall.arguments)

                    // Format tool result as a message
                    // Use 'user' role with a clear prefix for Anthropic compatibility
                    // (Anthropic handles system messages differently than OpenAI)
                    const toolResultContent = `[Tool Result - ${result.tool}]:\n${result.result}`

                    if (this.settings.cloudProvider === 'anthropic' && this.settings.intelligenceMode === 'cloud') {
                        // Anthropic: use user role with structured prefix
                        currentMessages.push({
                            role: 'user',
                            content: toolResultContent
                        })
                    } else {
                        // OpenAI/Ollama: system role works well
                        currentMessages.push({
                            role: 'system',
                            content: toolResultContent
                        })
                    }
                }

                maxIterations--
            }

            return { message: '', error: 'Exceeded maximum tool call iterations' }
        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                return { message: '', error: 'Request timed out' }
            }
            return {
                message: '',
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            }
        } finally {
            clearTimeout(timeoutId)
        }
    }

    /**
     * Retry an operation with exponential backoff
     */
    private async retryOperation<T>(
        operation: () => Promise<T>,
        context: string,
        maxRetries: number = 2
    ): Promise<T> {
        let lastError: any = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error: any) {
                lastError = error;
                const isRetryable = this.isRetryableError(error);

                if (!isRetryable || attempt === maxRetries) {
                    throw error;
                }

                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`[AIService] ${context} failed. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    }

    private isRetryableError(error: any): boolean {
        const msg = (error.message || '').toLowerCase();
        // 429: Too Many Requests, 5xx: Server Errors, specific generic network errors
        return msg.includes('429') ||
            msg.includes('500') ||
            msg.includes('502') ||
            msg.includes('503') ||
            msg.includes('network error') ||
            msg.includes('failed to fetch') ||
            msg.includes('connection refused');
    }

    /**
     * Attempt to repair common JSON formatting issues from AI output
     */
    private repairJSON(jsonString: string): string {
        let repaired = jsonString.trim()

        // Remove trailing commas before } or ]
        repaired = repaired.replace(/,\s*([}\]])/g, '$1')

        // Try to fix unquoted keys (simple cases)
        repaired = repaired.replace(/(\{|,)\s*(\w+)\s*:/g, '$1"$2":')

        // Fix single quotes to double quotes
        repaired = repaired.replace(/'/g, '"')

        return repaired
    }

    /**
     * Helper to parse base64 image data
     */
    private parseImage(dataUrl: string): { mimeType: string; data: string } {
        if (dataUrl.startsWith('data:')) {
            const commaIndex = dataUrl.indexOf(',')
            if (commaIndex !== -1) {
                const header = dataUrl.substring(0, commaIndex)
                const data = dataUrl.substring(commaIndex + 1)
                const mimeMatch = header.match(/^data:(.+);base64$/)
                const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
                return { mimeType, data }
            }
        }
        // If no header or invalid format, assume it's raw base64 or treat input as is
        return { mimeType: 'image/jpeg', data: dataUrl }
    }

    private shouldUseNativeToolCalling(model: ModelDefinition): boolean {
        return model.provider === 'openai' || model.provider === 'anthropic' || model.provider === 'google'
    }

    private extractNativeToolCalls(toolCalls: any[]): { name: string; arguments: any }[] {
        const parsedCalls: { name: string; arguments: any }[] = []
        const parseErrors: string[] = []

        for (const call of toolCalls || []) {
            const name = call?.function?.name || call?.name
            if (typeof name !== 'string' || !name.trim()) {
                parseErrors.push('Tool call missing function name')
                continue
            }

            const rawArgs = call?.function?.arguments ?? call?.arguments ?? call?.input ?? {}
            let args: any = {}

            if (rawArgs && typeof rawArgs === 'object') {
                args = rawArgs
            } else if (typeof rawArgs === 'string') {
                const trimmed = rawArgs.trim()
                if (!trimmed) {
                    args = {}
                } else {
                    try {
                        args = JSON.parse(trimmed)
                    } catch (_e) {
                        try {
                            args = JSON.parse(this.repairJSON(trimmed))
                        } catch (_e2) {
                            parseErrors.push(`Tool "${name}": invalid JSON arguments`)
                            continue
                        }
                    }
                }
            } else if (rawArgs == null) {
                args = {}
            } else {
                parseErrors.push(`Tool "${name}": unsupported arguments payload`)
                continue
            }

            parsedCalls.push({ name, arguments: args })
        }

        if (parseErrors.length > 0) {
            ErrorLogger.log(
                `Failed to parse ${parseErrors.length} native tool call(s)`,
                ErrorSeverity.WARNING,
                'AIService.extractNativeToolCalls',
                { errors: parseErrors }
            )
        }

        return parsedCalls
    }

    private extractGeminiToolCalls(parts: any[]): { name: string; arguments: any }[] {
        if (!Array.isArray(parts) || parts.length === 0) return []

        const rawCalls = parts
            .map((part: any) => part?.functionCall || part?.function_call)
            .filter((fn: any) => fn && typeof fn === 'object')
            .map((fn: any) => ({
                name: fn.name,
                arguments: fn.args ?? fn.arguments ?? fn.parameters ?? {}
            }))

        return this.extractNativeToolCalls(rawCalls)
    }

    /**
     * Extract tool calls from AI response. 
     * Supports multiple patterns for robustness:
     * 1. Standard: [TOOL:name]{"arg": "val"}[/TOOL]
     * 2. Whitespace tolerant: [ TOOL : name ] {...} [ / TOOL ]
     * 3. Markdown code blocks: ```tool:name {...} ```
     * 4. XML-style: <tool name="name">...</tool>
     */
    private extractToolCalls(content: string): { name: string, arguments: any }[] {
        const tools: { name: string, arguments: any }[] = []
        const parseErrors: string[] = []

        // Pattern 1: Standard format with whitespace tolerance
        // Allows: [TOOL:name], [ TOOL:name ], [TOOL: name], etc.
        const toolRegex = /\[\s*TOOL\s*:\s*(\w+)\s*\]\s*([\s\S]*?)\s*\[\s*\/\s*TOOL\s*\]/gi
        let match

        while ((match = toolRegex.exec(content)) !== null) {
            const name = match[1]
            const rawArgs = match[2].trim()

            try {
                const args = JSON.parse(rawArgs)
                tools.push({ name, arguments: args })
            } catch (e) {
                // Try to repair JSON
                try {
                    const repairedArgs = this.repairJSON(rawArgs)
                    const args = JSON.parse(repairedArgs)
                    tools.push({ name, arguments: args })
                    console.warn(`[AIService] Repaired malformed JSON for tool ${name}`)
                } catch (e2) {
                    parseErrors.push(`Tool "${name}": ${rawArgs.substring(0, 100)}...`)
                }
            }
        }

        // Pattern 2: Markdown code block format (fallback)
        // Matches: ```tool:name {...} ``` or ```json tool:name {...} ```
        if (tools.length === 0) {
            const codeBlockRegex = /```(?:json\s+)?tool[:\s]+(\w+)\s*([\s\S]*?)```/gi
            while ((match = codeBlockRegex.exec(content)) !== null) {
                const name = match[1]
                const rawArgs = match[2].trim()

                try {
                    const args = JSON.parse(rawArgs)
                    tools.push({ name, arguments: args })
                } catch (e) {
                    try {
                        const args = JSON.parse(this.repairJSON(rawArgs))
                        tools.push({ name, arguments: args })
                    } catch (e2) {
                        parseErrors.push(`CodeBlock tool "${name}": parse failed`)
                    }
                }
            }
        }

        // Pattern 3: XML-style format (fallback)
        // Matches: <tool name="toolname">{"args": "val"}</tool>
        if (tools.length === 0) {
            const xmlRegex = /<tool\s+name\s*=\s*["'](\w+)["']\s*>([\s\S]*?)<\/tool>/gi
            while ((match = xmlRegex.exec(content)) !== null) {
                const name = match[1]
                const rawArgs = match[2].trim()

                try {
                    const args = JSON.parse(rawArgs)
                    tools.push({ name, arguments: args })
                } catch (e) {
                    try {
                        const args = JSON.parse(this.repairJSON(rawArgs))
                        tools.push({ name, arguments: args })
                    } catch (e2) {
                        parseErrors.push(`XML tool "${name}": parse failed`)
                    }
                }
            }
        }

        // Log any parse errors for debugging
        if (parseErrors.length > 0) {
            console.error('[AIService] Tool parsing errors:', parseErrors)
            ErrorLogger.log(
                `Failed to parse ${parseErrors.length} tool call(s)`,
                ErrorSeverity.WARNING,
                'AIService.extractToolCalls',
                { errors: parseErrors }
            )
        }

        return tools
    }

    /**
     * Test connection to the configured AI provider
     */
    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            const modelId = this.settings.preferredModelId || 'gpt-3.5-turbo'
            const model = ModelRegistry.getInstance().getModelById(modelId)

            if (model?.provider === 'ollama') {
                return await this.testOllamaConnection()
            } else if (model?.provider === 'google') {
                return await this.testGoogleConnection()
            } else {
                return await this.testCloudConnection()
            }
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Connection test failed',
            }
        }
    }

    /**
     * Send message to Ollama
     */
    /**
     * Convert internal ToolDefinitions to OpenAI-compatible Tool objects
     */
    private getEnabledTools(): ToolDefinition[] {
        const allTools = ToolService.getToolDefinitions()
        const toolSettings = this.settings.toolsEnabled || {
            web_search: true,
            url_reader: true,
            file_system: true,
            execute_code: true,
            google_calendar: true,
            notion: true,
            github: true,
        }

        return allTools.filter(t => {
            const setting = toolSettings[t.name as keyof typeof toolSettings]
            const statusAllowed = t.status === 'active' || t.status === 'limited'
            return setting !== false && statusAllowed
        })
    }

    private getOpenAITools(): any[] {
        const enabledTools = this.getEnabledTools()

        if (enabledTools.length === 0) return []

        return enabledTools.map(t => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters
            }
        }))
    }

    /**
     * Send message to OpenAI with native tool calling
     */
    private async sendToOpenAI(messages: ChatMessage[], model: ModelDefinition): Promise<ChatResponse> {
        const tools = this.getOpenAITools()

        const body: any = {
            model: model.id,
            messages: messages.map(m => {
                if (m.images && m.images.length > 0) {
                    return {
                        role: m.role,
                        content: [
                            { type: 'text', text: m.content },
                            ...m.images.map(img => ({
                                type: 'image_url',
                                image_url: { url: img } // OpenAI expects full data URL
                            }))
                        ]
                    }
                }
                return { role: m.role, content: m.content }
            }),
        }

        if (tools.length > 0) {
            body.tools = tools
            body.tool_choice = 'auto'
        }

        const response = await tauriFetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getApiKey('openai')}`,
            },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const status = response.status
            let reason = `Status ${status}`

            if (status === 401) reason = 'Invalid API Key'
            else if (status === 429) reason = 'Rate Limit Exceeded'
            else if (status === 500) reason = 'OpenAI Server Error'
            else if (status === 503) reason = 'OpenAI Service Unavailable'

            const detailedMsg = errorData.error?.message || response.statusText
            throw new Error(`OpenAI Error (${reason}): ${detailedMsg}`)
        }

        const data = await response.json()
        const message = data.choices?.[0]?.message

        if (message.tool_calls) {
            return {
                message: message.content || '',
                toolCalls: this.extractNativeToolCalls(message.tool_calls)
            }
        }

        return {
            message: message.content || '',
        }
    }

    /**
     * Send message to Ollama with optional native tool calling (if model supports it)
     */
    private async sendToOllama(messages: ChatMessage[], model: ModelDefinition): Promise<ChatResponse> {
        const tools = this.getOpenAITools()

        const body: any = {
            model: model.id,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content,
                images: m.images ? m.images.map(img => this.parseImage(img).data) : undefined
            })),
            stream: false,
        }

        // Only attach tools if using a model known to support them, or strictly generic.
        // For now, let's try attaching them. Ollama ignores them if unsupported by the model template usually, 
        // OR it might error. Safe bet is to depend on the user's config? 
        // For this implementation, we will pass them.
        if (tools.length > 0) {
            body.tools = tools
        }

        const response = await fetch(`${this.settings.ollamaUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            let reason = `Status ${response.status}`
            if (response.status === 404) reason = 'Model not found (check if pulled)'

            throw new Error(`Ollama API error (${reason}): ${response.statusText}`)
        }

        const data = await response.json()
        const message = data.message

        if (message.tool_calls) {
            return {
                message: message.content || '',
                toolCalls: this.extractNativeToolCalls(message.tool_calls)
            }
        }

        return {
            message: message.content || '',
        }
    }

    /**
     * Send message to Anthropic
     */
    private getApiKey(provider: 'openai' | 'anthropic' | 'google'): string | undefined {
        if (provider === 'google') return this.settings.googleApiKey || this.settings.apiKey
        if (provider === 'anthropic') return this.settings.anthropicApiKey || this.settings.apiKey
        if (provider === 'openai') return this.settings.openaiApiKey || this.settings.apiKey
        return this.settings.apiKey
    }

    private getAnthropicTools(): any[] {
        return this.getEnabledTools()
            .map(t => ({
                name: t.name,
                description: t.description,
                input_schema: t.parameters
            }))
    }

    private convertJsonSchemaToGoogleSchema(schema: any): any {
        const typeMap: Record<string, string> = {
            object: 'OBJECT',
            string: 'STRING',
            number: 'NUMBER',
            integer: 'INTEGER',
            boolean: 'BOOLEAN',
            array: 'ARRAY',
        }

        if (!schema || typeof schema !== 'object') {
            return { type: 'OBJECT', properties: {} }
        }

        const rawType = typeof schema.type === 'string' ? schema.type.toLowerCase() : 'object'
        const convertedType = typeMap[rawType] || 'STRING'
        const converted: any = { type: convertedType }

        if (typeof schema.description === 'string') {
            converted.description = schema.description
        }

        if (Array.isArray(schema.enum) && schema.enum.length > 0) {
            converted.enum = schema.enum.filter((value: unknown) =>
                ['string', 'number', 'boolean'].includes(typeof value)
            )
        }

        if (convertedType === 'OBJECT') {
            const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {}
            converted.properties = Object.fromEntries(
                Object.entries(properties).map(([key, value]) => [key, this.convertJsonSchemaToGoogleSchema(value)])
            )
            if (Array.isArray(schema.required) && schema.required.length > 0) {
                converted.required = schema.required.filter((key: unknown) => typeof key === 'string')
            }
        } else if (convertedType === 'ARRAY') {
            converted.items = this.convertJsonSchemaToGoogleSchema(schema.items)
        }

        return converted
    }

    private getGoogleTools(): any[] {
        const enabledTools = this.getEnabledTools()
        if (enabledTools.length === 0) return []

        return [
            {
                function_declarations: enabledTools.map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                    parameters: this.convertJsonSchemaToGoogleSchema(tool.parameters)
                }))
            }
        ]
    }

    /**
     * Send message to Anthropic
     */
    private async sendToAnthropic(messages: ChatMessage[], model: ModelDefinition): Promise<ChatResponse> {
        // Convert messages format for Anthropic
        const systemMessage = messages.find((m) => m.role === 'system')
        const conversationMessages = messages.filter((m) => m.role !== 'system')

        const response = await tauriFetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.getApiKey('anthropic') || '',
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: model.id,
                max_tokens: 4096,
                system: systemMessage?.content,
                messages: conversationMessages.map(m => {
                    if (m.images && m.images.length > 0) {
                        return {
                            role: m.role,
                            content: [
                                { type: 'text', text: m.content },
                                ...m.images.map(img => {
                                    const { mimeType, data } = this.parseImage(img)
                                    return {
                                        type: 'image',
                                        source: {
                                            type: 'base64',
                                            media_type: mimeType,
                                            data: data
                                        }
                                    }
                                })
                            ]
                        }
                    }
                    return { role: m.role, content: m.content }
                }),
                tools: this.getAnthropicTools(),
            }),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const status = response.status
            let reason = `Status ${status}`
            if (status === 401) reason = 'Invalid API Key'
            else if (status === 429) reason = 'Rate Limit Exceeded'
            else if (status === 529) reason = 'Overloaded'

            const detailedMsg = errorData.error?.message || response.statusText
            throw new Error(`Anthropic Error (${reason}): ${detailedMsg}`)
        }

        const data = await response.json()

        const contentBlocks = Array.isArray(data.content) ? data.content : []
        const toolCalls = this.extractNativeToolCalls(
            contentBlocks
                .filter((c: any) => c.type === 'tool_use')
                .map((c: any) => ({
                    name: c.name,
                    input: c.input
                }))
        )
        const textContent = contentBlocks
            .filter((c: any) => c.type === 'text' && typeof c.text === 'string')
            .map((c: any) => c.text)
            .join('\n')

        return {
            message: textContent || '',
            ...(toolCalls.length > 0 ? { toolCalls } : {})
        }
    }

    /**
     * Send message to cloud provider (OpenAI or Anthropic)
     */
    private async sendToCloudProvider(messages: ChatMessage[], model: ModelDefinition): Promise<ChatResponse> {
        if (model.provider === 'openai') {
            return await this.sendToOpenAI(messages, model)
        } else if (model.provider === 'google') {
            return await this.sendToGoogle(messages, model)
        } else {
            return await this.sendToAnthropic(messages, model)
        }
    }

    private getToolSystemPrompt(useNativeToolCalling: boolean = false): string {
        // Note: We always include tool instructions so the AI knows about available integrations
        // Native function/tool calling is preferred when available.

        const allTools = ToolService.getToolDefinitions()
        const toolSettings = this.settings.toolsEnabled || {
            web_search: true,
            url_reader: true,
            file_system: true,
            execute_code: true,
            google_calendar: true,
            notion: true,
            github: true,
        }
        const enabledTools = allTools.filter(t => {
            const setting = toolSettings[t.name as keyof typeof toolSettings]
            const statusAllowed = t.status === 'active' || t.status === 'limited'
            return setting !== false && statusAllowed // Default to true if undefined
        })

        const toolStatusSnapshot = ToolService.getToolStatusSnapshot()
        const toolStatusJson = JSON.stringify({ tools: toolStatusSnapshot }, null, 2)
        const toolStatusSection = `
## TOOL_STATUS (machine-readable JSON):
\`\`\`json
${toolStatusJson}
\`\`\`
`

        if (enabledTools.length === 0) {
            return `
${toolStatusSection}
`
        }

        const toolList = enabledTools.map(t =>
            `- ${t.name}: ${t.description}`
        ).join('\n')

        // Build list of connected integrations
        const connectedIntegrations: string[] = []
        if (this.settings.notionApiKey) connectedIntegrations.push('Notion (can search/read/create pages)')
        if (this.settings.githubApiKey) connectedIntegrations.push('GitHub (can access repos, issues, pull requests)')
        if (this.settings.googleApiKey) connectedIntegrations.push('Google Calendar (can list/create/search events)')

        const connectedSection = connectedIntegrations.length > 0
            ? `\n## CONNECTED INTEGRATIONS (Ready to use - keys are configured):\n${connectedIntegrations.map(i => `✅ ${i}`).join('\n')}\n`
            : ''

        if (useNativeToolCalling) {
            return `
YOU ARE A TOOL-USING ASSISTANT. When you need external information, call a tool using the model/provider's native tool-calling interface.
${toolStatusSection}
${connectedSection}
## AVAILABLE TOOLS:
${toolList}

## RULES:
- Use native tool/function calls only. Do not emit [TOOL:...] tags or XML wrappers.
- Do NOT ask for usernames, API keys, or clarification when a tool can provide the data.
- GitHub "repos" operation returns the authenticated user's repos by default.
- After receiving tool results, provide your answer based on that data.
`
        }

        return `
YOU ARE A TOOL-USING ASSISTANT. When you need external information, you MUST output a tool call.
${toolStatusSection}
${connectedSection}
## HOW TO CALL A TOOL:
Output this exact format (the system will execute it and return results):
[TOOL:tool_name]{"param": "value"}[/TOOL]

## AVAILABLE TOOLS:
${toolList}

## EXAMPLES:

User: "What's my most recent GitHub repo?"
You output: [TOOL:github]{"operation": "repos"}[/TOOL]

User: "What's on my calendar today?"
You output: [TOOL:google_calendar]{"operation": "list"}[/TOOL]

User: "Search my Notion for project plans"
You output: [TOOL:notion]{"operation": "search", "query": "project plans"}[/TOOL]

User: "What's the weather in Tokyo?"
You output: [TOOL:web_search]{"query": "weather in Tokyo"}[/TOOL]

## RULES:
- Do NOT ask for usernames, API keys, or clarification. Just call the tool.
- GitHub "repos" operation returns the authenticated user's repos by default.
- Output the tool call IMMEDIATELY when you need data. Do not say "I will fetch" or "Let me check".
- After receiving tool results, provide your answer based on that data.
`
    }

    /**
     * Generate temporal context with current date/time in user's timezone
     */
    private getTemporalContext(): string {
        const now = new Date()
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        }
        const formattedDate = now.toLocaleString(undefined, options)
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

        return `Current date and time: ${formattedDate} (Timezone: ${timezone})`
    }

    /**
     * Send a streaming chat message to the configured AI provider
     */
    async streamMessage(
        messages: ChatMessage[],
        onChunk: (chunk: string) => void,
        explicitModelId?: string,
        signal?: AbortSignal
    ): Promise<void> {
        const registry = ModelRegistry.getInstance()
        const modelId = explicitModelId || this.settings.preferredModelId || 'gpt-3.5-turbo'
        const model = registry.getModelById(modelId)

        if (!model) {
            onChunk(`Error: Model ${modelId} not found in registry.`)
            return
        }

        // Inject tool definitions and temporal context into system prompt
        try {
            const useNativeToolCalling = this.shouldUseNativeToolCalling(model)
            const toolSystemMsg = this.getToolSystemPrompt(useNativeToolCalling)
            const temporalContext = this.getTemporalContext()
            const injectedContext = [
                temporalContext,
                toolSystemMsg,
                AIService.EDITOR_INSTRUCTIONS
            ].filter(Boolean).join('\n\n')
            const currentMessages = [...messages]

            // Find system message or add one
            const systemMsgIndex = currentMessages.findIndex(m => m.role === 'system')
            if (systemMsgIndex !== -1) {
                currentMessages[systemMsgIndex].content += "\n\n" + injectedContext
            } else {
                currentMessages.unshift({ role: 'system', content: injectedContext })
            }

            const maxIterations = 3 // Reduced from 5
            let iterationCount = 0

            while (iterationCount < maxIterations) {
                let fullResponse = ''
                let streamResult: StreamProviderResult = {}
                const streamChunk = (chunk: string) => {
                    fullResponse += chunk
                    onChunk(chunk)
                }

                if (model.provider === 'ollama') {
                    streamResult = await this.retryOperation(
                        () => this.streamFromOllama(currentMessages, model, streamChunk, signal),
                        'StreamOllama'
                    )
                } else if (model.provider === 'openai') {
                    streamResult = await this.retryOperation(
                        () => this.streamFromOpenAI(currentMessages, model, streamChunk),
                        'StreamOpenAI'
                    )
                } else if (model.provider === 'google') {
                    // Added retry support for Google streaming
                    streamResult = await this.retryOperation(
                        () => this.streamFromGoogle(currentMessages, model, streamChunk),
                        'StreamGoogle'
                    )
                } else {
                    streamResult = await this.retryOperation(
                        () => this.streamFromAnthropic(currentMessages, model, streamChunk),
                        'StreamAnthropic'
                    )
                }

                const toolCalls =
                    streamResult.toolCalls && streamResult.toolCalls.length > 0
                        ? streamResult.toolCalls
                        : this.extractToolCalls(fullResponse)

                // Exit loop if no tool calls found - this is the normal case
                if (toolCalls.length === 0) {
                    break
                }

                // Only continue looping if we actually executed tools
                if (fullResponse.trim()) {
                    currentMessages.push({ role: 'assistant', content: fullResponse })
                }

                let toolsExecuted = 0
                for (const toolCall of toolCalls) {
                    onChunk(`\n\n*[Executing ${toolCall.name}...]*\n`)

                    const result = await ToolService.executeTool(toolCall.name, toolCall.arguments)
                    toolsExecuted++

                    currentMessages.push({
                        role: 'system',
                        content: `Tool Result [${result.tool}]: ${result.result}`
                    })

                    onChunk(`\n*[${toolCall.name} completed]*\n\n`)
                }

                // If no tools were successfully executed, break to prevent infinite loops
                if (toolsExecuted === 0) {
                    break
                }

                iterationCount++
            }
        } catch (error) {
            ErrorLogger.log(
                `Stream processing error: ${error instanceof Error ? error.message : String(error)}`,
                ErrorSeverity.ERROR,
                'AIService',
                { modelId: model.id },
                error
            )
            throw error
        }
    }

    /**
     * Get available models from the provider, optionally filtered by type
     */
    async getModels(type?: 'local' | 'cloud'): Promise<string[]> {
        console.log('[AIService] getModels called with type:', type)
        const registry = ModelRegistry.getInstance()
        await registry.syncOllamaModels(this.settings.ollamaUrl)

        let models = registry.getAllModels()
        console.log('[AIService] All models from registry:', models.length)

        if (type) {
            models = models.filter(m => m.type === type)
            console.log('[AIService] Filtered models for type', type, ':', models.length)
        }

        return models.map(m => m.id)
    }

    private async resizeImage(base64Data: string, mimeType: string, signal?: AbortSignal): Promise<string> {
        return new Promise((resolve) => {
            if (signal?.aborted) return resolve(base64Data)

            const img = new Image()

            const onAbort = () => {
                img.src = '' // Cancel load
                resolve(base64Data)
            }
            signal?.addEventListener('abort', onAbort)

            img.onload = () => {
                signal?.removeEventListener('abort', onAbort)
                // Aggressively limit size to prevent VRAM OOM on local models
                const MAX_DIM = 640
                let width = img.width
                let height = img.height

                console.log(`[AIService] Resizing image: ${width}x${height} -> max ${MAX_DIM}`)

                if (width > height) {
                    if (width > MAX_DIM) {
                        height *= MAX_DIM / width
                        width = MAX_DIM
                    }
                } else {
                    if (height > MAX_DIM) {
                        width *= MAX_DIM / height
                        height = MAX_DIM
                    }
                }

                const canvas = document.createElement('canvas')
                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                if (!ctx) {
                    // Fallback to original if canvas fails (though this carries risk of 500 if format is bad)
                    resolve(base64Data)
                    return
                }

                // Fill white background to handle transparency (PNG -> JPEG conversion turns transparent to black otherwise)
                ctx.fillStyle = '#FFFFFF'
                ctx.fillRect(0, 0, width, height)

                // Draw image
                ctx.drawImage(img, 0, 0, width, height)

                // Force JPEG output for compatibility with local vision models (removes Alpha, ensures common format)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
                const parts = dataUrl.split(',')
                resolve(parts[1])
            }
            img.onerror = () => {
                console.warn('[AIService] Failed to load image for resizing')
                // Do NOT send original if it failed to load, it's likely corrupt or unsupported
                resolve('')
            }
            img.src = `data:${mimeType};base64,${base64Data}`
        })
    }

    /**
     * Stream from Ollama
     */
    private async streamFromOllama(
        messages: ChatMessage[],
        model: ModelDefinition,
        onChunk: (chunk: string) => void,
        signal?: AbortSignal
    ): Promise<StreamProviderResult> {
        // Pre-process messages to handle resizing and local model constraints
        // Filter out system messages for vision models FIRST
        const filteredMessages = messages.filter(m => !(model.capabilities.vision && m.role === 'system'))

        const processedMessages = await Promise.all(filteredMessages.map(async (m, index) => {
            if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

            const isLast = index === filteredMessages.length - 1
            let images: string[] | undefined

            if (isLast && m.images && m.images.length > 0) {
                // Most local models only support 1 image, and perform better if resized
                // Force JPEG for better compression and compatibility
                const { mimeType, data } = this.parseImage(m.images[0])
                const resizedData = await this.resizeImage(data, mimeType, signal)
                images = [resizedData]
            }

            return {
                role: m.role,
                content: m.content,
                images
            }
        }))

        // Add a safety timeout for the INITIAL connection
        const controller = new AbortController()

        // Link external signal to this controller
        if (signal) {
            if (signal.aborted) {
                controller.abort()
            } else {
                signal.addEventListener('abort', () => controller.abort())
            }
        }

        // Increase timeout to 180s (3 mins) for slow local vision processing
        const timeoutId = setTimeout(() => controller.abort(), 180000)

        try {
            const response = await fetch(`${this.settings.ollamaUrl}/api/chat`, {
                method: 'POST',
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model.id,
                    messages: processedMessages,
                    stream: true,
                }),
            })

            clearTimeout(timeoutId)

            if (!response.ok) throw new Error(`Ollama stream error: ${response.status} ${response.statusText}`)
            if (!response.body) throw new Error('No response body')

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                if (signal?.aborted) {
                    await reader.cancel()
                    break
                }
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')

                // Keep the last partial line in the buffer
                buffer = lines.pop() || ''

                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed) continue
                    try {
                        const data = JSON.parse(line)
                        // Regular content
                        if (data.message?.content) {
                            onChunk(data.message.content)
                        }
                        // Some versions of Ollama or specific models might use reasoning_content
                        if (data.message?.reasoning_content) {
                            onChunk(`<think>${data.message.reasoning_content}</think>`)
                        }
                    } catch (e) {
                        console.error('Error parsing Ollama stream chunk:', e)
                    }
                }
            }
            return {}
        } finally {
            clearTimeout(timeoutId)
        }
    }

    /**
     * Stream from OpenAI
     */
    private async streamFromOpenAI(
        messages: ChatMessage[],
        model: ModelDefinition,
        onChunk: (chunk: string) => void
    ): Promise<StreamProviderResult> {
        const apiKey = this.getApiKey('openai')
        if (!apiKey) throw new Error('Missing OpenAI API Key. Please add it in Settings.')
        const tools = this.getOpenAITools()

        // Transform messages for OpenAI Vision
        const formattedMessages = messages.map(m => {
            if (m.images && m.images.length > 0) {
                return {
                    role: m.role,
                    content: [
                        { type: 'text', text: m.content },
                        ...m.images.map(img => {
                            // Ensure data URL format for OpenAI
                            const { mimeType, data } = this.parseImage(img)
                            return {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mimeType};base64,${data}`
                                }
                            }
                        })
                    ]
                }
            }
            return { role: m.role, content: m.content }
        })

        const body: any = {
            model: model.id,
            messages: formattedMessages,
            stream: true,
        }
        if (tools.length > 0) {
            body.tools = tools
            body.tool_choice = 'auto'
        }

        const response = await tauriFetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            if (response.status === 401) throw new Error('OpenAI Authorization Failed. Please check your API Key in Settings.')
            if (response.status === 429) throw new Error('OpenAI Rate Limit Exceeded. Check your usage limits.')
            throw new Error(`OpenAI error: ${response.status} ${response.statusText}`)
        }
        if (!response.body) throw new Error('No response body')

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        const partialToolCalls = new Map<number, { name: string; arguments: string }>()

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')

            // Keep the last partial line in the buffer
            buffer = lines.pop() || ''

            for (const line of lines) {
                const trimmed = line.replace(/^data: /, '').trim()
                if (!trimmed || trimmed === '[DONE]') continue

                try {
                    const data = JSON.parse(trimmed)
                    const delta = data.choices?.[0]?.delta

                    // Handle regular content
                    if (delta?.content) {
                        onChunk(delta.content)
                    }

                    // Handle reasoning_content (common in DeepSeek and OpenRouter models)
                    if (delta?.reasoning_content) {
                        // We wrap it in tags to ensure our UI catches it
                        onChunk(`<think>${delta.reasoning_content}</think>`)
                    }

                    // Handle native streaming tool calls
                    const toolDeltas = delta?.tool_calls
                    if (Array.isArray(toolDeltas)) {
                        for (const toolDelta of toolDeltas) {
                            const index = typeof toolDelta?.index === 'number' ? toolDelta.index : 0
                            const existing = partialToolCalls.get(index) || { name: '', arguments: '' }
                            if (typeof toolDelta?.function?.name === 'string') {
                                existing.name = toolDelta.function.name
                            }
                            if (typeof toolDelta?.function?.arguments === 'string') {
                                existing.arguments += toolDelta.function.arguments
                            }
                            partialToolCalls.set(index, existing)
                        }
                    }
                } catch (e) {
                    console.error('Error parsing OpenAI stream chunk:', e)
                }
            }
        }

        const toolCalls = this.extractNativeToolCalls(
            Array.from(partialToolCalls.values()).map(tc => ({
                function: {
                    name: tc.name,
                    arguments: tc.arguments
                }
            }))
        )
        return toolCalls.length > 0 ? { toolCalls } : {}
    }

    /**
     * Stream from Anthropic
     */
    private async streamFromAnthropic(
        messages: ChatMessage[],
        model: ModelDefinition,
        onChunk: (chunk: string) => void
    ): Promise<StreamProviderResult> {
        const systemMessage = messages.find((m) => m.role === 'system')
        const conversationMessages = messages.filter((m) => m.role !== 'system')

        const response = await tauriFetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.getApiKey('anthropic') || '',
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: model.id,
                max_tokens: 4096,
                system: systemMessage?.content,
                messages: conversationMessages,
                tools: this.getAnthropicTools(),
                stream: true,
            }),
        })

        if (!response.ok) throw new Error(`Anthropic error: ${response.statusText}`)
        if (!response.body) throw new Error('No response body')

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        const openToolBlocks = new Map<number, { name: string; input: string }>()
        const completedToolBlocks: Array<{ name: string; input: string }> = []

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')

            // Keep the last partial line in the buffer
            buffer = lines.pop() || ''

            for (const line of lines) {
                const trimmed = line.replace(/^data: /, '').trim()
                if (!trimmed) continue

                try {
                    const data = JSON.parse(trimmed)
                    const blockIndex = typeof data.index === 'number' ? data.index : 0

                    // Handle text content
                    if (data.type === 'content_block_delta' && data.delta?.text) {
                        onChunk(data.delta.text)
                    }

                    // Handle tool use start
                    if (data.type === 'content_block_start' && data.content_block?.type === 'tool_use') {
                        openToolBlocks.set(blockIndex, {
                            name: data.content_block.name || '',
                            input: ''
                        })
                    }

                    // Handle tool input delta
                    if (data.type === 'content_block_delta' && data.delta?.type === 'input_json_delta') {
                        const existing = openToolBlocks.get(blockIndex)
                        if (existing) {
                            existing.input += data.delta.partial_json || ''
                            openToolBlocks.set(blockIndex, existing)
                        }
                    }

                    // Handle content block stop (tool use finished)
                    if (data.type === 'content_block_stop') {
                        const completed = openToolBlocks.get(blockIndex)
                        if (completed && completed.name) {
                            completedToolBlocks.push(completed)
                            openToolBlocks.delete(blockIndex)
                        }
                    }

                } catch (e) {
                    // Ignore other event types
                }
            }
        }

        for (const pending of openToolBlocks.values()) {
            if (pending.name) completedToolBlocks.push(pending)
        }

        const toolCalls = this.extractNativeToolCalls(
            completedToolBlocks.map(tb => ({
                name: tb.name,
                input: tb.input
            }))
        )
        return toolCalls.length > 0 ? { toolCalls } : {}
    }

    /**
     * Test Ollama connection
     */
    private async testOllamaConnection(): Promise<{ success: boolean; message: string }> {
        try {
            const response = await fetch(`${this.settings.ollamaUrl}/api/tags`)
            if (response.ok) {
                return {
                    success: true,
                    message: 'Successfully connected to Ollama',
                }
            }
            return {
                success: false,
                message: `Failed to connect: ${response.statusText}`,
            }
        } catch (error) {
            return {
                success: false,
                message: `Cannot reach Ollama at ${this.settings.ollamaUrl}`,
            }
        }
    }

    /**
     * Test cloud provider connection
     */
    private async testCloudConnection(): Promise<{ success: boolean; message: string }> {
        const apiKey = this.getApiKey(this.settings.cloudProvider)
        if (!apiKey) {
            return {
                success: false,
                message: 'API key is required',
            }
        }

        try {
            // Test with a simple API call
            const testMessages: ChatMessage[] = [
                { role: 'user', content: 'Hi' },
            ]
            const modelId = this.settings.preferredModelId || 'gpt-3.5-turbo'
            const model = ModelRegistry.getInstance().getModelById(modelId)

            if (!model || model.type !== 'cloud') {
                return { success: false, message: 'No valid cloud model configured for testing' }
            }

            const result = await this.sendToCloudProvider(testMessages, model)

            if (result.error) {
                return {
                    success: false,
                    message: result.error,
                }
            }

            return {
                success: true,
                message: `Successfully connected to ${this.settings.cloudProvider}`,
            }
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Connection test failed',
            }
        }
    }

    /**
     * Test Google connection
     */
    private async testGoogleConnection(): Promise<{ success: boolean; message: string }> {
        const apiKey = this.getApiKey('google')
        if (!apiKey) {
            return {
                success: false,
                message: 'Google API key is required',
            }
        }

        try {
            const modelId = this.settings.preferredModelId || 'gemini-1.5-flash'
            const response = await tauriFetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] })
            })

            if (response.ok) {
                return {
                    success: true,
                    message: 'Successfully connected to Google Gemini',
                }
            }
            return {
                success: false,
                message: `Failed to connect: ${response.statusText}`,
            }
        } catch (error) {
            return {
                success: false,
                message: `Cannot reach Gemini API`,
            }
        }
    }

    /**
     * Send message to Google Gemini
     */
    private async sendToGoogle(messages: ChatMessage[], model: ModelDefinition): Promise<ChatResponse> {
        const apiKey = this.getApiKey('google')
        const tools = this.getGoogleTools()
        const contents = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [
                { text: m.content },
                ...(m.images || []).map(img => {
                    const { mimeType, data } = this.parseImage(img)
                    return {
                        inline_data: {
                            mime_type: mimeType,
                            data: data
                        }
                    }
                })
            ]
        }))

        // Handle system instruction if present
        const systemMsg = messages.find(m => m.role === 'system')
        const body: any = { contents }
        if (systemMsg) {
            body.system_instruction = { parts: [{ text: systemMsg.content }] }
        }
        if (tools.length > 0) {
            body.tools = tools
            body.tool_config = { function_calling_config: { mode: 'AUTO' } }
        }

        const response = await tauriFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(`Gemini API error: ${response.statusText}${errorData.error?.message ? ' - ' + errorData.error.message : ''}`)
        }

        const data = await response.json()
        const parts = data.candidates?.[0]?.content?.parts || []
        const text = parts
            .filter((part: any) => typeof part?.text === 'string')
            .map((part: any) => part.text)
            .join('\n')
        const toolCalls = this.extractGeminiToolCalls(parts)

        return {
            message: text,
            ...(toolCalls.length > 0 ? { toolCalls } : {})
        }
    }

    /**
     * Stream from Google Gemini
     */
    private async streamFromGoogle(
        messages: ChatMessage[],
        model: ModelDefinition,
        onChunk: (chunk: string) => void
    ): Promise<StreamProviderResult> {
        const apiKey = this.getApiKey('google')
        const tools = this.getGoogleTools()
        const contents = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [
                { text: m.content },
                ...(m.images || []).map(img => {
                    const { mimeType, data } = this.parseImage(img)
                    return {
                        inline_data: {
                            mime_type: mimeType,
                            data: data
                        }
                    }
                })
            ]
        }))

        const body: any = { contents }
        const systemMsg = messages.find(m => m.role === 'system')
        if (systemMsg) {
            body.system_instruction = { parts: [{ text: systemMsg.content }] }
        }
        if (tools.length > 0) {
            body.tools = tools
            body.tool_config = { function_calling_config: { mode: 'AUTO' } }
        }

        const response = await tauriFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.id}:streamGenerateContent?alt=sse&key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(`Gemini API error: ${response.statusText}${errorData.error?.message ? ' - ' + errorData.error.message : ''}`)
        }

        const reader = response.body?.getReader()
        if (!reader) return {}

        const decoder = new TextDecoder()
        let buffer = ''
        const toolCalls: { name: string; arguments: any }[] = []

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6))
                        const parts = data.candidates?.[0]?.content?.parts || []
                        for (const part of parts) {
                            if (typeof part?.text === 'string' && part.text) {
                                onChunk(part.text)
                            }
                        }
                        const streamedToolCalls = this.extractGeminiToolCalls(parts)
                        if (streamedToolCalls.length > 0) {
                            toolCalls.push(...streamedToolCalls)
                        }
                    } catch (e) {
                        // Ignore parsing errors for partial chunks
                    }
                }
            }
        }

        const dedupedToolCalls: { name: string; arguments: any }[] = []
        const seen = new Set<string>()
        for (const toolCall of toolCalls) {
            const key = `${toolCall.name}:${JSON.stringify(toolCall.arguments)}`
            if (!seen.has(key)) {
                seen.add(key)
                dedupedToolCalls.push(toolCall)
            }
        }

        return dedupedToolCalls.length > 0 ? { toolCalls: dedupedToolCalls } : {}
    }
}
