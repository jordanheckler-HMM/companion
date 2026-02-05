import { fetch } from '@tauri-apps/plugin-http'

export class WebSearchTool {
    static async search(query: string): Promise<string> {
        try {
            console.log(`WebSearchTool: Searching for "${query}"`)
            const encodedQuery = encodeURIComponent(query)
            const endpoints = [
                `https://html.duckduckgo.com/html/?q=${encodedQuery}`,
                `https://duckduckgo.com/html/?q=${encodedQuery}`,
                `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`,
                `https://duckduckgo.com/lite/?q=${encodedQuery}`
            ]

            let lastError = ''

            for (const url of endpoints) {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://duckduckgo.com/',
                    },
                    connectTimeout: 10000,
                })

                if (!response.ok) {
                    lastError = `Search failed: HTTP ${response.status} ${response.statusText}`
                    // 403 is common on one endpoint; try fallbacks
                    if (response.status === 403) continue
                    continue
                }

                const html = await response.text()

                if (this.isNoResults(html)) {
                    return "No search results found for this query on DuckDuckGo."
                }

                const results = this.parseResults(html)
                if (results.length > 0) {
                    return results.map((r, i) => `Result ${i + 1}:\nTitle: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n')
                }
            }

            if (lastError.includes('403')) {
                return "Search failed: DuckDuckGo blocked the request (HTTP 403). Please try again later or configure a different search provider."
            }

            return lastError || "Search engine structure has changed. Found potential results but could not parse details. Please try again later."
        } catch (error) {
            return `Search Error: ${error instanceof Error ? error.message : String(error)}`
        }
    }

    private static isNoResults(html: string): boolean {
        const normalized = html.toLowerCase()
        return normalized.includes('did not match any documents') ||
            normalized.includes('no results') ||
            normalized.includes('no results found')
    }

    private static parseResults(html: string): { title: string, url: string, snippet: string }[] {
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        const results: { title: string, url: string, snippet: string }[] = []

        // Strategy 1: Standard DuckDuckGo HTML selectors
        const resultBlocks = Array.from(doc.querySelectorAll('.result__body, .result'))
        for (const block of resultBlocks) {
            if (results.length >= 5) break
            const titleEl = block.querySelector('.result__a')
            const snippetEl = block.querySelector('.result__snippet')

            if (titleEl) {
                const extractedUrl = this.extractUrl(titleEl.getAttribute('href'))
                if (extractedUrl) {
                    results.push({
                        title: titleEl.textContent?.trim() || 'No Title',
                        url: extractedUrl,
                        snippet: snippetEl?.textContent?.trim() || 'No preview available.'
                    })
                }
            }
        }

        // Strategy 2: DuckDuckGo Lite selectors
        if (results.length === 0) {
            const liteLinks = Array.from(doc.querySelectorAll('a.result-link'))
            for (const link of liteLinks) {
                if (results.length >= 5) break
                const extractedUrl = this.extractUrl(link.getAttribute('href'))
                const row = link.closest('tr') || link.parentElement
                const snippet = row?.querySelector('.result-snippet')?.textContent?.trim() || 'No preview available.'

                if (extractedUrl && !results.some(r => r.url === extractedUrl)) {
                    results.push({
                        title: link.textContent?.trim() || 'No Title',
                        url: extractedUrl,
                        snippet: snippet.substring(0, 150) + (snippet.length > 150 ? '...' : '')
                    })
                }
            }
        }

        // Strategy 3: Fallback to generic link parsing if previous strategies found nothing
        if (results.length === 0) {
            const links = Array.from(doc.querySelectorAll('a[href*="/l/?uddg="]'))
            for (const link of links) {
                if (results.length >= 5) break
                const extractedUrl = this.extractUrl(link.getAttribute('href'))
                const parent = link.parentElement
                const snippet = parent?.nextElementSibling?.textContent?.trim() ||
                    parent?.parentElement?.textContent?.trim() ||
                    'No preview available.'

                if (extractedUrl && !results.some(r => r.url === extractedUrl)) {
                    results.push({
                        title: link.textContent?.trim() || 'No Title',
                        url: extractedUrl,
                        snippet: snippet.substring(0, 150) + '...'
                    })
                }
            }
        }

        return results
    }

    private static extractUrl(rawUrl: string | null): string | null {
        if (!rawUrl) return null
        let url = rawUrl
        // Handle DDG redirects
        if (url.includes('uddg=')) {
            try {
                const encodedUrl = url.split('uddg=')[1].split('&')[0]
                url = decodeURIComponent(encodedUrl)
            } catch (e) {
                // keep original url if decode fails
            }
        } else if (url.startsWith('//')) {
            url = 'https:' + url
        }
        return url
    }
}
