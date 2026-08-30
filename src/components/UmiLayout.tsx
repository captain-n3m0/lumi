import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Leaf,
  CreditCard,
  Asterisk,
  HelpCircle,
  MessageCircle,
  ExternalLink,
  LogOut,
  Calculator,
  Sun,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { searchOpenSea, type OpenSeaCollection } from "@/lib/opensea";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full border border-border transition-colors ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 size-3.5 rounded-full bg-card shadow-sm transition-all ${
          checked ? "left-[1.15rem]" : "left-0.5"
        }`}
      />
    </button>
  );
}

const nav = [
  { to: "/", label: "Mints", icon: Leaf },
  { to: "/wallets", label: "Wallets", icon: CreditCard },
  { to: "/disperse", label: "Disperse", icon: Asterisk },
] as const;

export function UmiLayout({ children }: { children: ReactNode }) {
  const [usd, setUsd] = useState(false);
  const [light, setLight] = useState(false);

  return (
    <div className="min-h-screen bg-background px-4 py-10 md:py-24">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 md:flex-row md:gap-12">
        <aside className="w-full shrink-0 md:w-52">
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="flex items-center gap-2 px-2 pb-4 pt-2">
              <span className="grid size-5 place-items-center rounded-full bg-primary/10">
                <Leaf className="size-3 text-primary" />
              </span>
              <span className="text-xl font-semibold tracking-tight text-foreground">umi</span>
            </div>

            <nav className="flex flex-col gap-0.5">
              {nav.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  activeOptions={{ exact: to === "/" }}
                  className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-[15px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:bg-muted data-[status=active]:font-medium data-[status=active]:text-foreground"
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
            </nav>

            <div className="mt-3 flex items-center justify-between border-t border-border px-1 pt-3">
              <div className="flex items-center gap-2">
                <Toggle checked={usd} onChange={setUsd} label="Show values in USD" />
                <span className="text-sm text-muted-foreground">USD</span>
              </div>
              <button
                type="button"
                aria-label="Gas calculator"
                className="grid size-7 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Calculator className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-card p-3 shadow-sm">
            {[
              { label: "FAQ", icon: HelpCircle },
              { label: "Support", icon: MessageCircle },
            ].map(({ label, icon: Icon }) => (
              <a
                key={label}
                href="#"
                className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-[15px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icon className="size-4" />
                <span className="flex-1">{label}</span>
                <ExternalLink className="size-3.5" />
              </a>
            ))}

            <div className="mt-2 flex items-center gap-3 border-t border-border px-1 pt-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                C
              </span>
              <div className="flex-1 leading-tight">
                <p className="text-sm text-foreground">Captain_n3m0</p>
                <p className="font-mono text-xs text-muted-foreground">0xFfb…1D421</p>
              </div>
              <button
                type="button"
                aria-label="Disconnect wallet"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 px-1">
            <Toggle checked={light} onChange={setLight} label="Toggle theme" />
            <Sun className="size-4 text-muted-foreground" />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Leaf,
  title,
  subtitle,
}: {
  icon?: typeof Leaf;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-28 text-center">
      <Icon className="size-8 text-muted-foreground/40" strokeWidth={1.5} />
      <h2 className="mt-4 text-lg text-muted-foreground/70">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground/60">{subtitle}</p>
    </div>
  );
}

export function SearchBar({
  placeholder = "Search",
  onSelect,
}: {
  placeholder?: string;
  onSelect?: (col: OpenSeaCollection) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OpenSeaCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const debounce = setTimeout(async () => {
      try {
        const res = await searchOpenSea(query);
        if (isMounted) {
          setResults(res);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(debounce);
    };
  }, [query]);

  const formatShortAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  return (
    <div ref={containerRef} className="relative flex w-full flex-col gap-2">
      {/* Search bar input container */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (results[0] && onSelect) {
            onSelect(results[0]);
          }
        }}
        className={`flex items-center gap-2 rounded-xl border bg-card p-2 pl-4 shadow-sm transition-all ${
          isFocused || query ? "border-primary ring-2 ring-primary/20" : "border-border"
        }`}
      >
        <input
          id="opensea-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          aria-label={placeholder}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70"
        />
        {loading ? (
          <div className="grid size-8 shrink-0 place-items-center text-primary">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : (
          <button
            id="opensea-search-submit"
            type="submit"
            aria-label="Submit"
            className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 cursor-pointer"
          >
            <span aria-hidden>→</span>
          </button>
        )}
      </form>

      {/* OpenSea Search Results List */}
      {query.trim().length > 0 && (
        <div className="flex flex-col gap-1.5 animate-in fade-in duration-150">
          <div className="px-1 text-xs font-normal text-muted-foreground/80">
            {results.length} results
          </div>

          {results.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card p-2 shadow-sm divide-y divide-border/40">
              {results.map((col) => (
                <div
                  key={col.contractAddress + col.name}
                  id={`collection-${col.collection}`}
                  onClick={() => onSelect?.(col)}
                  className="group flex items-center justify-between rounded-lg p-2.5 transition-colors hover:bg-muted/60 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Collection Avatar with green badge */}
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-muted border border-border/50">
                      {col.imageUrl ? (
                        <img
                          src={col.imageUrl}
                          alt={col.name}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-primary/10 text-sm font-semibold text-primary">
                          {col.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      {/* Signature green mint/leaf indicator pill */}
                      <span className="absolute bottom-0 right-0 flex size-4 items-center justify-center rounded-tl-md bg-[#9fff24] text-black shadow-xs">
                        <Sparkles className="size-2.5" />
                      </span>
                    </div>

                    {/* Metadata: Title, OpenSea external link, Contract Address, Item Count */}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground text-sm truncate">
                          {col.name}
                        </span>
                        {col.openseaUrl && (
                          <a
                            href={col.openseaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground transition hover:text-foreground inline-flex items-center"
                            title="View on OpenSea"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-2 text-xs font-mono text-muted-foreground">
                        <span>{formatShortAddress(col.contractAddress)}</span>
                        {col.itemCount > 0 && (
                          <>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="font-medium text-foreground/80">{col.itemCount}</span>
                            <span className="text-muted-foreground/70">items</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !loading && (
              <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                No OpenSea collections found for "{query}"
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function Banner({ text, actionLabel }: { text: string; actionLabel: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
      <span>{text}</span>
      <a href="#" className="font-medium underline underline-offset-2">
        {actionLabel}
      </a>
    </div>
  );
}
