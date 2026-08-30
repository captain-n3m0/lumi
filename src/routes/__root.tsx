import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config as wagmiConfig } from "../lib/wagmiConfig";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { initializeTheme } from "../lib/theme";
import { Toaster } from "../components/ui/sonner";
import { AlertTriangle, Terminal, Copy, RefreshCw, Home, Check } from "lucide-react";
import { ErrorBoundary } from "../components/ErrorBoundary";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const [showStack, setShowStack] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const data = `Error: ${error.message}\n\nStack Trace:\n${error.stack || "No stack trace available"}`;
    navigator.clipboard
      .writeText(data)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl rounded-xl border border-destructive/30 bg-destructive/5 p-6 md:p-8 shadow-2xl backdrop-blur-xs">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
            <AlertTriangle className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              Application Error Captured
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              An unhandled rendering or state exception has occurred inside the client shell.
            </p>

            <div className="mt-4 rounded-lg bg-card border border-border p-3.5 font-mono text-xs text-foreground overflow-x-auto break-all">
              <span className="font-bold text-destructive">Message:</span>{" "}
              {error.message || String(error)}
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <button
                onClick={() => {
                  router.invalidate();
                  reset();
                }}
                className="inline-flex items-center gap-1.5 justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
              >
                <RefreshCw className="size-3.5" />
                Reload Context & Retry
              </button>

              <button
                onClick={() => setShowStack(!showStack)}
                className="inline-flex items-center gap-1.5 justify-center rounded-lg border border-border bg-muted/30 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted/80 cursor-pointer"
              >
                <Terminal className="size-3.5 text-muted-foreground" />
                {showStack ? "Hide Raw Trace" : "Inspect Stack Trace"}
              </button>

              <a
                href="/"
                className="inline-flex items-center gap-1.5 justify-center rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent cursor-pointer"
              >
                <Home className="size-3.5" />
                Go Back Home
              </a>
            </div>

            {showStack && (
              <div className="mt-5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    Developer Debug Diagnostic
                  </span>
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition font-medium cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        Copy Trace
                      </>
                    )}
                  </button>
                </div>
                <pre className="rounded-lg bg-muted/60 border border-border/80 p-4 font-mono text-[10px] leading-relaxed text-muted-foreground overflow-x-auto max-h-60 select-all custom-scrollbar">
                  {error.stack || "No additional call stack trace was captured."}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lumi Auto Mint" },
      {
        name: "description",
        content: "Multi-chain NFT mint scheduler, wallet management, and gas disperse dashboard.",
      },
      { name: "author", content: "Lumi" },
      { property: "og:title", content: "Lumi Auto Mint" },
      {
        property: "og:description",
        content: "Multi-chain NFT mint scheduler, wallet management, and gas disperse dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('lumi_theme') || 'dark';
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
