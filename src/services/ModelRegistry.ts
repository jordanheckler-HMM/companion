// Use native fetch for Ollama (localhost) - Tauri HTTP plugin has issues with loopback

export interface ModelDefinition {
    id: string
    displayName: string
    provider: 'ollama' | 'openai' | 'anthropic' | 'google'
    type: 'local' | 'cloud'
    capabilities: {
        tools: boolean
        vision: boolean
        streaming: boolean
        maxTokens: number
    }
    cost?: {
        inputPerMillion: number
        outputPerMillion: number
    }
    status: 'available' | 'downloading' | 'not_installed'
}

export class ModelRegistry {
    private static instance: ModelRegistry
    private models: ModelDefinition[] = []

    private constructor() {
        this.initializeStaticModels()
    }

    public static getInstance(): ModelRegistry {
        if (!ModelRegistry.instance) {
            ModelRegistry.instance = new ModelRegistry()
        }
        return ModelRegistry.instance
    }

    private initializeStaticModels() {
        // Cloud Models (Static List - can be updated via API later)
        this.models = [
            {
                id: 'gpt-4-turbo',
                displayName: 'GPT-4 Turbo',
                provider: 'openai',
                type: 'cloud',
                capabilities: { tools: true, vision: true, streaming: true, maxTokens: 128000 },
                cost: { inputPerMillion: 10, outputPerMillion: 30 },
                status: 'available'
            },
            {
                id: 'gpt-5.2',
                displayName: 'GPT-5.2',
                provider: 'openai',
                type: 'cloud',
                capabilities: { tools: true, vision: true, streaming: true, maxTokens: 256000 },
                cost: { inputPerMillion: 15, outputPerMillion: 45 },
                status: 'available'
            },
            {
                id: 'gpt-5-main',
                displayName: 'GPT-5',
                provider: 'openai',
                type: 'cloud',
                capabilities: { tools: true, vision: true, streaming: true, maxTokens: 128000 },
                cost: { inputPerMillion: 8, outputPerMillion: 24 },
                status: 'available'
            },
            {
                id: 'gpt-4o',
                displayName: 'GPT-4o',
                provider: 'openai',
                type: 'cloud',
                capabilities: { tools: true, vision: true, streaming: true, maxTokens: 128000 },
                cost: { inputPerMillion: 5, outputPerMillion: 15 },
                status: 'available'
            },
            {
                id: 'gpt-3.5-turbo',
                displayName: 'GPT-3.5 Turbo',
                provider: 'openai',
                type: 'cloud',
                capabilities: { tools: true, vision: false, streaming: true, maxTokens: 16000 },
                cost: { inputPerMillion: 0.5, outputPerMillion: 1.5 },
                status: 'available'
            },
            {
                id: 'claude-sonnet-4-5-20250929',
                displayName: 'Claude 3.5 Sonnet',
                provider: 'anthropic',
                type: 'cloud',
                capabilities: { tools: true, vision: true, streaming: true, maxTokens: 1000000 },
                cost: { inputPerMillion: 3, outputPerMillion: 15 },
                status: 'available'
            },
            {
                id: 'claude-opus-4-5-20251101',
                displayName: 'Claude 3 Opus',
                provider: 'anthropic',
                type: 'cloud',
                capabilities: { tools: true, vision: true, streaming: true, maxTokens: 200000 },
                cost: { inputPerMillion: 15, outputPerMillion: 75 },
                status: 'available'
            },
            {
                id: 'claude-haiku-4-5-20251001',
                displayName: 'Claude 3 Haiku',
                provider: 'anthropic',
                type: 'cloud',
                capabilities: { tools: true, vision: false, streaming: true, maxTokens: 200000 },
                cost: { inputPerMillion: 0.25, outputPerMillion: 1.25 },
                status: 'available'
            },
            {
                id: 'gemini-2.0-flash',
                displayName: 'Gemini 2.0 Flash',
                provider: 'google',
                type: 'cloud',
                capabilities: { tools: true, vision: true, streaming: true, maxTokens: 1000000 },
                cost: { inputPerMillion: 0.1, outputPerMillion: 0.4 },
                status: 'available'
            },
            {
                id: 'gemini-1.5-pro',
                displayName: 'Gemini 1.5 Pro',
                provider: 'google',
                type: 'cloud',
                capabilities: { tools: true, vision: true, streaming: true, maxTokens: 2000000 },
                cost: { inputPerMillion: 1.25, outputPerMillion: 5.0 },
                status: 'available'
            },
            {
                id: 'gemini-1.5-flash',
                displayName: 'Gemini 1.5 Flash',
                provider: 'google',
                type: 'cloud',
                capabilities: { tools: true, vision: true, streaming: true, maxTokens: 1000000 },
                cost: { inputPerMillion: 0.075, outputPerMillion: 0.3 },
                status: 'available'
            },
            {
                id: 'gemini-2.5-flash',
                displayName: 'Gemini 2.5 Flash',
                provider: 'google',
                type: 'cloud',
                capabilities: { tools: true, vision: true, streaming: true, maxTokens: 2000000 },
                cost: { inputPerMillion: 0.05, outputPerMillion: 0.2 },
                status: 'available'
            },
            {
                id: 'gemini-2.5-pro',
                displayName: 'Gemini 2.5 Pro',
                provider: 'google',
                type: 'cloud',
                capabilities: { tools: true, vision: true, streaming: true, maxTokens: 5000000 },
                cost: { inputPerMillion: 1.0, outputPerMillion: 4.0 },
                status: 'available'
            },
            {
                id: 'gemini-3.0-ultra',
                displayName: 'Gemini 3.0 Ultra',
                provider: 'google',
                type: 'cloud',
                capabilities: { tools: true, vision: true, streaming: true, maxTokens: 10000000 },
                cost: { inputPerMillion: 5.0, outputPerMillion: 15.0 },
                status: 'available'
            }
        ]
    }

    public getAllModels(): ModelDefinition[] {
        return this.models
    }

    public getModelById(id: string): ModelDefinition | undefined {
        return this.models.find(m => m.id === id)
    }

    public async syncOllamaModels(ollamaUrl: string): Promise<void> {
        console.log('[ModelRegistry] Syncing Ollama models from:', ollamaUrl)
        try {
            const response = await fetch(`${ollamaUrl}/api/tags`, {
                method: 'GET'
            })

            if (!response.ok) {
                console.error('[ModelRegistry] Ollama API returned non-OK status:', response.status)
                return
            }

            const data: any = await response.json()
            console.log('[ModelRegistry] Ollama response:', data)

            const ollamaModels: ModelDefinition[] = (data.models || []).map((m: any) => ({
                id: m.name,
                displayName: m.name.split(':')[0].toUpperCase(),
                provider: 'ollama',
                type: 'local',
                capabilities: {
                    tools: m.name.includes('llama3') || m.name.includes('mistral') || m.name.includes('command-r'),
                    vision: m.name.includes('llava') || m.name.includes('moondream'),
                    streaming: true,
                    maxTokens: 4096 // Default for many local models
                },
                status: 'available'
            }))

            console.log('[ModelRegistry] Parsed Ollama models:', ollamaModels.length)

            // Merge with static models, removing old ollama models
            this.models = [
                ...this.models.filter(m => m.provider !== 'ollama'),
                ...ollamaModels
            ]
        } catch (e) {
            console.error('[ModelRegistry] Failed to sync Ollama models:', e)
        }
    }

    public addTemporaryModel(model: ModelDefinition) {
        this.models.push(model)
    }
}
