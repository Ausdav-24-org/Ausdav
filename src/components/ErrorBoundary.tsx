import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    // You can log error to a reporting service here
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-6 bg-red-50 border rounded">
          <strong className="text-red-700">Something went wrong.</strong>
          <div className="text-sm text-muted-foreground mt-2">Please refresh the page or contact support.</div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
