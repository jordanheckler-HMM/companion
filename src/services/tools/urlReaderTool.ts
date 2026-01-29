import { fetch } from '@tauri-apps/plugin-http'

export class URLReaderTool {
    static async read(url: string): Promise<string> {
        try {
            console.log(`URLReaderTool: Reading URL "${url}"`)
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                },
                connectTimeout: 10000,
            })

            if (!response.ok) {
                return `Failed to read URL: HTTP ${response.status} ${response.statusText}. The website might be blocking automated access or is temporarily down.`
            }

            const text = await response.text()

            // Basic HTML stripping using DOMParser for better results
            const parser = new DOMParser()
            const doc = parser.parseFromString(text, 'text/html')

            // Remove scripts, styles, nav, and footer to get cleaner content
            doc.querySelectorAll('script, style, nav, footer, iframe, noscript').forEach(el => el.remove())

            // Try to find the main content if possible
            const body = doc.querySelector('article, main, .content, #content') || doc.body

            const stripped = body.textContent || ''
            const cleanText = stripped.replace(/\s+/g, ' ').trim()

            if (cleanText.length < 50) {
                return "The page contains very little text content after cleaning. This happens on sites that rely heavily on JavaScript or have strong anti-bot protections."
            }

            // Limit to first 6000 chars (slightly increased for better context)
            return `Content from ${url}:\n\n` + cleanText.substring(0, 6000) + (cleanText.length > 6000 ? '...' : '')
        } catch (error) {
            return `URL Read Error: ${error instanceof Error ? error.message : String(error)}`
        }
    }
}
