import { useStore } from '../../store'

export class CreateAgentTool {
    static async execute(args: any): Promise<string> {
        const { name, description, systemPrompt, icon, color, enabledTools, preferredModelId } = args

        if (!name || !systemPrompt) {
            throw new Error('Name and System Prompt are required to create an agent.')
        }

        // Default values
        const newAgent = {
            name,
            description: description || '',
            systemPrompt,
            icon: icon || 'Bot',
            color: color || '#3b82f6',
            enabledTools: enabledTools || [],
            preferredModelId: preferredModelId || undefined
        }

        try {
            useStore.getState().addAgent(newAgent)
            return `Successfully created new agent: "${name}".`
        } catch (error) {
            throw new Error(`Failed to create agent: ${error}`)
        }
    }
}
