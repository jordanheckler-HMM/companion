export enum ErrorSeverity {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
    CRITICAL = 'critical'
}

export interface ErrorLog {
    id: string
    timestamp: number
    message: string
    stack?: string
    severity: ErrorSeverity
    context?: Record<string, any>
    service?: string
}

export class ErrorLogger {
    private static logs: ErrorLog[] = []
    private static listeners: ((log: ErrorLog) => void)[] = []
    private static MAX_LOGS = 100

    static log(
        message: string,
        severity: ErrorSeverity = ErrorSeverity.ERROR,
        service?: string,
        context?: Record<string, any>,
        error?: unknown
    ) {
        const log: ErrorLog = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            message,
            severity,
            service,
            context,
        }

        if (error instanceof Error) {
            log.stack = error.stack
            if (!log.message) log.message = error.message
        } else if (error) {
            log.context = { ...log.context, originalError: error }
        }

        // Add to internal log buffer
        this.logs.unshift(log)
        if (this.logs.length > this.MAX_LOGS) {
            this.logs.pop()
        }

        // Notify listeners (UI toasts, debug console, etc.)
        this.listeners.forEach(listener => listener(log))

        // Always log to console in dev mode, or for critical errors
        if (import.meta.env.DEV || severity === ErrorSeverity.CRITICAL) {
            console.group(`[${severity.toUpperCase()}] ${service ? `[${service}]` : ''} ${message}`)
            if (context) console.log('Context:', context)
            if (log.stack) console.error(log.stack)
            console.groupEnd()
        }
    }

    static getLogs(): ErrorLog[] {
        return this.logs
    }

    static addListener(listener: (log: ErrorLog) => void) {
        this.listeners.push(listener)
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
        }
    }

    static clear() {
        this.logs = []
    }
}
