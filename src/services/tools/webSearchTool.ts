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

            // DDG HTML structure can vary. Let's try multiple selectors.
            let resultBlocks = Array.from(doc.querySelectorAll('.result__body'))

            // Fallback to simpler selector if first one fails
            if (resultBlocks.length === 0) {
                resultBlocks = Array.from(doc.querySelectorAll('.result'))
            }

            const results: { title: string, url: string, snippet: string }[] = []

            for (const block of resultBlocks) {
                if (results.length >= 5) break

                const titleEl = block.querySelector('.result__a')
                const snippetEl = block.querySelector('.result__snippet')

                if (titleEl) {
                    let url = titleEl.getAttribute('href') || ''
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

                    results.push({
                        title: titleEl.textContent?.trim() || 'No Title',
                        url: url,
                        snippet: snippetEl?.textContent?.trim() || 'No preview available.'
                    })
                }
            }

            if (results.length === 0) {
                // If we found blocks but no content, the structure might have changed
                if (resultBlocks.length > 0) {
                    return "Search engine structure has changed. Found potential results but could not parse details."
                }
                return "No search results found. DuckDuckGo might be presenting a different layout or a CAPTCHA."
            }

            return results.map((r, i) => `Result ${i + 1}:\nTitle: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n')
        } catch (error) {
            return `Search Error: ${error instanceof Error ? error.message : String(error)}`
        }
    }
}
