import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-10 max-w-md text-center">
            <p className="text-4xl mb-4">⚠️</p>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-500 mb-6">
              An unexpected error occurred. Please refresh the page. If the problem persists, contact the CDC technical team.
            </p>
            <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded p-2 mb-6 text-left break-all">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-purple-700 text-white font-semibold rounded-lg hover:bg-purple-800 transition"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
