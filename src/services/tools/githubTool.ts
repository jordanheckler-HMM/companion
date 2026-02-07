import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { confirm } from '@tauri-apps/plugin-dialog'
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

interface PendingGitHubAction {
    operation: 'create_issue'
    repo: string
    issue: GitHubIssue
    expiresAt: number
}

export class GitHubTool {
    private static readonly CONFIRM_TTL_MS = 10 * 60 * 1000
    private static pendingActions = new Map<string, PendingGitHubAction>()

    /**
     * Execute a GitHub operation
     * @param operation - The operation to perform (repos, issues, prs, create_issue)
     * @param args - Operation-specific arguments
     */
    static async execute(operation: string, args: any): Promise<string> {
        try {
            this.pruneExpiredActions()
            const apiKey = this.getApiKey()

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
    private static async listRepos(apiKey: string | null, args: any): Promise<string> {
        const username = args.username || args.user
        const limit = args.limit || 10

        if (!apiKey && !username) {
            return this.blocked(
                'GitHub read-only access requires an explicit scope. Provide a username for public repos or configure a token.',
                { required: ['username'] }
            )
        }

        const url = username
            ? `https://api.github.com/users/${username}/repos`
            : 'https://api.github.com/user/repos'

        const response = await tauriFetch(`${url}?per_page=${limit}&sort=updated`, {
            headers: this.getAuthHeaders(apiKey)
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
    private static async listIssues(apiKey: string | null, args: any): Promise<string> {
        const repo = args.repo || args.repository
        if (!repo) {
            return 'Error: repo parameter required (format: "owner/repo")'
        }

        const state = args.state || 'open'
        const limit = args.limit || 10

        const response = await tauriFetch(
            `https://api.github.com/repos/${repo}/issues?state=${state}&per_page=${limit}`,
            {
                headers: this.getAuthHeaders(apiKey)
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
    private static async listPullRequests(apiKey: string | null, args: any): Promise<string> {
        const repo = args.repo || args.repository
        if (!repo) {
            return 'Error: repo parameter required (format: "owner/repo")'
        }

        const state = args.state || 'open'
        const limit = args.limit || 10

        const response = await tauriFetch(
            `https://api.github.com/repos/${repo}/pulls?state=${state}&per_page=${limit}`,
            {
                headers: this.getAuthHeaders(apiKey)
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
    private static async createIssue(apiKey: string | null, args: any): Promise<string> {
        const repo = args.repo || args.repository
        if (!repo) {
            return 'Error: repo parameter required (format: "owner/repo")'
        }

        if (!apiKey) {
            return this.blocked('GitHub token required for write operations.', { required: ['githubApiKey'] })
        }

        const issue: GitHubIssue = {
            title: args.title,
            body: args.body || args.description,
            labels: args.labels
        }

        if (!issue.title) {
            return 'Error: title is required to create an issue'
        }

        const phase = args.phase || 'prepare'
        if (phase !== 'execute') {
            const confirmationId = this.createConfirmationId('create_issue', repo, issue)
            return JSON.stringify({
                phase: 'prepare',
                tool: 'github',
                operation: 'create_issue',
                preview: {
                    repo,
                    issue
                },
                confirmationId,
                nextStep: 'Call create_issue with phase="execute", confirmationId, and confirm=true to create the issue.'
            }, null, 2)
        }

        const confirmationId = args.confirmationId
        if (!confirmationId || !this.isConfirmationValid(confirmationId, 'create_issue')) {
            return this.blocked('Confirmation required before executing write operation.', {
                required: ['confirmationId'],
                nextStep: 'Call create_issue with phase="prepare" to generate a confirmationId.'
            })
        }

        if (args.confirm !== true) {
            return this.blocked('Explicit confirmation is required to execute this write operation.', {
                required: ['confirm=true']
            })
        }

        const pending = this.pendingActions.get(confirmationId)
        if (!pending) {
            return this.blocked('Confirmation has expired or is invalid.', { required: ['confirmationId'] })
        }

        const approved = await confirm(
            `Create GitHub issue in ${pending.repo}?\n\nTitle: ${pending.issue.title}`,
            { title: 'Confirm GitHub Action', kind: 'warning' }
        )
        if (!approved) {
            return 'User denied GitHub issue creation.'
        }

        const response = await tauriFetch(
            `https://api.github.com/repos/${pending.repo}/issues`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(pending.issue)
            }
        )

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(`Failed to create issue: ${errorData.message || response.statusText}`)
        }

        const data = await response.json()
        this.pendingActions.delete(confirmationId)
        return `Issue created successfully!\n#${data.number}: ${data.title}\n${data.html_url}`
    }

    /**
     * Get file content from a repository
     */
    private static async getFile(apiKey: string | null, args: any): Promise<string> {
        const repo = args.repo || args.repository
        const path = args.path || 'README.md'

        if (!repo) {
            return 'Error: repo parameter required (format: "owner/repo")'
        }

        const response = await tauriFetch(
            `https://api.github.com/repos/${repo}/contents/${path}`,
            {
                headers: this.getAuthHeaders(apiKey)
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

    private static getAuthHeaders(apiKey: string | null) {
        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3+json'
        }
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`
        }
        return headers
    }

    private static blocked(message: string, details?: Record<string, any>): string {
        return JSON.stringify({
            error: 'EXECUTION_BLOCKED',
            message,
            ...details
        }, null, 2)
    }

    private static createConfirmationId(operation: 'create_issue', repo: string, issue: GitHubIssue): string {
        const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
        this.pendingActions.set(id, {
            operation,
            repo,
            issue,
            expiresAt: Date.now() + this.CONFIRM_TTL_MS
        })
        return id
    }

    private static isConfirmationValid(id: string, operation: 'create_issue'): boolean {
        const pending = this.pendingActions.get(id)
        if (!pending) return false
        if (pending.operation !== operation) return false
        if (pending.expiresAt < Date.now()) {
            this.pendingActions.delete(id)
            return false
        }
        return true
    }

    private static pruneExpiredActions() {
        const now = Date.now()
        for (const [id, pending] of this.pendingActions.entries()) {
            if (pending.expiresAt < now) {
                this.pendingActions.delete(id)
            }
        }
    }
}
