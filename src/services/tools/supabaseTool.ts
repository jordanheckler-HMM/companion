import { createClient } from '@supabase/supabase-js'
import { confirm } from '@tauri-apps/plugin-dialog'
import { useStore } from '../../store'

interface PendingSupabaseAction {
    operation: 'insert' | 'update'
    table: string
    data: any
    id?: string
    privacyBoundary: 'personal' | 'team'
    expiresAt: number
}

export class SupabaseTool {
    private static readonly CONFIRM_TTL_MS = 10 * 60 * 1000
    private static pendingActions = new Map<string, PendingSupabaseAction>()

    /**
     * Execute a Supabase operation on the user's BYOK project
     */
    async execute(operation: string, args: any): Promise<string> {
        const settings = useStore.getState().settings.aiSettings
        const { supabaseUrl, supabaseKey } = settings.toolsEnabled?.supabase || {}

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase tools are enabled but credentials (URL & Key) are missing in settings.')
        }

        SupabaseTool.pruneExpiredActions()
        const client = createClient(supabaseUrl, supabaseKey)

        try {
            switch (operation) {
                case 'get_tables':
                case 'list_tables':
                    return await this.listTables(client)
                case 'get_sample_rows':
                    return await this.getSampleRows(client, args.table, args.limit)
                case 'count_rows':
                    return await this.countRows(client, args.table)
                case 'query':
                    return await this.runQuery(client, args.table, args)
                case 'insert':
                    return await this.insertRow(client, args)
                case 'update':
                    return await this.updateRow(client, args)
                default:
                    return `Unknown operation: ${operation}`
            }
        } catch (error: any) {
            return `Error executing Supabase operation: ${error.message}`
        }
    }

    private async listTables(client: any) {
        // With the service role key, we can query pg_catalog or information_schema directly
        // This gives us full access to table metadata
        try {
            // Try using Supabase's built-in RPC for raw SQL (if available)
            // Otherwise, try querying through PostgREST
            const { data, error } = await client.rpc('get_tables', {}).single()

            if (!error && data) {
                return JSON.stringify(data)
            }

            // Fallback: Try to get tables from a direct REST query
            // This works if the service role key is used
            const settings = useStore.getState().settings.aiSettings
            const { supabaseUrl, supabaseKey } = settings.toolsEnabled?.supabase || {}

            if (!supabaseUrl || !supabaseKey) {
                return JSON.stringify({ error: 'Supabase credentials not configured' })
            }

            // Query using the Data API with raw SQL through the query endpoint
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_tables`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                } as Record<string, string>
            })

            if (response.ok) {
                const tables = await response.json()
                return JSON.stringify(tables)
            }

            // Final fallback: Try the OpenAPI schema endpoint
            const schemaResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                } as Record<string, string>
            })

            if (!schemaResponse.ok) {
                return JSON.stringify({
                    error: 'Could not discover tables. Make sure you are using the Service Role Key (not Anon Key) for full database access.'
                })
            }

            const schema = await schemaResponse.json()
            const tableNames = new Set<string>()

            // Extract from paths
            if (schema.paths) {
                Object.keys(schema.paths).forEach(path => {
                    const match = path.match(/^\/([a-zA-Z_][a-zA-Z0-9_]*)$/)
                    if (match) tableNames.add(match[1])
                })
            }

            // Extract from definitions
            if (schema.definitions) {
                Object.keys(schema.definitions).forEach(def => {
                    if (!def.startsWith('_') && !def.includes('.')) {
                        tableNames.add(def)
                    }
                })
            }

            if (tableNames.size === 0) {
                return JSON.stringify({
                    error: 'No tables found. Use the Service Role Key for full access, or add tables manually.'
                })
            }

            return JSON.stringify(Array.from(tableNames).sort())
        } catch (e: any) {
            return JSON.stringify({ error: `Could not discover tables: ${e.message}` })
        }
    }

    private async getSampleRows(client: any, table: string, limit: number = 5) {
        const { data, error } = await client.from(table).select('*').limit(limit)
        if (error) throw error
        return JSON.stringify(data, null, 2)
    }

    private async countRows(client: any, table: string) {
        const { count, error } = await client.from(table).select('*', { count: 'exact', head: true })
        if (error) throw error
        return count?.toString() || '0'
    }

    private async runQuery(client: any, table: string, args: any) {
        // Handle both older 'query' object and flatter UI args
        const select = args.query?.select || args.select || '*'
        let builder = client.from(table).select(select)

        // Handle flatter filter string (e.g. "status=new")
        const filter = args.query?.filter || args.filter
        if (filter && typeof filter === 'string' && filter.includes('=')) {
            const [col, val] = filter.split('=')
            builder = builder.eq(col.trim(), val.trim())
        }

        // Handle flatter limit
        const limit = args.query?.limit || args.limit
        if (limit) {
            const limitVal = parseInt(limit as string)
            if (!isNaN(limitVal)) builder = builder.limit(limitVal)
        }

        // Handle flatter order (e.g. "created_at:desc")
        const order = args.query?.order || args.order
        if (order && typeof order === 'string') {
            if (order.includes(':')) {
                const [col, dir] = order.split(':')
                builder = builder.order(col.trim(), { ascending: dir.trim().toLowerCase() === 'asc' })
            } else {
                builder = builder.order(order)
            }
        }

        // Backward compatibility for eq object
        if (args.query?.eq) {
            Object.entries(args.query.eq).forEach(([col, val]) => {
                builder = builder.eq(col as string, val)
            })
        }

        const { data, error } = await builder
        if (error) throw error
        return JSON.stringify(data, null, 2)
    }

    private async insertRow(client: any, args: any) {
        const table = args.table
        const data = args.data
        const privacyBoundary = args.privacyBoundary
        const sync = args.sync === true

        if (!table) {
            return this.blocked('Supabase write requires a target table.', { required: ['table'] })
        }

        if (!privacyBoundary || !['personal', 'team'].includes(privacyBoundary)) {
            return this.blocked('Supabase write requires a privacy boundary (personal or team).', { required: ['privacyBoundary'] })
        }

        if (!sync) {
            return this.blocked('Supabase writes must explicitly declare a sync from local state.', { required: ['sync=true'] })
        }

        if (!data || (Array.isArray(data) && data.length === 0)) {
            return this.blocked('Supabase insert requires data to write.', { required: ['data'] })
        }

        const phase = args.phase || 'prepare'
        if (phase !== 'execute') {
            const confirmationId = SupabaseTool.createConfirmationId('insert', table, data, undefined, privacyBoundary)
            return JSON.stringify({
                phase: 'prepare',
                tool: 'supabase',
                operation: 'insert',
                preview: {
                    table,
                    data,
                    privacyBoundary,
                    sync: true
                },
                confirmationId,
                nextStep: 'Call insert with phase="execute", confirmationId, and confirm=true to perform the write.'
            }, null, 2)
        }

        const confirmationId = args.confirmationId
        if (!confirmationId || !SupabaseTool.isConfirmationValid(confirmationId, 'insert')) {
            return this.blocked('Confirmation required before executing write operation.', {
                required: ['confirmationId'],
                nextStep: 'Call insert with phase="prepare" to generate a confirmationId.'
            })
        }

        if (args.confirm !== true) {
            return this.blocked('Explicit confirmation is required to execute this write operation.', {
                required: ['confirm=true']
            })
        }

        const pending = SupabaseTool.pendingActions.get(confirmationId)
        if (!pending) {
            return this.blocked('Confirmation has expired or is invalid.', { required: ['confirmationId'] })
        }

        const approved = await confirm(
            `Insert into ${pending.table}?\n\nPrivacy: ${pending.privacyBoundary}`,
            { title: 'Confirm Supabase Write', kind: 'warning' }
        )
        if (!approved) {
            return 'User denied Supabase insert.'
        }

        const { data: result, error } = await client.from(pending.table).insert(pending.data).select()
        if (error) throw error
        SupabaseTool.pendingActions.delete(confirmationId)
        return JSON.stringify(result, null, 2)
    }

    private async updateRow(client: any, args: any) {
        const table = args.table
        const id = args.id
        const data = args.data
        const privacyBoundary = args.privacyBoundary
        const sync = args.sync === true

        if (!table) {
            return this.blocked('Supabase write requires a target table.', { required: ['table'] })
        }

        if (!id) {
            return this.blocked('Supabase update requires a target id.', { required: ['id'] })
        }

        if (!privacyBoundary || !['personal', 'team'].includes(privacyBoundary)) {
            return this.blocked('Supabase write requires a privacy boundary (personal or team).', { required: ['privacyBoundary'] })
        }

        if (!sync) {
            return this.blocked('Supabase writes must explicitly declare a sync from local state.', { required: ['sync=true'] })
        }

        if (!data || (Array.isArray(data) && data.length === 0)) {
            return this.blocked('Supabase update requires data to write.', { required: ['data'] })
        }

        const phase = args.phase || 'prepare'
        if (phase !== 'execute') {
            const confirmationId = SupabaseTool.createConfirmationId('update', table, data, id, privacyBoundary)
            return JSON.stringify({
                phase: 'prepare',
                tool: 'supabase',
                operation: 'update',
                preview: {
                    table,
                    id,
                    data,
                    privacyBoundary,
                    sync: true
                },
                confirmationId,
                nextStep: 'Call update with phase="execute", confirmationId, and confirm=true to perform the write.'
            }, null, 2)
        }

        const confirmationId = args.confirmationId
        if (!confirmationId || !SupabaseTool.isConfirmationValid(confirmationId, 'update')) {
            return this.blocked('Confirmation required before executing write operation.', {
                required: ['confirmationId'],
                nextStep: 'Call update with phase="prepare" to generate a confirmationId.'
            })
        }

        if (args.confirm !== true) {
            return this.blocked('Explicit confirmation is required to execute this write operation.', {
                required: ['confirm=true']
            })
        }

        const pending = SupabaseTool.pendingActions.get(confirmationId)
        if (!pending) {
            return this.blocked('Confirmation has expired or is invalid.', { required: ['confirmationId'] })
        }

        const approved = await confirm(
            `Update ${pending.table} (id: ${pending.id})?\n\nPrivacy: ${pending.privacyBoundary}`,
            { title: 'Confirm Supabase Write', kind: 'warning' }
        )
        if (!approved) {
            return 'User denied Supabase update.'
        }

        const { data: result, error } = await client.from(pending.table).update(pending.data).eq('id', pending.id).select()
        if (error) throw error
        SupabaseTool.pendingActions.delete(confirmationId)
        return JSON.stringify(result, null, 2)
    }

    private blocked(message: string, details?: Record<string, any>): string {
        return JSON.stringify({
            error: 'EXECUTION_BLOCKED',
            message,
            ...details
        }, null, 2)
    }

    private static createConfirmationId(operation: 'insert' | 'update', table: string, data: any, id: string | undefined, privacyBoundary: 'personal' | 'team'): string {
        const confirmationId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
        this.pendingActions.set(confirmationId, {
            operation,
            table,
            data,
            id,
            privacyBoundary,
            expiresAt: Date.now() + this.CONFIRM_TTL_MS
        })
        return confirmationId
    }

    private static isConfirmationValid(id: string, operation: 'insert' | 'update'): boolean {
        const pending = this.pendingActions.get(id)
        if (!pending) return false
        if (pending.operation !== operation) return false
        if (pending.expiresAt < Date.now()) {
            this.pendingActions.delete(id)
            return false
        }
        return true
    }

    private static pruneExpiredActions() {
        const now = Date.now()
        for (const [id, pending] of this.pendingActions.entries()) {
            if (pending.expiresAt < now) {
                this.pendingActions.delete(id)
            }
        }
    }
}
