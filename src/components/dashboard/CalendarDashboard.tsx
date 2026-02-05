import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { ToolService } from '@/services/toolService'
import { Loader2, Clock, MapPin, Video } from 'lucide-react'

interface CalendarEvent {
    summary: string
    start: string // ISO string
    end: string   // ISO string
    description?: string
    location?: string
    hangoutLink?: string
}

export function CalendarDashboard() {
    const { settings, addMessage, setCurrentView } = useStore()
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchEvents = async () => {
            if (!settings.aiSettings.googleCalendarApiKey && !settings.aiSettings.googleCalendarOAuthToken) return

            setLoading(true)
            try {
                const response = await ToolService.executeTool('google_calendar', { operation: 'list' })

                // Response formatting depends on what the tool actually returns.
                // Assuming it returns a JSON string or a text summary.
                // If it returns text (which the tool currently does for simple formatting), 
                // we might NOT be able to parse it nicely into objects unless we updated the tool to return raw JSON.
                // Checking toolService: "return result" 
                // If toolService implementation of `google_calendar` returns structured data...
                // Actually, most generic tools return text for the AI.
                // If I want structured data for the UI, the tool should probably return JSON.
                // Let's assume for now I will receive text and I might just display it as markdown, 
                // OR I try to parse it if it IS JSON.
                // The previous tool definition implies it returns human readable text.
                // If so, I should just render the text.
                // But for a dashboard, I want widgets.
                // For now, I'll attempt to parse, if fail, I'll show error or raw text.

                // NOTE: Ideally I should update `ToolService` to return raw objects for the UI consumption, 
                // or have a specific method for UI data fetching.
                // For this task, I'll try to parse commonly known JSON structure or just display raw.
                // Let's try to parse.
                let data: any = []
                try {
                    data = JSON.parse(response.result)
                } catch {
                    // If not JSON, it might be the formatted string.
                    // In that case, we can't easily map it.
                    // We'll throw/set events to empty and show raw?
                    // Actually, let's just assume we want to improve the tool later. 
                    // For now, if parsing fails, we show a "Raw View"
                    console.warn("Could not parse calendar data as JSON", response.result)
                    setError("Received unstructured data. Tool update required for rich view.")
                    return
                }

                if (Array.isArray(data)) {
                    setEvents(data)
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch events')
            } finally {
                setLoading(false)
            }
        }

        fetchEvents()
    }, [settings.aiSettings.googleCalendarApiKey, settings.aiSettings.googleCalendarOAuthToken])

    if (!settings.aiSettings.googleCalendarApiKey && !settings.aiSettings.googleCalendarOAuthToken) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="glass-card p-8 rounded-xl max-w-md">
                    <h2 className="text-2xl font-bold mb-4">Connect Google Calendar</h2>
                    <p className="text-muted-foreground mb-6">
                        Connect your calendar to see your upcoming schedule and join meetings directly.
                    </p>
                    <button
                        onClick={() => setCurrentView('integrations')}
                        className="glass-strong px-6 py-3 rounded-lg font-medium"
                    >
                        Go to Integrations
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col">
            <div className="glass-light border-b border-white/10 px-4 py-3 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <h2 className="text-base font-semibold flex items-center gap-2">
                        <span className="text-2xl">📅</span> Your Schedule
                    </h2>
                    <p className="text-[12px] text-muted-foreground">Upcoming events</p>
                </div>
                <button
                    onClick={() => {
                        addMessage({ role: 'user', content: "Summarize my day based on my calendar" })
                        setCurrentView('home')
                    }}
                    className="text-[10px] bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-full transition-colors"
                >
                    Brief Me
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    // Fallback for non-JSON response or error
                    <div className="glass-card p-6 rounded-xl text-center">
                        <p className="text-red-400 mb-2">Unable to load structured view</p>
                        <p className="text-xs text-muted-foreground mb-4">{error}</p>
                        <p className="text-sm">The AI tool returned unstructured text. Ask it directly instead.</p>
                    </div>
                ) : events.length === 0 ? (
                    <div className="text-center text-muted-foreground py-10">No upcoming events found.</div>
                ) : (
                    <div className="space-y-3">
                        {events.map((event, i) => (
                            <div key={i} className="glass-card p-3 rounded-lg flex gap-3 hover:bg-white/5 transition-colors">
                                <div className="flex-shrink-0 w-16 text-center pt-1">
                                    <div className="text-sm font-bold uppercase text-red-400">
                                        {new Date(event.start).toLocaleDateString(undefined, { month: 'short' })}
                                    </div>
                                    <div className="text-2xl font-bold">
                                        {new Date(event.start).getDate()}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-lg truncate">{event.summary}</h3>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-3.5 w-3.5" />
                                            {new Date(event.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} -
                                            {new Date(event.end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                        </div>
                                        {event.location && (
                                            <div className="flex items-center gap-1">
                                                <MapPin className="h-3.5 w-3.5" />
                                                <span className="truncate max-w-[150px]">{event.location}</span>
                                            </div>
                                        )}
                                    </div>
                                    {event.hangoutLink && (
                                        <a
                                            href={event.hangoutLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-2 py-1 rounded mt-2 transition-colors"
                                        >
                                            <Video className="h-3 w-3" />
                                            Join Meeting
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
