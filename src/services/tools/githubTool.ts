import { useStore } from '../../store'

/**
 * GitHub Tool
 * Allows AI to interact with GitHub API
 * 
 * Prerequisites: User must have GITHUB_API_KEY (personal access token) in settings
 */

interface GitHubIssue {
    title: string
    body?: string
    labels?: string[]
}

export class GitHubTool {
    /**
     * Execute a GitHub operation
     * @param operation - The operation to perform (repos, issues, prs, create_issue)
     * @param args - Operation-specific arguments
     */
    static async execute(operation: string, args: any): Promise<string> {
        try {
            const apiKey = this.getApiKey()
            if (!apiKey) {
                return 'GitHub is not configured. Please add your GitHub personal access token in Settings.'
            }

            switch (operation) {
                case 'repos':
                    return await this.listRepos(apiKey, args)
                case 'issues':
                    return await this.listIssues(apiKey, args)
                case 'prs':
                    return await this.listPullRequests(apiKey, args)
                case 'create_issue':
                    return await this.createIssue(apiKey, args)
                case 'get_file':
                    return await this.getFile(apiKey, args)
                default:
                    return `Unknown GitHub operation: ${operation}`
            }
        } catch (error) {
            return `GitHub error: ${error instanceof Error ? error.message : String(error)}`
        }
    }

    /**
     * List user repositories
     */
    private static async listRepos(apiKey: string, args: any): Promise<string> {
        const username = args.username || args.user
        const limit = args.limit || 10

        const url = username
            ? `https://api.github.com/users/${username}/repos`
            : 'https://api.github.com/user/repos'

        const response = await fetch(`${url}?per_page=${limit}&sort=updated`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        })

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
        }

        const repos = await response.json()

        if (!repos || repos.length === 0) {
            return JSON.stringify([])
        }

        // Map to a cleaner object for the AI/Dashboard to consume
        const cleanRepos = repos.map((repo: any) => ({
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description,
            html_url: repo.html_url,
            stargazers_count: repo.stargazers_count,
            forks_count: repo.forks_count,
            language: repo.language,
            updated_at: repo.updated_at
        }))

        return JSON.stringify(cleanRepos)
    }

    /**
     * List issues for a repository
     */
    private static async listIssues(apiKey: string, args: any): Promise<string> {
        const repo = args.repo || args.repository
        if (!repo) {
            return 'Error: repo parameter required (format: "owner/repo")'
        }

        const state = args.state || 'open'
        const limit = args.limit || 10

        const response = await fetch(
            `https://api.github.com/repos/${repo}/issues?state=${state}&per_page=${limit}`,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        )

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
        }

        const issues = await response.json()

        // Filter out pull requests (GitHub API includes them in issues endpoint)
        const actualIssues = issues.filter((issue: any) => !issue.pull_request)

        if (actualIssues.length === 0) {
            return JSON.stringify([])
        }

        const cleanIssues = actualIssues.map((issue: any) => ({
            number: issue.number,
            title: issue.title,
            labels: issue.labels.map((l: any) => l.name),
            html_url: issue.html_url,
            state: issue.state,
            user: issue.user.login
        }))

        return JSON.stringify(cleanIssues)
    }

    /**
     * List pull requests for a repository
     */
    private static async listPullRequests(apiKey: string, args: any): Promise<string> {
        const repo = args.repo || args.repository
        if (!repo) {
            return 'Error: repo parameter required (format: "owner/repo")'
        }

        const state = args.state || 'open'
        const limit = args.limit || 10

        const response = await fetch(
            `https://api.github.com/repos/${repo}/pulls?state=${state}&per_page=${limit}`,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        )

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
        }

        const prs = await response.json()

        if (prs.length === 0) {
            return JSON.stringify([])
        }

        const cleanPRs = prs.map((pr: any) => ({
            number: pr.number,
            title: pr.title,
            user: pr.user.login,
            html_url: pr.html_url,
            state: pr.state,
            draft: pr.draft
        }))

        return JSON.stringify(cleanPRs)
    }

    /**
     * Create a new issue
     */
    private static async createIssue(apiKey: string, args: any): Promise<string> {
        const repo = args.repo || args.repository
        if (!repo) {
            return 'Error: repo parameter required (format: "owner/repo")'
        }

        const issue: GitHubIssue = {
            title: args.title,
            body: args.body || args.description,
            labels: args.labels
        }

        if (!issue.title) {
            return 'Error: title is required to create an issue'
        }

        const response = await fetch(
            `https://api.github.com/repos/${repo}/issues`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(issue)
            }
        )

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(`Failed to create issue: ${errorData.message || response.statusText}`)
        }

        const data = await response.json()
        return `Issue created successfully!\n#${data.number}: ${data.title}\n${data.html_url}`
    }

    /**
     * Get file content from a repository
     */
    private static async getFile(apiKey: string, args: any): Promise<string> {
        const repo = args.repo || args.repository
        const path = args.path || 'README.md'

        if (!repo) {
            return 'Error: repo parameter required (format: "owner/repo")'
        }

        const response = await fetch(
            `https://api.github.com/repos/${repo}/contents/${path}`,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        )

        if (!response.ok) {
            if (response.status === 404) {
                return `File not found: ${path} in ${repo}`
            }
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()

        if (Array.isArray(data)) {
            return `Error: Path '${path}' is a directory, not a file.`
        }

        if (!data.content) {
            return 'Error: File content is empty or unreadable.'
        }

        try {
            // content is base64 encoded
            const content = atob(data.content.replace(/\n/g, ''))
            return content
        } catch (e) {
            return 'Error: Failed to decode file content.'
        }
    }

    /**
     * Get API key from settings
     */
    private static getApiKey(): string | null {
        return useStore.getState().settings.aiSettings.githubApiKey || null
    }
}
