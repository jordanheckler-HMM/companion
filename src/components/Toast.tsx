import { useEffect, useState } from 'react'
import { X, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { ErrorSeverity } from '../utils/errorLogger'

export interface ToastProps {
    id: string
    message: string
    severity: ErrorSeverity
    onDismiss: (id: string) => void
    duration?: number
}

const icons = {
    [ErrorSeverity.INFO]: Info,
    [ErrorSeverity.WARNING]: AlertTriangle,
    [ErrorSeverity.ERROR]: AlertCircle,
    [ErrorSeverity.CRITICAL]: AlertCircle,
}

const colors = {
    [ErrorSeverity.INFO]: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    [ErrorSeverity.WARNING]: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    [ErrorSeverity.ERROR]: 'bg-red-500/10 text-red-400 border-red-500/20',
    [ErrorSeverity.CRITICAL]: 'bg-red-900/40 text-red-200 border-red-500/50',
}

export const Toast = ({ id, message, severity, onDismiss, duration = 5000 }: ToastProps) => {
    const [isExiting, setIsExiting] = useState(false)
    const Icon = icons[severity]
    const colorClass = colors[severity]

    useEffect(() => {
        if (duration === 0) return

        const timer = setTimeout(() => {
            setIsExiting(true)
            setTimeout(() => onDismiss(id), 300) // Wait for exit animation
        }, duration)

        return () => clearTimeout(timer)
    }, [duration, id, onDismiss])

    const handleDismiss = () => {
        setIsExiting(true)
        setTimeout(() => onDismiss(id), 300)
    }

    return (
        <div
            className={`
                min-w-[300px] max-w-md p-4 rounded-lg backdrop-blur-md border shadow-lg flex items-start gap-3
                transition-all duration-300 transform
                ${colorClass}
                ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
            `}
            role="alert"
        >
            <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm font-medium break-words leading-relaxed">
                {message}
            </div>
            <button
                onClick={handleDismiss}
                className="opacity-70 hover:opacity-100 transition-opacity p-0.5 hover:bg-white/10 rounded"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    )
}
