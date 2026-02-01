import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useStore } from '@/store'
import { Database, Search, Table as TableIcon, RefreshCw, Eye, FileText, Play, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { message } from '@tauri-apps/plugin-dialog'
import { ToolService } from '@/services/toolService'
import { RAGService } from '@/services/ragService'
import { VaultService } from '@/services/VaultService'

interface TableInfo {
    name: string
    rowCount: string
    preview?: any[]
}

export function SupabaseDashboard() {
    const { settings, updateSettings, setCurrentView, addKnowledgeChunks, removeKnowledgeChunksByFileId, addConnectedApp, removeConnectedApp, connectedApps } = useStore()
    const [url, setUrl] = useState('')
    const [isConnected, setIsConnected] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [tables, setTables] = useState<TableInfo[]>([])
    const [activeTable, setActiveTable] = useState<string | null>(null)
    const [previewData, setPreviewData] = useState<any[] | null>(null)
    const [indexingTable, setIndexingTable] = useState<string | null>(null)
    const [newTableName, setNewTableName] = useState('')
    const [showAddTable, setShowAddTable] = useState(false)

    useEffect(() => {
        const supabaseSettings = settings.aiSettings.toolsEnabled?.supabase
        if (supabaseSettings?.supabaseUrl && supabaseSettings?.supabaseKey) {
            setUrl(supabaseSettings.supabaseUrl)
            if (supabaseSettings.enabled) {
                checkConnection(supabaseSettings.supabaseUrl, supabaseSettings.supabaseKey)
            }
        }
    }, [])

    const checkConnection = async (testUrl: string, testKey: string) => {
        setIsLoading(true)
        try {
            const client = createClient(testUrl, testKey)
            const { error } = await client.from('_test_connection_').select('*').limit(1)

            if (error && (error.message.includes('JWT') || error.code === 'PGRST301')) {
                throw new Error('Invalid Credentials')
            }

            setIsConnected(true)
            if (!connectedApps.includes('Supabase')) {
                addConnectedApp('Supabase')
            }
            fetchTables()
        } catch (err) {
            console.error('Connection check failed:', err)
            setIsConnected(false)
            if (connectedApps.includes('Supabase')) {
                removeConnectedApp('Supabase')
            }
        } finally {
            setIsLoading(false)
        }
    }

    const fetchTables = async () => {
        try {
            const result = await ToolService.executeTool('supabase', { operation: 'get_tables' })
            if (result.isError) throw new Error(result.result)

            const tableNames: string[] = JSON.parse(result.result)

            // Allow failing on individual counts without failing entire load
            const loadedTables: TableInfo[] = []

            for (const name of tableNames) {
                try {
                    const countResult = await ToolService.executeTool('supabase', { operation: 'count_rows', table: name })
                    loadedTables.push({
                        name,
                        rowCount: countResult.isError ? '?' : countResult.result
                    })
                } catch (e) {
                    loadedTables.push({ name, rowCount: '?' })
                }
            }

            setTables(loadedTables)
        } catch (err) {
            console.error('Failed to fetch tables:', err)
        }
    }

    const handlePreview = async (tableName: string) => {
        if (activeTable === tableName && previewData) {
            setActiveTable(null)
            setPreviewData(null)
            return
        }

        setActiveTable(tableName)
        try {
            const result = await ToolService.executeTool('supabase', { operation: 'get_sample_rows', table: tableName, limit: 5 })
            if (!result.isError) {
                setPreviewData(JSON.parse(result.result))
            }
        } catch (err) {
            console.error('Failed to preview table:', err)
        }
    }

    const handleIndexTable = async (e: React.MouseEvent, tableName: string) => {
        e.stopPropagation()
        setIndexingTable(tableName)
        try {
            // Get a larger sample for indexing context
            const result = await ToolService.executeTool('supabase', { operation: 'get_sample_rows', table: tableName, limit: 20 })
            const content = `Table Structure and Sample Data for '${tableName}':\n${result.result}`

            const ragService = new RAGService(settings.aiSettings)
            const chunks = ragService.chunkText(content, `supabase-${tableName}`)
            const enrichedChunks = await ragService.generateEmbeddings(chunks)

            // Clear existing chunks for this table to prevent duplicates
            await removeKnowledgeChunksByFileId(`supabase-${tableName}`)
            await addKnowledgeChunks(enrichedChunks)

            // Also save a file to the physical vault folder for user visibility
            try {
                await VaultService.writeToVault(
                    `Supabase/${tableName}.md`,
                    `# Supabase Table: ${tableName}\n\nIndexed on: ${new Date().toLocaleString()}\n\n${content}`,
                    'overwrite'
                )
            } catch (vErr) {
                console.warn('[SupabaseDashboard] Failed to write to vault file, but memory index succeeded', vErr)
            }

            await message(`Successfully indexed ${tableName} into Vault Knowledge Base and created reference file.`, { title: 'Indexing Complete', kind: 'info' })
        } catch (err: any) {
            await message(`Failed to index table: ${err.message}`, { title: 'Error', kind: 'error' })
        } finally {
            setIndexingTable(null)
        }
    }

    const handleAddTable = async () => {
        if (!newTableName.trim()) return
        const tableName = newTableName.trim()

        // Check if table already exists in our list
        if (tables.some(t => t.name === tableName)) {
            setNewTableName('')
            setShowAddTable(false)
            return
        }

        // Try to get row count to verify table exists
        try {
            const countResult = await ToolService.executeTool('supabase', { operation: 'count_rows', table: tableName })
            const newTable: TableInfo = {
                name: tableName,
                rowCount: countResult.isError ? '?' : countResult.result
            }
            setTables(prev => [...prev, newTable])
            setNewTableName('')
            setShowAddTable(false)
        } catch (err) {
            // Table might not exist or no access - still add it with unknown count
            setTables(prev => [...prev, { name: tableName, rowCount: '?' }])
            setNewTableName('')
            setShowAddTable(false)
        }
    }

    const handleRemoveTable = (tableName: string) => {
        setTables(prev => prev.filter(t => t.name !== tableName))
        if (activeTable === tableName) {
            setActiveTable(null)
            setPreviewData(null)
        }
    }

    const handleQueryAI = (tableName?: string) => {
        const { addPendingContext } = useStore.getState()

        // We use pending context to "stage" the table as a context attachment
        addPendingContext({
            type: 'supabase_table',
            title: tableName ? `Table: ${tableName}` : 'All Tables',
            metadata: {
                tableName,
                query: tableName
                    ? `Analyze the '${tableName}' table in my Supabase project. What insights can you find?`
                    : "Analyze my connected Supabase database tables."
            }
        })

        setCurrentView('home')
    }

    if (!isConnected) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-background/50">
                <div className="max-w-md space-y-6">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Database className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold">Connect Supabase</h2>
                    <p className="text-muted-foreground">
                        Configure your project in Settings &gt; Integration Keys to enable database access.
                    </p>
                    <Button
                        onClick={() => updateSettings({ ...settings, /* trigger config modal? or just direct to settings */ })} // Ideally we redirect to settings, but for now just a message
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        Go to Settings
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col bg-background/50 relative overflow-y-auto">
            {/* Header */}
            <div className="glass-theme border-b border-white/10 px-8 py-8 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <Database className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-1">Supabase</h1>
                        <p className="text-sm text-emerald-400/80 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Connected to {new URL(url).hostname}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={() => handleQueryAI()}
                        className="bg-primary-accent hover:opacity-90 text-white shadow-lg shadow-primary-accent/20"
                    >
                        <Search className="w-4 h-4 mr-2" />
                        Query Database with AI
                    </Button>
                </div>
            </div>

            <div className="p-8 max-w-6xl mx-auto w-full space-y-8">

                {/* Tables Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tables.map((table) => (
                        <div key={table.name} className="glass-card group hover:border-emerald-500/30 transition-all duration-300">
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors">
                                            <TableIcon className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-lg">{table.name}</h3>
                                            <p className="text-xs text-muted-foreground">{table.rowCount} rows</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-emerald-400"
                                            onClick={() => handleQueryAI(table.name)}
                                            title="Query with AI"
                                        >
                                            <Play className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-red-400"
                                            onClick={() => handleRemoveTable(table.name)}
                                            title="Remove table"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="w-full text-xs bg-white/5 hover:bg-white/10"
                                        onClick={() => handlePreview(table.name)}
                                    >
                                        <Eye className="w-3 h-3 mr-2" />
                                        {activeTable === table.name ? 'Hide Data' : 'Preview'}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="w-full text-xs bg-white/5 hover:bg-white/10"
                                        onClick={(e) => handleIndexTable(e, table.name)}
                                        disabled={indexingTable === table.name}
                                    >
                                        {indexingTable === table.name ? (
                                            <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                                        ) : (
                                            <FileText className="w-3 h-3 mr-2" />
                                        )}
                                        Index
                                    </Button>
                                </div>
                            </div>

                            {/* Preview Section - Expands when active */}
                            {activeTable === table.name && previewData && (
                                <div className="border-t border-white/5 bg-black/20 p-4 animate-in slide-in-from-top-2 overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="text-muted-foreground border-b border-white/5">
                                            <tr>
                                                {Object.keys(previewData[0] || {}).slice(0, 4).map(key => (
                                                    <th key={key} className="pb-2 pr-4 font-medium">{key}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.map((row, i) => (
                                                <tr key={i} className="border-b border-white/5 last:border-0">
                                                    {Object.keys(row).slice(0, 4).map(key => (
                                                        <td key={key} className="py-2 pr-4 text-foreground/80 truncate max-w-[100px]">
                                                            {typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key])}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <p className="text-[10px] text-muted-foreground mt-2 italic">Showing first 5 rows</p>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Add Table Card */}
                    <div className="glass-card border-dashed border-2 border-white/10 hover:border-emerald-500/30 transition-all duration-300 flex flex-col items-center justify-center p-6 min-h-[160px]">
                        {showAddTable ? (
                            <div className="w-full space-y-3">
                                <input
                                    type="text"
                                    value={newTableName}
                                    onChange={(e) => setNewTableName(e.target.value)}
                                    placeholder="Enter table name..."
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddTable()}
                                />
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleAddTable}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                                        size="sm"
                                    >
                                        <Plus className="w-3 h-3 mr-1" /> Add
                                    </Button>
                                    <Button
                                        onClick={() => { setShowAddTable(false); setNewTableName('') }}
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs"
                                    >
                                        <X className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowAddTable(true)}
                                className="flex flex-col items-center gap-2 text-muted-foreground hover:text-emerald-400 transition-colors"
                            >
                                <Plus className="w-8 h-8" />
                                <span className="text-sm font-medium">Add Table</span>
                            </button>
                        )}
                    </div>
                </div>

                {tables.length === 0 && !isLoading && (
                    <div className="text-center py-10 space-y-4">
                        <p className="text-sm text-muted-foreground">Add your table names above to get started.</p>
                        <div className="flex flex-wrap justify-center gap-2">
                            <span className="text-xs text-muted-foreground/70">Try common names:</span>
                            {['users', 'profiles', 'posts', 'products', 'orders', 'messages'].map(name => (
                                <button
                                    key={name}
                                    onClick={() => {
                                        setNewTableName(name)
                                        setShowAddTable(true)
                                    }}
                                    className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors"
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground/50">
                            Supabase's REST API doesn't expose table schema - enter your table names manually
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
