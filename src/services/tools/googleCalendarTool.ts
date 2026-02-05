import { confirm } from '@tauri-apps/plugin-dialog'
import { useStore } from '../../store'

/**
 * Google Calendar Tool
 * Allows AI to interact with Google Calendar API
 * 
 * Prerequisites: User must have GOOGLE_CALENDAR_API_KEY in settings
 */

interface CalendarEvent {
    summary: string
    start: { dateTime: string; timeZone?: string }
    end: { dateTime: string; timeZone?: string }
    description?: string
    location?: string
}

interface PendingCalendarAction {
    operation: 'create'
    calendarId: string
    event: CalendarEvent
    expiresAt: number
}

export class GoogleCalendarTool {
    private static readonly CONFIRM_TTL_MS = 10 * 60 * 1000
    private static pendingActions = new Map<string, PendingCalendarAction>()

    /**
     * Execute a Google Calendar operation
     * @param operation - The operation to perform (list, create, search)
     * @param args - Operation-specific arguments
     */
    static async execute(operation: string, args: any): Promise<string> {
        try {
            // Get API key from settings
            this.pruneExpiredActions()
            const auth = this.getAuth()
            if (!auth) {
                return 'Google Calendar is not configured. Please add a Google Calendar API key or OAuth token in Settings.'
            }

            switch (operation) {
                case 'list':
                    return await this.listEvents(auth, args)
                case 'create':
                    return await this.createEvent(auth, args)
                case 'search':
                    return await this.searchEvents(auth, args)
                default:
                    return `Unknown Google Calendar operation: ${operation}`
            }
        } catch (error) {
            return `Google Calendar error: ${error instanceof Error ? error.message : String(error)}`
        }
    }

    /**
     * List upcoming events
     */
    private static async listEvents(auth: { type: 'apiKey' | 'oauth'; token: string }, args: any): Promise<string> {
        const maxResults = args.count || 10
        const timeMin = args.timeMin || new Date().toISOString()
        const calendarId = args.calendarId || 'primary'

        if (auth.type === 'apiKey') {
            if (!args.calendarId || args.publicCalendar !== true) {
                return this.blocked(
                    'API key access is limited to public calendars. Provide calendarId and set publicCalendar=true, or configure an OAuth token.',
                    { required: ['calendarId', 'publicCalendar=true'] }
                )
            }
        }

        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
        if (auth.type === 'apiKey') {
            url.searchParams.set('key', auth.token)
        }
        url.searchParams.set('timeMin', timeMin)
        url.searchParams.set('maxResults', String(maxResults))
        url.searchParams.set('singleEvents', 'true')
        url.searchParams.set('orderBy', 'startTime')

        const response = await fetch(url.toString(), {
            headers: auth.type === 'oauth' ? { 'Authorization': `Bearer ${auth.token}` } : undefined
        })

        if (!response.ok) {
            throw new Error(`Calendar API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()

        if (!data.items || data.items.length === 0) {
            return JSON.stringify([])
        }

        const events = data.items.map((event: any) => ({
            id: event.id,
            summary: event.summary,
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            location: event.location,
            htmlLink: event.htmlLink
        }))

        return JSON.stringify(events)
    }

    /**
     * Create a new event
     */
    private static async createEvent(auth: { type: 'apiKey' | 'oauth'; token: string }, args: any): Promise<string> {
        if (auth.type !== 'oauth') {
            return this.blocked('Creating events requires an OAuth token. API keys are read-only.', {
                required: ['googleCalendarOAuthToken']
            })
        }

        const calendarId = args.calendarId || 'primary'
        const event: CalendarEvent = {
            summary: args.title || args.summary,
            start: {
                dateTime: args.startTime,
                timeZone: args.timeZone || 'America/Chicago'
            },
            end: {
                dateTime: args.endTime,
                timeZone: args.timeZone || 'America/Chicago'
            },
            description: args.description,
            location: args.location
        }

        if (!event.summary || !event.start.dateTime || !event.end.dateTime) {
            return this.blocked('Missing required event fields.', { required: ['title', 'startTime', 'endTime'] })
        }

        const phase = args.phase || 'prepare'
        if (phase !== 'execute') {
            const confirmationId = this.createConfirmationId('create', calendarId, event)
            return JSON.stringify({
                phase: 'prepare',
                tool: 'google_calendar',
                operation: 'create',
                preview: {
                    calendarId,
                    event
                },
                confirmationId,
                nextStep: 'Call create with phase="execute", confirmationId, and confirm=true to create the event.'
            }, null, 2)
        }

        const confirmationId = args.confirmationId
        if (!confirmationId || !this.isConfirmationValid(confirmationId, 'create')) {
            return this.blocked('Confirmation required before executing write operation.', {
                required: ['confirmationId'],
                nextStep: 'Call create with phase="prepare" to generate a confirmationId.'
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
            `Create calendar event in ${pending.calendarId}?\n\nTitle: ${pending.event.summary}`,
            { title: 'Confirm Calendar Action', kind: 'warning' }
        )
        if (!approved) {
            return 'User denied calendar event creation.'
        }

        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(pending.calendarId)}/events`

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify(pending.event)
        })

        if (!response.ok) {
            throw new Error(`Failed to create event: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        this.pendingActions.delete(confirmationId)
        return `Event created successfully: "${data.summary}" at ${data.start.dateTime}`
    }

    /**
     * Search for events by query
     */
    private static async searchEvents(auth: { type: 'apiKey' | 'oauth'; token: string }, args: any): Promise<string> {
        const query = args.query || args.q
        const calendarId = args.calendarId || 'primary'

        if (auth.type === 'apiKey') {
            if (!args.calendarId || args.publicCalendar !== true) {
                return this.blocked(
                    'API key access is limited to public calendars. Provide calendarId and set publicCalendar=true, or configure an OAuth token.',
                    { required: ['calendarId', 'publicCalendar=true'] }
                )
            }
        }

        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
        if (auth.type === 'apiKey') {
            url.searchParams.set('key', auth.token)
        }
        url.searchParams.set('q', query)
        url.searchParams.set('singleEvents', 'true')
        url.searchParams.set('orderBy', 'startTime')

        const response = await fetch(url.toString(), {
            headers: auth.type === 'oauth' ? { 'Authorization': `Bearer ${auth.token}` } : undefined
        })

        if (!response.ok) {
            throw new Error(`Calendar search error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()

        if (!data.items || data.items.length === 0) {
            return JSON.stringify([])
        }

        const events = data.items.map((event: any) => ({
            id: event.id,
            summary: event.summary,
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            location: event.location,
            htmlLink: event.htmlLink
        }))

        return JSON.stringify(events)
    }

    /**
     * Get API key from settings
     */
    private static getAuth(): { type: 'apiKey' | 'oauth'; token: string } | null {
        const settings = useStore.getState().settings.aiSettings
        if (settings.googleCalendarOAuthToken) {
            return { type: 'oauth', token: settings.googleCalendarOAuthToken }
        }
        if (settings.googleCalendarApiKey) {
            return { type: 'apiKey', token: settings.googleCalendarApiKey }
        }
        return null
    }

    private static blocked(message: string, details?: Record<string, any>): string {
        return JSON.stringify({
            error: 'EXECUTION_BLOCKED',
            message,
            ...details
        }, null, 2)
    }

    private static createConfirmationId(operation: 'create', calendarId: string, event: CalendarEvent): string {
        const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
        this.pendingActions.set(id, {
            operation,
            calendarId,
            event,
            expiresAt: Date.now() + this.CONFIRM_TTL_MS
        })
        return id
    }

    private static isConfirmationValid(id: string, operation: 'create'): boolean {
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
