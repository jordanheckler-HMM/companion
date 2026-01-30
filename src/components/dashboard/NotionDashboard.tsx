import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { ToolService } from '@/services/toolService'
import { RAGService } from '@/services/ragService'
import { open as openUrl } from '@tauri-apps/plugin-shell'
import { Loader2, FileText, Database, ArrowRight, Download, Check, ExternalLink } from 'lucide-react'

// Simplified Notion Object interface
interface NotionObject {
    id: string
    object: 'page' | 'database'
    url: string
    last_edited_time: string
    properties?: Record<string, any>
    icon?: { type: string, emoji?: string, external?: { url: string } }
    title?: { plain_text: string }[] // For databases
}

// Helper to extract title from Notion page/database
const getTitle = (obj: NotionObject): string => {
    if (obj.object === 'database' && obj.title && obj.title.length > 0) {
        return obj.title[0].plain_text
    }

    if (obj.object === 'page' && obj.properties) {
        // Try to find a title property. Usually 'Name' or 'title'
        const titleProp = Object.values(obj.properties).find((p: any) => p.id === 'title')
        if (titleProp && titleProp.title && titleProp.title.length > 0) {
            return titleProp.title[0].plain_text
        }
    }

    return 'Untitled'
}

export function NotionDashboard() {
    const { settings, addMessage, setCurrentView, addKnowledgeChunks, updateMessage, addPendingContext } = useStore()
    const [items, setItems] = useState<NotionObject[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [indexingId, setIndexingId] = useState<string | null>(null)
    const [indexedIds, setIndexedIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        const fetchNotion = async () => {
            if (!settings.aiSettings.notionApiKey) return

            setLoading(true)
            try {
                // Search for recently edited pages/databases
                const response = await ToolService.executeTool('notion', {
                    operation: 'search',
                    query: ''
                })

                // Check if the response is an error message (not JSON)
                const resultStr = response.result || ''
                if (resultStr.startsWith('Notion error:') || resultStr.startsWith('Notion is not configured')) {
                    setError(resultStr)
                    return
                }

                let data: any = {}
                try {
                    data = JSON.parse(resultStr)
                } catch {
                    console.warn("Could not parse Notion data", resultStr)
                    setError(resultStr || "Received unstructured data.")
                    return
                }

                // Notion Search API returns { results: [...] }
                if (data.results && Array.isArray(data.results)) {
                    setItems(data.results)
                } else if (Array.isArray(data)) {
                    // Some tool implementations might return the array directly
                    setItems(data)
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch Notion content')
            } finally {
                setLoading(false)
            }
        }

        fetchNotion()
    }, [settings.aiSettings.notionApiKey])

    const handleIndexPage = async (e: React.MouseEvent, item: NotionObject) => {
        e.preventDefault() // Prevent navigation
        e.stopPropagation()

        if (indexingId) return

        setIndexingId(item.id)
        const toastId = addMessage({ role: 'assistant', content: `Indexing Notion page: **${getTitle(item)}**...`, status: 'thinking' })

        try {
            // 1. Fetch full page content
            const response = await ToolService.executeTool('notion', {
                operation: 'get',
                pageId: item.id
            })

            // 2. Parse content (The 'get' operation returns a string representation)
            const content = response.result

            // 3. Process into Knowledge Base (RAG)
            const ragService = new RAGService(settings.aiSettings)
            const pageTitle = getTitle(item).replace(/[^a-zA-Z0-9\s-]/g, '').trim() || 'Untitled'
            const chunks = ragService.chunkText(content, `notion-${pageTitle}`)

            const enrichedChunks = await ragService.generateEmbeddings(chunks)
            addKnowledgeChunks(enrichedChunks)

            setIndexedIds(prev => new Set(prev).add(item.id))
            updateMessage(toastId, `Successfully indexed Notion page: **${getTitle(item)}**. It is now available for chat context.`, 'done')

        } catch (err) {
            console.error('Indexing error', err)
            updateMessage(toastId, `Failed to index Notion page: ${err instanceof Error ? err.message : String(err)}`, 'error')
        } finally {
            setIndexingId(null)
        }
    }

    if (!settings.aiSettings.notionApiKey) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="glass-card p-8 rounded-xl max-w-md">
                    <h2 className="text-2xl font-bold mb-4">Connect Notion</h2>
                    <p className="text-muted-foreground mb-6">
                        Connect your workspace to access your notes, docs, and databases.
                    </p>
                    <button
                        onClick={() => setCurrentView('integrations')}
                        className="glass-strong px-6 py-3 rounded-lg font-medium"
                    >
                        Go to Integrations
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col">
            <div className="glass-light border-b border-white/10 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <span className="text-2xl">📝</span> Notion
                    </h2>
                    <p className="text-sm text-muted-foreground">Recent pages and databases</p>
                </div>
                <button
                    onClick={() => {
                        addPendingContext({
                            type: 'ai_prompt',
                            title: '🔍 Search Notion',
                            prompt: 'Search my Notion for [topic]',
                            metadata: { source: 'notion' }
                        })
                        setCurrentView('home')
                    }}
                    className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full transition-colors"
                >
                    Search with AI
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="glass-card p-6 rounded-xl text-center">
                        <p className="text-red-400">Error loading Notion data</p>
                        <p className="text-xs text-muted-foreground">{error}</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center text-muted-foreground py-10">No recent items found.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map((item) => {
                            const isIndexed = indexedIds.has(item.id)
                            const isIndexing = indexingId === item.id

                            return (
                                <div
                                    key={item.id}
                                    className="glass-card p-4 rounded-xl hover:bg-white/5 transition-all group flex flex-col h-full relative cursor-pointer"
                                    onClick={() => openUrl(item.url)}
                                >
                                    <div className="absolute top-4 right-4 z-20 flex gap-1">
                                        <button
                                            onClick={(e) => handleIndexPage(e, item)}
                                            disabled={isIndexing || isIndexed}
                                            className={`p-1.5 rounded-md transition-colors ${isIndexed
                                                ? 'bg-green-500/20 text-green-400'
                                                : isIndexing
                                                    ? 'bg-blue-500/20 text-blue-400'
                                                    : 'bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground'
                                                }`}
                                            title="Index into Knowledge Base"
                                        >
                                            {isIndexing ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : isIndexed ? (
                                                <Check className="h-4 w-4" />
                                            ) : (
                                                <Download className="h-4 w-4" />
                                            )}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                openUrl(item.url)
                                            }}
                                            className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                                            title="Open in Notion"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div className="flex items-start gap-3 mb-2 pr-16">
                                        <div className="mt-0.5 text-xl">
                                            {item.icon?.emoji ? item.icon.emoji : (
                                                item.object === 'database' ? <Database className="h-5 w-5 text-blue-400" /> : <FileText className="h-5 w-5 text-gray-400" />
                                            )}
                                        </div>
                                        <h3 className="font-medium flex-1 line-clamp-2 leading-tight">
                                            {getTitle(item)}
                                        </h3>
                                    </div>

                                    <div className="mt-auto pt-4 flex items-center justify-between text-xs text-muted-foreground">
                                        <span>
                                            Edited {new Date(item.last_edited_time).toLocaleDateString()}
                                        </span>
                                        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
