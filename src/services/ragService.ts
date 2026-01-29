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
     * Generates embeddings for a list of chunks using Ollama
     */
    async generateEmbeddings(chunks: KnowledgeChunk[]): Promise<KnowledgeChunk[]> {
        if (this.settings.providerType !== 'local') {
            // Future-proofing: Add OpenAI/Anthropic embedding support later
            // For now, we'll focus on the user's local Ollama setup
            return chunks
        }

        const enrichedChunks = [...chunks]

        for (let i = 0; i < enrichedChunks.length; i++) {
            try {
                const response = await fetch(`${this.settings.ollamaUrl}/api/embeddings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: this.settings.ollamaModel, // Using the same model for embeddings
                        prompt: enrichedChunks[i].content
                    })
                })

                if (response.ok) {
                    const data = await response.json()
                    enrichedChunks[i].embedding = data.embedding
                }
            } catch (error) {
                console.error('Error generating embedding for chunk:', error)
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

            if (this.settings.providerType === 'local') {
                const response = await fetch(`${this.settings.ollamaUrl}/api/embeddings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: this.settings.ollamaModel,
                        prompt: query
                    })
                })
                if (response.ok) {
                    const data = await response.json()
                    queryEmbedding = data.embedding
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
