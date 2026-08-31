import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, Terminal, RefreshCw, Home, Copy, Check } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an uncaught rendering error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleCopy = () => {
    const { error, errorInfo } = this.state;
    const data = `Error: ${error?.message || "Unknown error"}\n\nStack:\n${error?.stack || "N/A"}\n\nComponent Stack:\n${errorInfo?.componentStack || "N/A"}`;
    navigator.clipboard
      .writeText(data)
      .then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      })
      .catch(() => {});
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
          <div className="w-full max-w-2xl rounded-xl border border-destructive/30 bg-destructive/5 p-6 md:p-8 shadow-2xl backdrop-blur-xs">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                <AlertTriangle className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                  UI Rendering Collapse Restored
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  The client runtime encountered an unexpected component execution failure.
                </p>

                <div className="mt-4 rounded-lg bg-card border border-border p-3.5 font-mono text-xs text-foreground overflow-x-auto break-all">
                  <span className="font-bold text-destructive">Message:</span>{" "}
                  {this.state.error?.message || "Unknown rendering exception"}
                </div>

                <div className="mt-6 flex flex-wrap gap-2.5">
                  <button
                    onClick={() => {
                      // Attempt a full application state reset
                      window.location.reload();
                    }}
                    className="inline-flex items-center gap-1.5 justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
                  >
                    <RefreshCw className="size-3.5 animate-spin-reverse" />
                    Reset Engine & Reload
                  </button>

                  <a
                    href="/"
                    className="inline-flex items-center gap-1.5 justify-center rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent cursor-pointer"
                  >
                    <Home className="size-3.5" />
                    Go Back Home
                  </a>
                </div>

                {this.state.errorInfo && (
                  <div className="mt-5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                        EVM App Diagnostic Log
                      </span>
                      <button
                        onClick={this.handleCopy}
                        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition font-medium cursor-pointer"
                      >
                        {this.state.copied ? (
                          <>
                            <Check className="size-3 text-emerald-400" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            Copy Calltrace
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="rounded-lg bg-muted/60 border border-border/80 p-4 font-mono text-[10px] leading-relaxed text-muted-foreground overflow-x-auto max-h-60 select-all custom-scrollbar">
                      {this.state.error?.stack}
                      {"\n\nComponent Stack:\n"}
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
