import { useEffect, useState } from 'react'
import { SupabaseService } from '../../services/SupabaseService'
import { Search, Download, Star, Share2, Loader2, User } from 'lucide-react'
import { useStore } from '../../store'



interface Agent {
    id: string
    name: string
    description: string
    author_name: string
    downloads: number
    rating: number
    tags: string[]
    data: any // The full agent blueprint
}

export function AgentStoreView() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('All')
    const [downloading, setDownloading] = useState<string | null>(null)
    const session = useStore(state => state.supabaseSession)
    const addAgent = useStore(state => state.addAgent)

    useEffect(() => {
        fetchAgents()
    }, [])

    const fetchAgents = async () => {
        setLoading(true)
        const { data } = await SupabaseService.getAgents()
        if (data) setAgents(data)
        setLoading(false)
    }

    const handleDownload = async (agent: Agent) => {
        setDownloading(agent.id)
        // Simulate network delay and "installing"
        await new Promise(resolve => setTimeout(resolve, 800))

        // Add to local store
        addAgent({
            ...agent.data,
            id: crypto.randomUUID(), // New ID for local instance
            name: agent.name, // Keep original name
            description: agent.description
        })

        // Increment download count (fire and forget)
        // SupabaseService.incrementDownload(agent.id)

        setDownloading(null)
    }

    const filteredAgents = agents
        .filter(a => filter === 'All' || a.tags.includes(filter))
        .filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase()))

    return (
        <div className="h-full flex flex-col bg-gray-950 text-white overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950/50 backdrop-blur-xl sticky top-0 z-10">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                        Agent Store
                    </h1>
                    <p className="text-gray-400 text-sm">Discover and install community agents</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search agents..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-64 bg-gray-900 border border-gray-800 rounded-full py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        />
                    </div>
                    {session && (
                        <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-full text-sm font-medium transition-colors">
                            <Share2 className="h-4 w-4" />
                            Publish Agent
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="px-6 py-4 flex gap-2 overflow-x-auto border-b border-gray-800/50">
                {['All', 'Productivity', 'Coding', 'Research', 'Writing', 'Data'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === f
                            ? 'bg-white text-black'
                            : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white'
                            }`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                    <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
                    </div>
                ) : filteredAgents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <Search className="h-12 w-12 mb-4 opacity-20" />
                        <p>No agents found matching your criteria</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredAgents.map(agent => (
                            <div key={agent.id} className="group bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-purple-500/30 hover:bg-gray-900 transition-all flex flex-col h-full">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-2xl border border-white/5">
                                        {agent.data.icon || '🤖'}
                                    </div>
                                    <div className="flex items-center gap-1 text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-md text-xs font-medium">
                                        <Star className="h-3 w-3 fill-current" />
                                        {agent.rating.toFixed(1)}
                                    </div>
                                </div>

                                <h3 className="font-semibold text-lg text-white mb-1 group-hover:text-purple-400 transition-colors">
                                    {agent.name}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                                    <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" /> {agent.author_name || 'Anonymous'}
                                    </span>
                                    <span>•</span>
                                    <span>{agent.downloads} downloads</span>
                                </div>

                                <p className="text-sm text-gray-400 mb-4 line-clamp-3 flex-1">
                                    {agent.description}
                                </p>

                                <div className="flex flex-wrap gap-2 mb-4">
                                    {agent.tags.slice(0, 3).map(tag => (
                                        <span key={tag} className="px-2 py-0.5 bg-gray-800 rounded-md text-xs text-gray-400 border border-gray-700">
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                <button
                                    onClick={() => handleDownload(agent)}
                                    disabled={downloading === agent.id}
                                    className="w-full py-2 bg-white text-black hover:bg-gray-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {downloading === agent.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="h-4 w-4" />
                                    )}
                                    {downloading === agent.id ? 'Installing...' : 'Download'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
