import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an unhandled exception:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div 
          className="min-h-[300px] w-full flex items-center justify-center p-6 bg-slate-900/60 border border-slate-800 rounded-3xl text-center"
          role="alert"
        >
          <div className="max-w-md space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Something went wrong</h3>
              <p className="text-sm text-slate-400 mt-1">
                {this.props.title || "An unexpected error occurred while rendering this component."}
              </p>
            </div>
            <Button
              onClick={this.handleRetry}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-xs gap-2"
              type="button"
            >
              <RotateCcw size={14} /> Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
