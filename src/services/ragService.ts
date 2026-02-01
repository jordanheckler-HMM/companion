import { AISettings, KnowledgeChunk } from '../store'

export class RAGService {
    private settings: AISettings

    constructor(settings: AISettings) {
        this.settings = settings
    }

    /**
     * Chunks text into smaller pieces for indexing
     */
    chunkText(text: string, fileId: string, chunkSize: number = 500, overlap: number = 50): KnowledgeChunk[] {
        const chunks: KnowledgeChunk[] = []
        let currentPos = 0

        while (currentPos < text.length) {
            const endPos = Math.min(currentPos + chunkSize, text.length)
            const chunkContent = text.substring(currentPos, endPos)

            chunks.push({
                id: `${fileId}-${chunks.length}`,
                fileId,
                content: chunkContent
            })

            currentPos += (chunkSize - overlap)
        }

        return chunks
    }

    /**
     * Helper to generate a single embedding for a string
     */
    async generateEmbedding(text: string): Promise<number[] | undefined> {
        const results = await this.generateEmbeddings([{ content: text, fileId: 'temp', id: 'temp' }])
        return results[0]?.embedding
    }

    /**
     * Generates embeddings for a list of chunks using Ollama
     */
    async generateEmbeddings(chunks: KnowledgeChunk[]): Promise<KnowledgeChunk[]> {
        if (this.settings.intelligenceMode === 'cloud') {
            return await this.generateCloudEmbeddings(chunks)
        }


        const enrichedChunks = [...chunks]

        for (let i = 0; i < enrichedChunks.length; i++) {
            try {
                const response = await fetch(`${this.settings.ollamaUrl}/api/embeddings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: this.settings.ollamaEmbeddingModel || 'nomic-embed-text',
                        prompt: enrichedChunks[i].content
                    })
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    throw new Error(`Ollama embedding error (${response.status}): ${errorText}`)
                }

                const data = await response.json()
                if (!data.embedding) {
                    throw new Error('Ollama returned success but no embedding vector was found. Check your model.')
                }
                enrichedChunks[i].embedding = data.embedding
            } catch (error: any) {
                console.error('Error generating embedding for chunk:', error)
                throw new Error(`Failed to generate embeddings: ${error.message}. Make sure Ollama is running and you have run 'ollama pull nomic-embed-text'`)
            }
        }

        return enrichedChunks
    }

    /**
     * Generates embeddings using OpenAI (Cloud).
     * Always uses OpenAI for embeddings even if main provider is Anthropic/Google,
     * since they don't offer embedding APIs.
     */
    async generateCloudEmbeddings(chunks: KnowledgeChunk[]): Promise<KnowledgeChunk[]> {
        // Always use OpenAI API key for embeddings (Anthropic/Google don't have embedding APIs)
        const apiKey = this.settings.openaiApiKey || this.settings.apiKey
        if (!apiKey) {
            console.warn('[RAGService] No OpenAI API key available for cloud embeddings')
            return chunks
        }

        const enrichedChunks = [...chunks]

        // Process in batches of 10 to avoid rate limits/payload size issues
        const batchSize = 10
        for (let i = 0; i < enrichedChunks.length; i += batchSize) {
            const batch = enrichedChunks.slice(i, i + batchSize)
            try {
                // Use text-embedding-3-small for best cost/performance ratio
                const response = await fetch('https://api.openai.com/v1/embeddings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'text-embedding-3-small',
                        input: batch.map(c => c.content)
                    })
                })

                if (response.ok) {
                    const data = await response.json()
                    data.data.forEach((item: any, index: number) => {
                        if (batch[index]) {
                            batch[index].embedding = item.embedding
                        }
                    })
                } else {
                    console.error('OpenAI embedding error:', await response.text())
                }
            } catch (error) {
                console.error('Error generating cloud embedding:', error)
            }
        }

        return enrichedChunks
    }

    /**
     * Computes cosine similarity between two vectors
     */
    cosineSimilarity(vecA: number[], vecB: number[]): number {
        let dotProduct = 0
        let normA = 0
        let normB = 0
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i]
            normA += vecA[i] * vecA[i]
            normB += vecB[i] * vecB[i]
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
    }

    /**
     * Searches for the most relevant chunks based on a query
     */
    async search(query: string, knowledgeBase: KnowledgeChunk[], limit: number = 3): Promise<KnowledgeChunk[]> {
        if (knowledgeBase.length === 0) return []

        try {
            // Generate embedding for the query
            let queryEmbedding: number[] | undefined

            if (this.settings.intelligenceMode === 'local') {
                const response = await fetch(`${this.settings.ollamaUrl}/api/embeddings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: this.settings.ollamaEmbeddingModel || 'nomic-embed-text',
                        prompt: query
                    })
                })
                if (response.ok) {
                    const data = await response.json()
                    queryEmbedding = data.embedding
                }
            } else {
                // Cloud mode query embedding
                try {
                    const embeddings = await this.generateCloudEmbeddings([{ content: query } as any])
                    if (embeddings.length > 0) {
                        queryEmbedding = embeddings[0].embedding
                    }
                } catch (e) {
                    console.error('Failed to generate cloud embedding for query', e)
                }
            }

            if (!queryEmbedding) {
                // Fallback to simple keyword search if embeddings fail
                return knowledgeBase
                    .filter(chunk => chunk.content.toLowerCase().includes(query.toLowerCase()))
                    .slice(0, limit)
            }

            // Calculate similarities
            const matches = knowledgeBase
                .filter(chunk => chunk.embedding)
                .map(chunk => ({
                    chunk,
                    score: this.cosineSimilarity(queryEmbedding!, chunk.embedding!)
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, limit)
                .map(match => match.chunk)

            return matches
        } catch (error) {
            console.error('Search error:', error)
            return []
        }
    }
}
