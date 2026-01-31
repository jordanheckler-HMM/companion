import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'
import { open } from '@tauri-apps/plugin-dialog'
import { useStore, AgentBlueprint, Automation } from '../store'

interface ExportData {
    type: 'agent' | 'automation'
    version: string
    data: AgentBlueprint | Automation
    metadata: {
        exportedAt: string
        appName: 'Companion'
    }
}

export class SharingService {
    /**
     * Export an agent to a JSON file
     */
    static async exportAgent(agentId: string): Promise<void> {
        const agent = useStore.getState().agents.find(a => a.id === agentId)
        if (!agent) throw new Error('Agent not found')

        const exportData: ExportData = {
            type: 'agent',
            version: '1.0',
            data: agent,
            metadata: {
                exportedAt: new Date().toISOString(),
                appName: 'Companion'
            }
        }

        await this.saveFile(
            `${agent.name.toLowerCase().replace(/\s+/g, '-')}-agent.json`,
            JSON.stringify(exportData, null, 2)
        )
    }

    /**
     * Export an automation to a JSON file
     */
    static async exportAutomation(automationId: string): Promise<void> {
        const automation = useStore.getState().automations.find(a => a.id === automationId)
        if (!automation) throw new Error('Automation not found')

        const exportData: ExportData = {
            type: 'automation',
            version: '1.0',
            data: automation,
            metadata: {
                exportedAt: new Date().toISOString(),
                appName: 'Companion'
            }
        }

        await this.saveFile(
            `${automation.name.toLowerCase().replace(/\s+/g, '-')}-workflow.json`,
            JSON.stringify(exportData, null, 2)
        )
    }

    /**
     * Import from a file
     */
    static async importFromFile(): Promise<{ type: 'agent' | 'automation', name: string } | null> {
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Companion Export',
                    extensions: ['json']
                }]
            })

            if (!selected) return null

            const filePath = selected as string // Type assertion for single file
            const content = await readTextFile(filePath)
            const parsed: ExportData = JSON.parse(content)

            if (!this.validateImport(parsed)) {
                throw new Error('Invalid file format or incompatible version')
            }

            // Generate new ID to avoid collisions
            const newId = crypto.randomUUID()
            const newData = { ...parsed.data, id: newId }

            if (parsed.type === 'agent') {
                useStore.getState().addAgent(newData as AgentBlueprint)
                return { type: 'agent', name: (newData as AgentBlueprint).name }
            } else if (parsed.type === 'automation') {
                // Ensure automation is inactive on import
                const automationData = newData as Automation
                automationData.isActive = false
                useStore.getState().addAutomation(automationData)
                return { type: 'automation', name: automationData.name }
            }

            return null
        } catch (error) {
            console.error('Import failed', error)
            throw new Error(`Import failed: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * Save file helper
     */
    private static async saveFile(defaultName: string, content: string): Promise<void> {
        const filePath = await save({
            defaultPath: defaultName,
            filters: [{
                name: 'JSON',
                extensions: ['json']
            }]
        })

        if (filePath) {
            await writeTextFile(filePath, content)
        }
    }

    /**
     * Validate imported data structure
     */
    private static validateImport(data: any): boolean {
        if (!data || typeof data !== 'object') return false
        if (data.metadata?.appName !== 'Companion') return false
        if (!['agent', 'automation'].includes(data.type)) return false
        if (!data.data || !data.data.name) return false
        return true
    }
}
