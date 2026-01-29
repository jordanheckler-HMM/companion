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

export class GoogleCalendarTool {
    /**
     * Execute a Google Calendar operation
     * @param operation - The operation to perform (list, create, search)
     * @param args - Operation-specific arguments
     */
    static async execute(operation: string, args: any): Promise<string> {
        try {
            // Get API key from settings
            const apiKey = this.getApiKey()
            if (!apiKey) {
                return 'Google Calendar is not configured. Please add your Google Calendar API key in Settings.'
            }

            switch (operation) {
                case 'list':
                    return await this.listEvents(apiKey, args)
                case 'create':
                    return await this.createEvent(apiKey, args)
                case 'search':
                    return await this.searchEvents(apiKey, args)
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
    private static async listEvents(apiKey: string, args: any): Promise<string> {
        const maxResults = args.count || 10
        const timeMin = args.timeMin || new Date().toISOString()

        const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
        url.searchParams.set('key', apiKey)
        url.searchParams.set('timeMin', timeMin)
        url.searchParams.set('maxResults', String(maxResults))
        url.searchParams.set('singleEvents', 'true')
        url.searchParams.set('orderBy', 'startTime')

        const response = await fetch(url.toString())

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
    private static async createEvent(apiKey: string, args: any): Promise<string> {
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

        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?key=${apiKey}`

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
        })

        if (!response.ok) {
            throw new Error(`Failed to create event: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        return `Event created successfully: "${data.summary}" at ${data.start.dateTime}`
    }

    /**
     * Search for events by query
     */
    private static async searchEvents(apiKey: string, args: any): Promise<string> {
        const query = args.query || args.q

        const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
        url.searchParams.set('key', apiKey)
        url.searchParams.set('q', query)
        url.searchParams.set('singleEvents', 'true')
        url.searchParams.set('orderBy', 'startTime')

        const response = await fetch(url.toString())

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
    private static getApiKey(): string | null {
        return useStore.getState().settings.aiSettings.googleCalendarApiKey || null
    }
}
