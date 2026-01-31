import { fetch } from '@tauri-apps/plugin-http'

export class WebSearchTool {
    static async search(query: string): Promise<string> {
        try {
            console.log(`WebSearchTool: Searching for "${query}"`)
            // Use DuckDuckGo HTML endpoint (no API key)
            const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                connectTimeout: 10000,
            })

            if (!response.ok) {
                return `Search failed: HTTP ${response.status} ${response.statusText}. This might be due to a temporary block or network issue.`
            }

            const html = await response.text()

            // Check if we hit a bot detection page or captcha
            if (html.includes('did not match any documents') || html.includes('no results')) {
                return "No search results found for this query on DuckDuckGo."
            }

            const parser = new DOMParser()
            const doc = parser.parseFromString(html, 'text/html')

            let results: { title: string, url: string, snippet: string }[] = []

            // Strategy 1: Standard Selectors
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

            // Strategy 2: Fallback to generic link parsing if Strategy 1 found nothing
            // Look for any links that point to DDG redirection service
            if (results.length === 0) {
                const links = Array.from(doc.querySelectorAll('a[href*="/l/?uddg="]'))
                for (const link of links) {
                    if (results.length >= 5) break
                    const extractedUrl = this.extractUrl(link.getAttribute('href'))
                    // Try to find context for the snippet
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

            if (results.length === 0) {
                return "Search engine structure has changed. Found potential results but could not parse details. Please try again later."
            }

            return results.map((r, i) => `Result ${i + 1}:\nTitle: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n')
        } catch (error) {
            return `Search Error: ${error instanceof Error ? error.message : String(error)}`
        }
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
