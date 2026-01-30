import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { ErrorLogger, ErrorSeverity } from '../utils/errorLogger'

interface Props {
    children: ReactNode
    fallback?: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        ErrorLogger.log(
            'React Component Error',
            ErrorSeverity.ERROR,
            'UI',
            { componentStack: errorInfo.componentStack },
            error
        )
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null })
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div className="flex flex-col items-center justify-center h-full w-full p-6 text-center space-y-4">
                    <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-red-400">Something went wrong</h2>
                    <p className="text-sm text-gray-400 max-w-md">
                        {this.state.error?.message || "An unexpected error occurred while rendering this component."}
                    </p>
                    <button
                        onClick={this.handleRetry}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/10"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                    </button>
                    {import.meta.env.DEV && this.state.error?.stack && (
                        <div className="w-full max-w-2xl mt-4 p-4 text-left bg-black/50 rounded-lg overflow-auto max-h-48 text-xs font-mono text-gray-500 border border-white/5">
                            {this.state.error.stack}
                        </div>
                    )}
                </div>
            )
        }

        return this.props.children
    }
}
