import { useEffect, useState } from 'react'
import { ErrorLogger, ErrorLog, ErrorSeverity } from '../utils/errorLogger'
import { Toast } from './Toast'

export const ToastManager = () => {
    const [toasts, setToasts] = useState<ErrorLog[]>([])

    useEffect(() => {
        // Subscribe to ErrorLogger
        const unsubscribe = ErrorLogger.addListener((log) => {
            // Only show WARNING and above as toasts
            if (log.severity !== ErrorSeverity.INFO) {
                setToasts(prev => [...prev, log])
            }
        })

        return unsubscribe
    }, [])

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
            {toasts.map(toast => (
                <div key={toast.id} className="pointer-events-auto">
                    <Toast
                        id={toast.id}
                        message={toast.message}
                        severity={toast.severity}
                        onDismiss={removeToast}
                        duration={toast.severity === ErrorSeverity.CRITICAL ? 0 : 5000}
                    />
                </div>
            ))}
        </div>
    )
}
