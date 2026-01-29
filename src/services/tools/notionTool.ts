import { useStore } from '../../store'

/**
 * Notion Tool
 * Allows AI to interact with Notion API
 * 
 * Prerequisites: User must have NOTION_API_KEY in settings
 */

// NotionPage interface removed - not currently used

export class NotionTool {
    /**
     * Execute a Notion operation
     * @param operation - The operation to perform (search, get, create)
     * @param args - Operation-specific arguments
     */
    static async execute(operation: string, args: any): Promise<string> {
        try {
            const apiKey = this.getApiKey()
            if (!apiKey) {
                return 'Notion is not configured. Please add your Notion API key in Settings.'
            }

            switch (operation) {
                case 'search':
                    return await this.search(apiKey, args)
                case 'get':
                    return await this.getPage(apiKey, args)
                case 'create':
                    return await this.createPage(apiKey, args)
                default:
                    return `Unknown Notion operation: ${operation}`
            }
        } catch (error) {
            return `Notion error: ${error instanceof Error ? error.message : String(error)}`
        }
    }

    /**
     * Search Notion workspace
     */
    private static async search(apiKey: string, args: any): Promise<string> {
        const query = args.query || args.q

        const response = await fetch('https://api.notion.com/v1/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                filter: { property: 'object', value: 'page' },
                page_size: args.limit || 10
            })
        })

        if (!response.ok) {
            throw new Error(`Notion search failed: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()

        if (!data.results || data.results.length === 0) {
            return JSON.stringify([])
        }

        const cleanPages = data.results.map((page: any) => ({
            id: page.id,
            object: page.object,
            url: page.url,
            last_edited_time: page.last_edited_time,
            title: this.extractTitle(page),
            icon: page.icon
        }))

        return JSON.stringify(cleanPages)
    }

    /**
     * Get a specific Notion page
     */
    private static async getPage(apiKey: string, args: any): Promise<string> {
        const pageId = args.pageId || args.id

        // Note: Skipping page metadata fetch - only need blocks content for RAG indexing

        // Get page content (blocks)
        const blocksResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Notion-Version': '2022-06-28'
            }
        })

        if (!blocksResponse.ok) {
            throw new Error(`Failed to get page content: ${blocksResponse.status}`)
        }

        const blocksData = await blocksResponse.json()
        const content = blocksData.results
            .map((block: any) => this.extractBlockText(block))
            .filter(Boolean)
            .join('\n')

        // Return just the content for processing, or a JSON depending on usage. 
        // For 'get', we usually want the content.
        // But dashboard might want structure. 
        // Given current usage in NotionDashboard uses 'get' for indexing content, passing raw string is fine?
        // Wait, dashboard used 'search' for list. 'get' is used for indexing.
        // If 'get' returns JSON, RAGService needs to handle it. 
        // Let's stick to returning content string for 'get' since it is text-heavy and used for RAG.
        return content || '(Empty page)'
    }

    /**
     * Create a new Notion page
     */
    private static async createPage(apiKey: string, args: any): Promise<string> {
        const title = args.title
        const parentId = args.parentId || args.parent
        const content = args.content || ''

        if (!parentId) {
            return 'Error: parentId is required to create a page. Search for a parent page first.'
        }

        const pageData = {
            parent: { page_id: parentId },
            properties: {
                title: {
                    title: [{ text: { content: title } }]
                }
            },
            children: content ? [
                {
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{ text: { content: content } }]
                    }
                }
            ] : []
        }

        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pageData)
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(`Failed to create page: ${errorData.message || response.statusText}`)
        }

        const data = await response.json()
        return `Page created successfully: "${title}"\nURL: ${data.url}`
    }

    /**
     * Extract title from page object
     */
    private static extractTitle(page: any): string {
        try {
            const titleProp = page.properties?.title || page.properties?.Name
            if (!titleProp) return 'Untitled'

            if (titleProp.title && titleProp.title.length > 0) {
                return titleProp.title[0].plain_text || 'Untitled'
            }
            return 'Untitled'
        } catch {
            return 'Untitled'
        }
    }

    /**
     * Extract text from a block
     */
    private static extractBlockText(block: any): string {
        try {
            const type = block.type
            const content = block[type]

            if (!content || !content.rich_text) return ''

            return content.rich_text
                .map((text: any) => text.plain_text)
                .join('')
        } catch {
            return ''
        }
    }

    /**
     * Get API key from settings
     */
    private static getApiKey(): string | null {
        return useStore.getState().settings.aiSettings.notionApiKey || null
    }
}
