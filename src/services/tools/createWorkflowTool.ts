import { useStore } from '../../store'

export class CreateWorkflowTool {
    static async execute(args: any): Promise<string> {
        const { name, description, trigger, pipeline, isActive } = args

        if (!name || !trigger || !pipeline) {
            throw new Error('Name, Trigger configuration, and Pipeline steps are required to create a workflow.')
        }

        // Validate trigger structure
        if (!trigger.type || !['schedule', 'manual', 'event'].includes(trigger.type)) {
            throw new Error('Invalid trigger type. Must be one of: schedule, manual, event.')
        }

        const newWorkflow = {
            name,
            description: description || '',
            trigger,
            pipeline,
            isActive: isActive !== undefined ? isActive : true, // Default to active
            createdAt: new Date().toISOString()
        }

        try {
            useStore.getState().addAutomation(newWorkflow)
            return `Successfully created new workflow: "${name}" with ${pipeline.length} steps.`
        } catch (error) {
            throw new Error(`Failed to create workflow: ${error}`)
        }
    }
}
