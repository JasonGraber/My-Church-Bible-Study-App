
import React, { ErrorInfo, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';

interface Props {
  // Making children optional resolves the "missing in type {}" error in JSX usage when used as a wrapper.
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Fix: Use React.Component explicitly to ensure proper inheritance and access to instance properties.
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    // Fix: Correctly initializing state on the instance.
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = async () => {
    try {
        // Attempt to clear Supabase session specifically
        if (supabase) {
          await supabase.auth.signOut();
        }
    } catch (e) {
        console.warn("Failed to sign out via Supabase SDK", e);
    }
    
    // Clear all local storage
    localStorage.clear();
    
    // Clear session storage
    sessionStorage.clear();

    // Reload the app
    window.location.href = '/';
  };

  public render() {
    // Fix: Accessing state safely from this.state as inherited from React.Component.
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-2xl max-w-sm w-full">
            <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            
            <h1 className="text-2xl font-serif font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-gray-400 mb-6 text-sm">
              The application encountered an unexpected error. This usually happens due to corrupted local data.
            </p>

            <div className="bg-black/30 p-3 rounded-lg mb-6 text-left overflow-hidden">
                <p className="font-mono text-[10px] text-red-300 break-all">
                    {/* Fix: Accessing instance error state correctly. */}
                    {this.state.error?.message || "Unknown Error"}
                </p>
            </div>

            <button
              onClick={this.handleReset}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
            >
              Fix Issues & Restart
            </button>
            <p className="text-[10px] text-gray-500 mt-4">
                This will log you out and clear local cache to restore functionality.
            </p>
          </div>
        </div>
      );
    }

    // Fix: Explicitly returning children from this.props.
    return this.props.children;
  }
}

export default ErrorBoundary;
