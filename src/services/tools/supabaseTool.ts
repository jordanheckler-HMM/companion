import { createClient } from '@supabase/supabase-js'
import { useStore } from '../../store'

export class SupabaseTool {
    /**
     * Execute a Supabase operation on the user's BYOK project
     */
    async execute(operation: string, args: any): Promise<string> {
        const settings = useStore.getState().settings.aiSettings
        const { supabaseUrl, supabaseKey } = settings.toolsEnabled?.supabase || {}

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase tools are enabled but credentials (URL & Key) are missing in settings.')
        }

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
                    return await this.runQuery(client, args.table, args.query)
                case 'insert':
                    return await this.insertRow(client, args.table, args.data)
                case 'update':
                    return await this.updateRow(client, args.table, args.id, args.data)
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

    private async runQuery(client: any, table: string, query: any) {
        // query here implies a JSON-like object describing the select/filter
        // e.g. { select: '*', eq: { status: 'active' }, limit: 10 }

        let builder = client.from(table).select(query.select || '*')

        if (query.eq) {
            Object.entries(query.eq).forEach(([col, val]) => {
                builder = builder.eq(col as string, val)
            })
        }

        if (query.limit) {
            builder = builder.limit(query.limit)
        }

        if (query.order) {
            builder = builder.order(query.order.column, { ascending: query.order.ascending })
        }

        const { data, error } = await builder
        if (error) throw error
        return JSON.stringify(data, null, 2)
    }

    private async insertRow(client: any, table: string, data: any) {
        const { data: result, error } = await client.from(table).insert(data).select()
        if (error) throw error
        return JSON.stringify(result, null, 2)
    }

    private async updateRow(client: any, table: string, id: string, data: any) {
        const { data: result, error } = await client.from(table).update(data).eq('id', id).select()
        if (error) throw error
        return JSON.stringify(result, null, 2)
    }
}
