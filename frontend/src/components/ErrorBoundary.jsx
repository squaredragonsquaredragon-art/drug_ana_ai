import React from "react";
import { AlertTriangle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 text-red-600 shadow-sm">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-semibold text-slate-900">Something went wrong</h1>
          <p className="mt-4 max-w-md text-slate-600">
            We encountered an unexpected error while rendering this page. Please try refreshing or return to the home page.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button className="bg-sky-600 hover:bg-sky-700" onClick={() => window.location.reload()}>
              Refresh page
            </Button>
            <Button variant="outline" className="border-sky-200" onClick={() => (window.location.href = "/")}>
              <Home className="mr-2 h-4 w-4" />
              Go to Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
