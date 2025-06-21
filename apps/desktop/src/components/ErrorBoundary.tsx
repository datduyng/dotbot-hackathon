import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Error boundary caught an error:', error, errorInfo)
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />
      }

      return (
        <div className="flex justify-center items-center min-h-screen bg-background text-foreground">
          <div className="text-center max-w-md">
            <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded">
              <h2 className="text-lg font-semibold text-red-800 mb-2">❌ Something went wrong</h2>
              <p className="text-red-700 mb-2">The component encountered an error:</p>
              <p className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded">
                {this.state.error?.message || 'Unknown error'}
              </p>
              {this.state.error?.stack && (
                <details className="mt-2 text-left">
                  <summary className="text-sm text-red-600 cursor-pointer">Stack trace</summary>
                  <pre className="text-xs text-red-500 mt-1 overflow-auto max-h-32">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
            <button 
              onClick={this.resetError}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/80"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary 