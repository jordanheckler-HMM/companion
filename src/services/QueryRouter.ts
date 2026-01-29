import { ModelRegistry } from './ModelRegistry'

export interface ModelRecommendation {
    modelId: string
    reason: string
    category: 'speed' | 'quality' | 'privacy' | 'tools'
}

export class QueryRouter {
    private static PRIVACY_KEYWORDS = ['password', 'credential', 'secret', 'confidential', 'private', 'api_key', 'token']

    public static analyzeQuery(
        input: string,
        attachmentCount: number,
        toolsEnabled: boolean,
        preferredLocalModelId?: string
    ): ModelRecommendation {
        const registry = ModelRegistry.getInstance()
        const models = registry.getAllModels()

        const lowercaseInput = input.toLowerCase()
        const isPrivate = this.PRIVACY_KEYWORDS.some(word => lowercaseInput.includes(word))

        // Helper to get the best local model (preferred first, then any available)
        const getBestLocalModel = () => {
            if (preferredLocalModelId) {
                const preferred = models.find(m => m.id === preferredLocalModelId && m.type === 'local' && m.status === 'available')
                if (preferred) return preferred
            }
            return models.find(m => m.type === 'local' && m.status === 'available')
        }

        // Rule 1: Privacy First
        if (isPrivate) {
            const bestLocal = getBestLocalModel()
            if (bestLocal) {
                return {
                    modelId: bestLocal.id,
                    reason: 'Sensitive keywords detected. Using local model for maximum privacy.',
                    category: 'privacy'
                }
            }
        }

        // Rule 2: Complexity / Length / Massive Context
        if (input.length > 5000 || attachmentCount >= 3) {
            const contextKing = models.find(m => m.id === 'gemini-1.5-pro')
            if (contextKing) {
                return {
                    modelId: contextKing.id,
                    reason: 'Large amount of data detected. Routing to Gemini 1.5 Pro for massive context support (1M+ tokens).',
                    category: 'quality'
                }
            }
        }

        if (input.length > 2000 || attachmentCount > 1) {
            const flagshipCloud = models.find(m =>
                m.id === 'gpt-5.2' ||
                m.id === 'claude-opus-4-5-20251101' ||
                m.id === 'gemini-1.5-pro'
            )
            if (flagshipCloud) {
                return {
                    modelId: flagshipCloud.id,
                    reason: 'Highly complex query detected. Routing to flagship model for best reasoning.',
                    category: 'quality'
                }
            }
        }

        if (input.length > 500 || attachmentCount > 0) {
            const bestCloud = models.find(m =>
                m.id === 'gpt-4o' ||
                m.id === 'claude-sonnet-4-5-20250929' ||
                m.id === 'gemini-2.0-flash'
            )
            if (bestCloud) {
                return {
                    modelId: bestCloud.id,
                    reason: 'Moderate context query detected. Using reliable cloud model.',
                    category: 'quality'
                }
            }
        }

        // Rule 3: Tool Usage
        if (toolsEnabled) {
            const toolModel = models.find(m => m.capabilities.tools && m.type === 'cloud')
            if (toolModel) {
                return {
                    modelId: toolModel.id,
                    reason: 'Tools are enabled. Using cloud model for reliable tool execution.',
                    category: 'tools'
                }
            }
        }

        // Default: Best available local model for speed and cost (respecting preference)
        const defaultModel = getBestLocalModel() || models.find(m => m.id === 'gpt-3.5-turbo')

        return {
            modelId: defaultModel?.id || 'gpt-3.5-turbo',
            reason: 'General query. Using efficient model for fast response.',
            category: 'speed'
        }
    }

    public static selectModel(
        mode: 'local' | 'cloud',
        preferredModelId?: string,
        _queryContext?: { input: string; attachmentCount: number; toolsEnabled: boolean }
    ): string {
        const registry = ModelRegistry.getInstance()
        const models = registry.getAllModels()

        if (mode === 'cloud') {
            // If preferred is cloud, use it. Else use flagship logic.
            const preferred = preferredModelId ? models.find(m => m.id === preferredModelId) : null
            if (preferred && preferred.type === 'cloud') return preferred.id

            return models.find(m => m.id === 'gpt-5.2')?.id ||
                models.find(m => m.id === 'claude-opus-4-5-20251101')?.id ||
                models.find(m => m.id === 'gpt-5-main')?.id ||
                models.find(m => m.type === 'cloud' && (m.id.includes('4') || m.id.includes('opus') || m.id.includes('sonnet')))?.id ||
                'gpt-4o'
        }

        // Local mode: Strictly local
        const preferred = preferredModelId ? models.find(m => m.id === preferredModelId) : null
        if (preferred && preferred.type === 'local' && preferred.status === 'available') return preferred.id

        // Fallback to best available local model
        const bestLocal = models.find(m => m.type === 'local' && m.status === 'available')
        return bestLocal?.id || 'gpt-4o' // Cloud fallback if no local models
    }
}
