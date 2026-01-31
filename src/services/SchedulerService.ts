import { Trigger } from '@/store'

interface ScheduledJob {
    automationId: string
    timerId: number
    nextRun: Date
}

class SchedulerService {
    private jobs: Map<string, ScheduledJob> = new Map()

    /**
     * Schedule a job based on the trigger configuration
     */
    scheduleJob(
        automationId: string,
        trigger: Trigger,
        callback: () => void
    ): void {
        // Cancel existing job if any
        this.cancelJob(automationId)

        if (trigger.type !== 'schedule' || !trigger.scheduleConfig) {
            return
        }

        const { frequency } = trigger.scheduleConfig

        // Calculate initial delay
        const now = new Date()
        const nextRun = this.getNextRunTime(trigger, now)
        const delay = nextRun.getTime() - now.getTime()

        // Schedule first run
        const timerId = window.setTimeout(() => {
            callback()

            // For recurring jobs, reschedule
            if (frequency !== 'custom') {
                this.scheduleRecurring(automationId, trigger, callback)
            }
        }, delay)

        this.jobs.set(automationId, {
            automationId,
            timerId,
            nextRun
        })
    }

    /**
     * Schedule recurring execution
     */
    private scheduleRecurring(
        automationId: string,
        trigger: Trigger,
        callback: () => void
    ): void {
        if (!trigger.scheduleConfig) return

        const { frequency } = trigger.scheduleConfig
        let interval: number

        switch (frequency) {
            case 'hourly':
                interval = 60 * 60 * 1000 // 1 hour
                break
            case 'daily':
                interval = 24 * 60 * 60 * 1000 // 24 hours
                break
            case 'weekly':
                interval = 7 * 24 * 60 * 60 * 1000 // 7 days
                break
            default:
                return
        }

        const timerId = window.setInterval(callback, interval)
        const nextRun = new Date(Date.now() + interval)

        this.jobs.set(automationId, {
            automationId,
            timerId,
            nextRun
        })
    }

    /**
     * Cancel a scheduled job
     */
    cancelJob(automationId: string): void {
        const job = this.jobs.get(automationId)
        if (job) {
            window.clearTimeout(job.timerId)
            window.clearInterval(job.timerId)
            this.jobs.delete(automationId)
        }
    }

    /**
     * Get the next scheduled run time for a trigger
     */
    getNextRunTime(trigger: Trigger, from: Date = new Date()): Date {
        if (trigger.type !== 'schedule' || !trigger.scheduleConfig) {
            return from
        }

        const { frequency, time, dayOfWeek } = trigger.scheduleConfig
        const next = new Date(from)

        // Parse time if provided (format: "HH:MM")
        let hours = 0
        let minutes = 0
        if (time) {
            const [h, m] = time.split(':').map(Number)
            hours = h
            minutes = m
        }

        switch (frequency) {
            case 'hourly':
                // Next hour on the hour
                next.setMinutes(0, 0, 0)
                next.setHours(next.getHours() + 1)
                break

            case 'daily':
                // Today at specified time, or tomorrow if past
                next.setHours(hours, minutes, 0, 0)
                if (next <= from) {
                    next.setDate(next.getDate() + 1)
                }
                break

            case 'weekly':
                // Next occurrence of specified day at specified time
                if (dayOfWeek !== undefined) {
                    next.setHours(hours, minutes, 0, 0)
                    const currentDay = next.getDay()
                    let daysUntil = dayOfWeek - currentDay
                    if (daysUntil < 0 || (daysUntil === 0 && next <= from)) {
                        daysUntil += 7
                    }
                    next.setDate(next.getDate() + daysUntil)
                }
                break

            case 'custom':
                // For custom cron expressions, default to next day
                // (Full cron parsing would require a library like node-cron)
                next.setDate(next.getDate() + 1)
                break
        }

        return next
    }

    /**
     * Get all active jobs
     */
    getActiveJobs(): ScheduledJob[] {
        return Array.from(this.jobs.values())
    }

    /**
     * Get job info for a specific automation
     */
    getJob(automationId: string): ScheduledJob | undefined {
        return this.jobs.get(automationId)
    }

    /**
     * Cancel all jobs
     */
    cancelAllJobs(): void {
        this.jobs.forEach(job => {
            window.clearTimeout(job.timerId)
            window.clearInterval(job.timerId)
        })
        this.jobs.clear()
    }
}

// Singleton instance
export const schedulerService = new SchedulerService()
