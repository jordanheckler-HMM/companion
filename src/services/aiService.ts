import { AISettings } from '../store'
import { ToolService } from './toolService'
import { ModelRegistry, ModelDefinition } from './ModelRegistry'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

// Note: Use native `fetch` for Ollama (localhost) requests due to Tauri HTTP plugin issues with loopback

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system'
    content: string
}

export interface ChatResponse {
    message: string
    error?: string
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
                return { message: '', error: `Model ${modelId} not found in registry.` }
            }

            // Inject tool definitions and temporal context into system prompt
            const toolSystemMsg = this.getToolSystemPrompt()
            const temporalContext = this.getTemporalContext()
            const injectedContext = [
                temporalContext,
                toolSystemMsg,
                AIService.EDITOR_INSTRUCTIONS
            ].filter(Boolean).join('\n\n')
            let currentMessages = [...messages]

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
                if (model.provider === 'ollama') {
                    response = await this.sendToOllama(currentMessages, model)
                } else {
                    response = await this.sendToCloudProvider(currentMessages, model)
                }

                if (response.error) return response

                // Check for tool calls in the response
                const toolCalls = this.extractToolCalls(response.message)
                if (toolCalls.length === 0) {
                    return response
                }

                // Execute tools
                currentMessages.push({ role: 'assistant', content: response.message })

                for (const toolCall of toolCalls) {
                    const result = await ToolService.executeTool(toolCall.name, toolCall.arguments)
                    currentMessages.push({
                        role: 'system',
                        content: `Tool Result [${result.tool}]: ${result.result}`
                    })
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
     * Extract tool calls from AI response. 
     * Supports both native tool calls (if any) and a fallback text pattern: 
     * [TOOL:name]{"arg": "val"}[/TOOL]
     */
    private extractToolCalls(content: string): { name: string, arguments: any }[] {
        const tools: { name: string, arguments: any }[] = []

        // Pattern: [TOOL:name]{...}[/TOOL]
        const toolRegex = /\[TOOL:(\w+)\]([\s\S]*?)\[\/TOOL\]/g
        let match

        while ((match = toolRegex.exec(content)) !== null) {
            try {
                const name = match[1]
                const args = JSON.parse(match[2].trim())
                tools.push({ name, arguments: args })
            } catch (e) {
                console.error('Failed to parse tool arguments:', e)
            }
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
    private getOpenAITools(): any[] {
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
            return setting !== false
        })

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
            messages: messages,
        }

        if (tools.length > 0) {
            body.tools = tools
            body.tool_choice = 'auto'
        }

        const response = await tauriFetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.apiKey}`,
            },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(`OpenAI API error: ${response.statusText}${errorData.error?.message ? ' - ' + errorData.error.message : ''}`)
        }

        const data = await response.json()
        const message = data.choices?.[0]?.message

        if (message.tool_calls) {
            // Transform native tool calls into our internal format if needed, 
            // or return/handle them directly. 
            // For now, we'll serialize them into the text format our loop expects, 
            // or ideally we handle them natively.
            // Let's serialize them to our internal text format to keep the loop logic unified for now.
            const serializedTools = message.tool_calls.map((tc: any) =>
                `[TOOL:${tc.function.name}]${tc.function.arguments}[/TOOL]`
            ).join('\n')

            return {
                message: (message.content || '') + '\n' + serializedTools
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
            messages: messages,
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
            throw new Error(`Ollama API error: ${response.statusText}`)
        }

        const data = await response.json()
        const message = data.message

        if (message.tool_calls) {
            const serializedTools = message.tool_calls.map((tc: any) =>
                `[TOOL:${tc.function.name}]${JSON.stringify(tc.function.arguments)}[/TOOL]`
            ).join('\n')

            return {
                message: (message.content || '') + '\n' + serializedTools
            }
        }

        return {
            message: message.content || '',
        }
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
                'x-api-key': this.settings.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: model.id,
                max_tokens: 4096,
                system: systemMessage?.content,
                messages: conversationMessages,
            }),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(`Anthropic API error: ${response.statusText}${errorData.error?.message ? ' - ' + errorData.error.message : ''}`)
        }

        const data = await response.json()
        return {
            message: data.content?.[0]?.text || '',
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

    private getToolSystemPrompt(): string {
        if (this.settings.providerType === 'cloud' && (this.settings.cloudProvider === 'openai' || this.settings.cloudProvider === 'google')) {
            return ''
        }

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
            return setting !== false // Default to true if undefined
        })

        if (enabledTools.length === 0) return ''

        const toolList = enabledTools.map(t =>
            `- ${t.name}: ${t.description}`
        ).join('\n')

        return `
YOU ARE A TOOL-USING ASSISTANT. When you need external information, you MUST output a tool call.

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
        explicitModelId?: string
    ): Promise<void> {
        const registry = ModelRegistry.getInstance()
        const modelId = explicitModelId || this.settings.preferredModelId || 'gpt-3.5-turbo'
        const model = registry.getModelById(modelId)

        if (!model) {
            onChunk(`Error: Model ${modelId} not found in registry.`)
            return
        }

        // Inject tool definitions and temporal context into system prompt
        const toolSystemMsg = this.getToolSystemPrompt()
        const temporalContext = this.getTemporalContext()
        const injectedContext = [
            temporalContext,
            toolSystemMsg,
            AIService.EDITOR_INSTRUCTIONS
        ].filter(Boolean).join('\n\n')
        let currentMessages = [...messages]

        // Find system message or add one
        const systemMsgIndex = currentMessages.findIndex(m => m.role === 'system')
        if (systemMsgIndex !== -1) {
            currentMessages[systemMsgIndex].content += "\n\n" + injectedContext
        } else {
            currentMessages.unshift({ role: 'system', content: injectedContext })
        }

        let maxIterations = 3 // Reduced from 5
        let iterationCount = 0

        while (iterationCount < maxIterations) {
            let fullResponse = ''
            const streamChunk = (chunk: string) => {
                fullResponse += chunk
                onChunk(chunk)
            }

            if (model.provider === 'ollama') {
                await this.streamFromOllama(currentMessages, model, streamChunk)
            } else if (model.provider === 'openai') {
                await this.streamFromOpenAI(currentMessages, model, streamChunk)
            } else if (model.provider === 'google') {
                await this.streamFromGoogle(currentMessages, model, streamChunk)
            } else {
                await this.streamFromAnthropic(currentMessages, model, streamChunk)
            }

            const toolCalls = this.extractToolCalls(fullResponse)

            // Exit loop if no tool calls found - this is the normal case
            if (toolCalls.length === 0) {
                break
            }

            // Only continue looping if we actually executed tools
            currentMessages.push({ role: 'assistant', content: fullResponse })

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

    /**
     * Stream from Ollama
     */
    private async streamFromOllama(messages: ChatMessage[], model: ModelDefinition, onChunk: (chunk: string) => void) {
        // Add a safety timeout for the INITIAL connection
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

        const response = await fetch(`${this.settings.ollamaUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model.id,
                messages,
                stream: true,
            }),
        })

        clearTimeout(timeoutId)

        if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`)
        if (!response.body) throw new Error('No response body')

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
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
    }

    /**
     * Stream from OpenAI
     */
    private async streamFromOpenAI(messages: ChatMessage[], model: ModelDefinition, onChunk: (chunk: string) => void) {
        const response = await tauriFetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.apiKey}`,
            },
            body: JSON.stringify({
                model: model.id,
                messages,
                stream: true,
            }),
        })

        if (!response.ok) throw new Error(`OpenAI error: ${response.statusText}`)
        if (!response.body) throw new Error('No response body')

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

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
                } catch (e) {
                    console.error('Error parsing OpenAI stream chunk:', e)
                }
            }
        }
    }

    /**
     * Stream from Anthropic
     */
    private async streamFromAnthropic(messages: ChatMessage[], model: ModelDefinition, onChunk: (chunk: string) => void) {
        const systemMessage = messages.find((m) => m.role === 'system')
        const conversationMessages = messages.filter((m) => m.role !== 'system')

        const response = await tauriFetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.settings.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: model.id,
                max_tokens: 4096,
                system: systemMessage?.content,
                messages: conversationMessages,
                stream: true,
            }),
        })

        if (!response.ok) throw new Error(`Anthropic error: ${response.statusText}`)
        if (!response.body) throw new Error('No response body')

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

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
                    if (data.type === 'content_block_delta' && data.delta?.text) {
                        onChunk(data.delta.text)
                    }
                } catch (e) {
                    // Ignore other event types
                }
            }
        }
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
        if (!this.settings.apiKey) {
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
        const apiKey = this.settings.googleApiKey || this.settings.apiKey
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
        const apiKey = this.settings.googleApiKey || this.settings.apiKey
        const contents = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }))

        // Handle system instruction if present
        const systemMsg = messages.find(m => m.role === 'system')
        const body: any = { contents }
        if (systemMsg) {
            body.system_instruction = { parts: [{ text: systemMsg.content }] }
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
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        return { message: text }
    }

    /**
     * Stream from Google Gemini
     */
    private async streamFromGoogle(messages: ChatMessage[], model: ModelDefinition, onChunk: (chunk: string) => void) {
        const apiKey = this.settings.googleApiKey || this.settings.apiKey
        const contents = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }))

        const body: any = { contents }
        const systemMsg = messages.find(m => m.role === 'system')
        if (systemMsg) {
            body.system_instruction = { parts: [{ text: systemMsg.content }] }
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
        if (!reader) return

        const decoder = new TextDecoder()
        let buffer = ''

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
                        const chunk = data.candidates?.[0]?.content?.parts?.[0]?.text
                        if (chunk) onChunk(chunk)
                    } catch (e) {
                        // Ignore parsing errors for partial chunks
                    }
                }
            }
        }
    }
}
