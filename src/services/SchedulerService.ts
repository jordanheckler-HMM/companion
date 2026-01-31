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
     * Schedule recurring execution using chained setTimeout (not setInterval).
     * This recalculates the exact next run time after each execution,
     * properly handling DST changes and avoiding drift.
     */
    private scheduleRecurring(
        automationId: string,
        trigger: Trigger,
        callback: () => void
    ): void {
        if (!trigger.scheduleConfig) return

        // Calculate the actual next run time based on the schedule
        const now = new Date()
        const nextRun = this.getNextRunTime(trigger, now)
        const delay = nextRun.getTime() - now.getTime()

        // Handle edge case where delay could be 0 or negative
        const safeDelay = Math.max(delay, 1000)

        const timerId = window.setTimeout(() => {
            // Execute the callback
            callback()

            // Chain to the next occurrence (recalculate fresh)
            this.scheduleRecurring(automationId, trigger, callback)
        }, safeDelay)

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
                // Basic cron expression parsing (common patterns only)
                // Format: minute hour day-of-month month day-of-week
                // Supports: "0 9 * * *" (daily at 9am), "0 * * * *" (every hour), etc.
                if (trigger.scheduleConfig?.cronExpression) {
                    const parts = trigger.scheduleConfig.cronExpression.trim().split(/\s+/)
                    if (parts.length >= 5) {
                        const [cronMin, cronHour, _cronDom, _cronMonth, cronDow] = parts

                        // Parse minute and hour (handle '*' as current or next)
                        const targetMin = cronMin === '*' ? 0 : parseInt(cronMin) || 0
                        const targetHour = cronHour === '*' ? -1 : parseInt(cronHour)

                        if (targetHour === -1) {
                            // Every hour: schedule for next hour at specified minute
                            next.setMinutes(targetMin, 0, 0)
                            if (next <= from) {
                                next.setHours(next.getHours() + 1)
                            }
                        } else {
                            // Specific hour: schedule for that time
                            next.setHours(targetHour, targetMin, 0, 0)
                            if (next <= from) {
                                // Check for day-of-week constraint
                                if (cronDow !== '*') {
                                    const targetDay = parseInt(cronDow)
                                    const currentDay = next.getDay()
                                    let daysUntil = targetDay - currentDay
                                    if (daysUntil <= 0) daysUntil += 7
                                    next.setDate(next.getDate() + daysUntil)
                                } else {
                                    // Just move to tomorrow
                                    next.setDate(next.getDate() + 1)
                                }
                            }
                        }
                    } else {
                        // Invalid cron format, fallback to daily at 9am
                        console.warn('[SchedulerService] Invalid cron expression, falling back to daily at 9am')
                        next.setHours(9, 0, 0, 0)
                        if (next <= from) {
                            next.setDate(next.getDate() + 1)
                        }
                    }
                } else {
                    // No cron expression provided, fallback to daily at 9am
                    next.setHours(9, 0, 0, 0)
                    if (next <= from) {
                        next.setDate(next.getDate() + 1)
                    }
                }
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
