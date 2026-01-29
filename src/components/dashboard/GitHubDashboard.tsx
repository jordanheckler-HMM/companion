import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { ToolService } from '@/services/toolService'
import { RAGService } from '@/services/ragService'
import { Loader2, GitFork, Star, Circle, ExternalLink, Check, FileText } from 'lucide-react'

interface Repo {
    name: string
    full_name: string
    description: string
    html_url: string
    stargazers_count: number
    forks_count: number
    language: string
    updated_at: string
}

export function GitHubDashboard() {
    const { settings, addMessage, setCurrentView, addKnowledgeChunks, updateMessage } = useStore()
    const [repos, setRepos] = useState<Repo[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [indexingRepo, setIndexingRepo] = useState<string | null>(null)
    const [indexedRepos, setIndexedRepos] = useState<Set<string>>(new Set())

    useEffect(() => {
        const fetchRepos = async () => {
            if (!settings.aiSettings.githubApiKey) return

            setLoading(true)
            try {
                // Use the generic tool service to fetch data
                const response = await ToolService.executeTool('github', { operation: 'repos' })

                let data: Repo[] = []
                try {
                    data = JSON.parse(response.result)
                } catch (e) {
                    console.error("Failed to parse GitHub response", response.result)
                    setError("Failed to parse GitHub data")
                }

                if (Array.isArray(data)) {
                    setRepos(data)
                } else {
                    setError("Unexpected response format")
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch repositories')
            } finally {
                setLoading(false)
            }
        }

        fetchRepos()
    }, [settings.aiSettings.githubApiKey])

    const handleAskAI = (repo: Repo) => {
        addMessage({
            role: 'user',
            content: `Tell me about the repository ${repo.full_name}`
        })
        setCurrentView('home')
    }

    const handleIndexReadme = async (e: React.MouseEvent, repo: Repo) => {
        e.preventDefault()
        e.stopPropagation()

        if (indexingRepo) return

        setIndexingRepo(repo.full_name)
        const toastId = addMessage({ role: 'assistant', content: `Indexing README for **${repo.full_name}**...`, status: 'thinking' })

        try {
            // 1. Fetch README content
            const response = await ToolService.executeTool('github', {
                operation: 'get_file',
                repo: repo.full_name,
                path: 'README.md'
            })

            if (response.isError || response.result.startsWith('Error:')) {
                throw new Error(response.result)
            }

            // 2. Process into Knowledge Base (RAG)
            const ragService = new RAGService(settings.aiSettings)
            const chunks = ragService.chunkText(response.result, `github-${repo.full_name}-readme`)

            const enrichedChunks = await ragService.generateEmbeddings(chunks)
            addKnowledgeChunks(enrichedChunks)

            setIndexedRepos(prev => new Set(prev).add(repo.full_name))
            updateMessage(toastId, `Successfully indexed README for **${repo.full_name}**. You can now ask questions about it.`, 'done')

        } catch (err) {
            console.error('Indexing error', err)
            updateMessage(toastId, `Failed to index README: ${err instanceof Error ? err.message : String(err)}`, 'error')
        } finally {
            setIndexingRepo(null)
        }
    }

    if (!settings.aiSettings.githubApiKey) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="glass-card p-8 rounded-xl max-w-md">
                    <h2 className="text-2xl font-bold mb-4">Connect GitHub</h2>
                    <p className="text-muted-foreground mb-6">
                        Connect your GitHub account to access your repositories and issues directly within Companion.
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
                        <span className="text-2xl">📦</span> GitHub Repositories
                    </h2>
                    <p className="text-sm text-muted-foreground">Your recent activity</p>
                </div>
                <button
                    onClick={() => {
                        addMessage({ role: 'user', content: "Summarize my recent GitHub activity across all my repos" })
                        setCurrentView('home')
                    }}
                    className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full transition-colors"
                >
                    Analyze Activity
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="text-red-400 text-center p-8">
                        <p>Error: {error}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {repos.map((repo) => {
                            const isIndexed = indexedRepos.has(repo.full_name)
                            const isIndexing = indexingRepo === repo.full_name

                            return (
                                <div key={repo.full_name} className="glass-card p-4 rounded-xl flex flex-col h-full hover:bg-white/5 transition-colors group relative">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-semibold truncate pr-8" title={repo.name}>
                                            {repo.name}
                                        </h3>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => handleIndexReadme(e, repo)}
                                                disabled={isIndexing || isIndexed}
                                                className={`p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100 ${isIndexed
                                                    ? 'bg-green-500/20 text-green-400 opacity-100'
                                                    : isIndexing
                                                        ? 'bg-blue-500/20 text-blue-400 opacity-100'
                                                        : 'bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground'
                                                    }`}
                                                title="Index README into Knowledge Base"
                                            >
                                                {isIndexing ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : isIndexed ? (
                                                    <Check className="h-3 w-3" />
                                                ) : (
                                                    <FileText className="h-3 w-3" />
                                                )}
                                            </button>
                                            <a
                                                href={repo.html_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-1.5"
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </div>
                                    </div>

                                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2 h-10">
                                        {repo.description || 'No description provided'}
                                    </p>

                                    <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                                        <div className="flex items-center gap-3">
                                            {repo.language && (
                                                <span className="flex items-center gap-1">
                                                    <Circle className="h-2 w-2 fill-current" />
                                                    {repo.language}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Star className="h-3 w-3" />
                                                {repo.stargazers_count}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <GitFork className="h-3 w-3" />
                                                {repo.forks_count}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="absolute top-12 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleAskAI(repo)}
                                            className="bg-primary/20 hover:bg-primary/30 text-primary-foreground text-xs px-2 py-1 rounded"
                                        >
                                            Chat
                                        </button>
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
