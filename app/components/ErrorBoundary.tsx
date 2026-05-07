/**
 * ErrorBoundary — React class component that catches rendering errors.
 * Wraps sections of the UI so a crash in one area doesn't kill the whole app.
 * Displays a friendly fallback UI instead of a blank page.
 */
"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  /** Optional custom fallback. Defaults to the built-in error card. */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Class-based error boundary required by React's error boundary API.
 * Catches errors thrown during rendering, lifecycle methods, and constructors.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  /** React lifecycle — called when a descendant throws during rendering. */
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  /** Log the error details for debugging. */
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Something went wrong</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-xs">{this.state.message || "An unexpected error occurred in this section."}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
