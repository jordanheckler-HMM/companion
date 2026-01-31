import { Automation, PipelineStep, useStore } from '@/store'
import { ToolService } from './toolService'
import { AIService } from './aiService'
import { VaultService } from './VaultService'
import { schedulerService } from './SchedulerService'

interface PipelineContext {
    variables: Record<string, string>
    logs: string[]
}

class AutomationService {
    private runningAutomations: Set<string> = new Set()

    /**
     * Start an automation (activate trigger listener)
     */
    async startAutomation(automationId: string): Promise<void> {
        const automation = useStore.getState().automations.find(a => a.id === automationId)
        if (!automation) {
            console.error(`Automation ${automationId} not found`)
            return
        }

        // Update state to active
        useStore.getState().updateAutomation(automationId, { isActive: true })

        // Set up trigger
        if (automation.trigger.type === 'schedule') {
            schedulerService.scheduleJob(
                automationId,
                automation.trigger,
                () => this.runNow(automationId)
            )
        }
    }

    /**
     * Stop an automation (deactivate trigger)
     */
    stopAutomation(automationId: string): void {
        useStore.getState().updateAutomation(automationId, { isActive: false })
        schedulerService.cancelJob(automationId)
    }

    /**
     * Execute automation immediately
     */
    async runNow(automationId: string): Promise<void> {
        if (this.runningAutomations.has(automationId)) {
            console.warn(`Automation ${automationId} is already running`)
            return
        }

        const automation = useStore.getState().automations.find(a => a.id === automationId)
        if (!automation) {
            console.error(`Automation ${automationId} not found`)
            return
        }

        this.runningAutomations.add(automationId)
        useStore.getState().setRunningAutomationIds(Array.from(this.runningAutomations))

        try {
            await this.executePipeline(automation)

            // Update last run time
            useStore.getState().updateAutomation(automationId, {
                lastRunAt: new Date().toISOString()
            })
        } catch (error) {
            console.error(`Error running automation ${automationId}:`, error)
        } finally {
            this.runningAutomations.delete(automationId)
            useStore.getState().setRunningAutomationIds(Array.from(this.runningAutomations))
        }
    }

    /**
     * Execute a pipeline of steps
     */
    private async executePipeline(automation: Automation): Promise<void> {
        const context: PipelineContext = {
            variables: {},
            logs: []
        }

        context.logs.push(`[${new Date().toISOString()}] Starting automation: ${automation.name}`)

        // Initialize progress
        const totalSteps = automation.pipeline.length
        useStore.getState().updateAutomationProgress(automation.id, { current: 0, total: totalSteps })

        for (let i = 0; i < totalSteps; i++) {
            const step = automation.pipeline[i]

            // Update progress: Step i+1 is running
            useStore.getState().updateAutomationProgress(automation.id, { current: i + 1, total: totalSteps })

            try {
                await this.executeStep(step, context)
            } catch (error) {
                context.logs.push(`[ERROR] Step ${step.id} failed: ${error}`)
                throw error
            }
        }

        context.logs.push(`[${new Date().toISOString()}] Automation completed successfully`)
    }

    /**
     * Execute a single pipeline step
     */
    private async executeStep(
        step: PipelineStep,
        context: PipelineContext
    ): Promise<void> {
        context.logs.push(`[STEP] Executing: ${step.type} (${step.id})`)

        switch (step.type) {
            case 'agent_action':
                await this.executeAgentAction(step, context)
                break

            case 'integration_action':
                await this.executeIntegrationAction(step, context)
                break

            case 'save_to_vault':
                await this.executeSaveToVault(step, context)
                break

            case 'wait':
                await this.executeWait(step, context)
                break

            case 'condition':
                // Future: implement conditional logic
                context.logs.push(`[SKIP] Conditional steps not yet implemented`)
                break

            default:
                throw new Error(`Unknown step type: ${(step as any).type}`)
        }
    }

    /**
     * Execute integration action step
     */
    private async executeIntegrationAction(
        step: PipelineStep,
        context: PipelineContext
    ): Promise<void> {
        if (!step.integrationId || !step.integrationAction) {
            throw new Error('Integration step incomplete: missing integration or action')
        }

        const args = step.integrationArgs || {}
        const resolvedArgs: Record<string, any> = {
            operation: step.integrationAction // Core tools use 'operation' param
        }

        // Resolve variables in arguments
        for (const [key, value] of Object.entries(args)) {
            resolvedArgs[key] = this.resolveVariables(value, context.variables)
        }

        // Some tool args need numeric conversion (e.g. limit/count)
        if (resolvedArgs.count) resolvedArgs.count = parseInt(resolvedArgs.count)
        if (resolvedArgs.limit) resolvedArgs.limit = parseInt(resolvedArgs.limit)

        console.log(`[AutomationService] Executing integration: ${step.integrationId}.${step.integrationAction}`, resolvedArgs)
        context.logs.push(`[INTEGRATION] Calling ${step.integrationId} -> ${step.integrationAction}`)

        try {
            const result = await ToolService.executeTool(step.integrationId, resolvedArgs)

            if (result.isError) {
                throw new Error(result.result)
            }

            const output = result.result
            console.log(`[AutomationService] Integration output length: ${output.length}`)

            // Store output
            if (step.outputVariable) {
                context.variables[step.outputVariable] = output
                context.logs.push(`[OUTPUT] Stored as: ${step.outputVariable}`)
            }
            context.variables['last_output'] = output

        } catch (error) {
            console.error('[AutomationService] Integration failed:', error)
            throw error // Re-throw to start handler
        }
    }

    /**
     * Execute an agent action step
     */
    private async executeAgentAction(
        step: PipelineStep,
        context: PipelineContext
    ): Promise<void> {
        if (!step.agentId || !step.prompt) {
            const stepIdx = context.logs.filter(l => l.startsWith('[STEP]')).length
            throw new Error(`Step ${stepIdx} (Agent Action) is incomplete: Please select an agent and provide a prompt.`)
        }

        const agent = useStore.getState().agents.find(a => a.id === step.agentId)
        if (!agent) {
            throw new Error(`Agent ${step.agentId} not found`)
        }

        // Replace variables in prompt (e.g., {{previousOutput}})
        const resolvedPrompt = this.resolveVariables(step.prompt, context.variables)

        // Create AI service with agent settings
        const settings = useStore.getState().settings.aiSettings
        const aiService = new AIService(settings)

        // Build messages with agent's system prompt
        const messages = [
            { role: 'system' as const, content: agent.systemPrompt },
            { role: 'user' as const, content: resolvedPrompt }
        ]

        // Execute and collect output
        let output = ''
        console.log(`[AutomationService] Starting stream for agent ${agent.name}...`)

        await aiService.streamMessage(
            messages,
            (chunk) => {
                output += chunk
            },
            agent.preferredModelId || settings.preferredModelId
        )

        console.log(`[AutomationService] Stream complete. Valid Output length: ${output.length}`)
        if (output.length < 100) console.log(`[AutomationService] Output preview: ${output}`)

        // Store output if variable name is specified
        if (step.outputVariable) {
            context.variables[step.outputVariable] = output
            context.logs.push(`[OUTPUT] Stored as: ${step.outputVariable}`)
        }
        // Always store as last_output for implicit chaining
        context.variables['last_output'] = output
        console.log('[AutomationService] Stored to last_output')
    }

    /**
     * Execute save to vault step
     */
    private async executeSaveToVault(
        step: PipelineStep,
        context: PipelineContext
    ): Promise<void> {
        console.log('[AutomationService] executeSaveToVault called', step)

        if (!step.vaultPath) {
            console.error('[AutomationService] No vaultPath specified in step')
            throw new Error('Save to vault requires vaultPath')
        }

        const vaultPath = useStore.getState().vaultPath
        console.log('[AutomationService] Current vault path:', vaultPath)

        if (!vaultPath) {
            throw new Error('Vault path not configured')
        }

        // Get content from specific variable or all variables
        console.log('[AutomationService] Context variables:', Object.keys(context.variables))

        let content = ''
        if (step.sourceVariable) {
            // If user specified a variable, strictly look for it
            content = context.variables[step.sourceVariable] || ''
            console.log(`[AutomationService] Using sourceVariable "${step.sourceVariable}", content length: ${content.length}`)
            if (!content) {
                console.warn(`[AutomationService] Warning: Source variable "${step.sourceVariable}" is empty or undefined`)
            }
        } else {
            // Implicit mode: Try 'last_output' first (most common case), otherwise join all
            content = context.variables['last_output']
            if (content) {
                console.log(`[AutomationService] Using implicit 'last_output', content length: ${content.length}`)
            } else {
                // Fallback to joining all variables if last_output is missing
                content = Object.values(context.variables).join('\n\n')
                console.log(`[AutomationService] Using all variables, content length: ${content.length}`)
            }
        }

        if (!content) {
            throw new Error('No content to save (no previous outputs in pipeline)')
        }

        console.log(`[AutomationService] Writing to vault: ${step.vaultPath} (mode: ${step.writeMode || 'overwrite'})`)
        await VaultService.writeToVault(step.vaultPath, content, step.writeMode || 'overwrite')
        console.log('[AutomationService] Vault write complete')
        context.logs.push(`[SAVED] File written to: ${step.vaultPath} (${step.writeMode || 'overwrite'}) using ${step.sourceVariable || 'all variables'}`)
    }

    /**
     * Execute wait step
     */
    private async executeWait(
        step: PipelineStep,
        context: PipelineContext
    ): Promise<void> {
        const duration = step.waitDuration || 1000
        context.logs.push(`[WAIT] Pausing for ${duration}ms`)
        await new Promise(resolve => setTimeout(resolve, duration))
    }

    /**
     * Replace variable placeholders in text
     */
    private resolveVariables(
        text: string,
        variables: Record<string, string>
    ): string {
        let resolved = text

        // Replace {{variableName}} with actual values
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g')
            resolved = resolved.replace(regex, value)
        }

        return resolved
    }

    /**
     * Get currently running automation IDs
     */
    getRunningAutomations(): string[] {
        return Array.from(this.runningAutomations)
    }

    /**
     * Check if an automation is running
     */
    isRunning(automationId: string): boolean {
        return this.runningAutomations.has(automationId)
    }
}

// Singleton instance
export const automationService = new AutomationService()
