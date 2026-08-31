import { useState, useMemo, useRef, useEffect } from "react";
import { useAccount, useConfig } from "wagmi";
import { ChevronDown, Search, Check, AlertCircle, Sparkles, Activity, Loader2 } from "lucide-react";
import { EVM_CHAINS } from "@/lib/chains";
import { useWallet } from "@/hooks/useWallet";

export function ChainSelector() {
  const { isConnected, chainId: activeChainId } = useAccount();
  const { chains } = useConfig();
  const { switchChain, connect, isConnecting } = useWallet();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingChainId, setPendingChainId] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Clear error message after 4 seconds
  useEffect(() => {
    if (!errorMsg) return undefined;
    const t = setTimeout(() => setErrorMsg(null), 4000);
    return () => clearTimeout(t);
  }, [errorMsg]);

  // Match Wagmi chains with our EVM_CHAINS configuration to enrich visual assets
  const enrichedChains = useMemo(() => {
    return chains.map((c) => {
      const match = EVM_CHAINS.find((ec) => ec.chainId === c.id);
      return {
        id: c.id,
        name: c.name,
        nativeCurrency: c.nativeCurrency,
        testnet: !!c.testnet,
        // Fallbacks from EVM_CHAINS config if match is found
        shortName: match?.shortName || c.nativeCurrency?.symbol || "ETH",
        iconColor: match?.iconColor || "#94A3B8",
        bgActive: match?.bgActive || "bg-muted text-foreground border-border",
        blockExplorer: match?.blockExplorer || "",
      };
    });
  }, [chains]);

  // Find currently active chain info
  const activeChain = useMemo(() => {
    if (!isConnected || !activeChainId) return null;
    return (
      enrichedChains.find((c) => c.id === activeChainId) || {
        id: activeChainId,
        name: `Chain #${activeChainId}`,
        shortName: "UNSUPPORTED",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        testnet: false,
        iconColor: "#EF4444",
        bgActive: "bg-destructive/15 text-destructive border-destructive/40",
        blockExplorer: "",
      }
    );
  }, [activeChainId, isConnected, enrichedChains]);

  // Filter chains based on query
  const filteredChains = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return enrichedChains;
    return enrichedChains.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.shortName.toLowerCase().includes(query) ||
        c.id.toString().includes(query),
    );
  }, [enrichedChains, searchQuery]);

  const handleSwitch = async (chainId: number) => {
    if (isConnected && chainId === activeChainId) {
      setIsOpen(false);
      return;
    }

    const action = isConnected ? "switch" : "connect";
    setErrorMsg(null);
    setPendingChainId(chainId);

    try {
      if (action === "switch") {
        await switchChain(chainId);
      } else {
        await connect(undefined, chainId);
      }
      setIsOpen(false);
    } catch (err: unknown) {
      console.warn(`${action === "switch" ? "Switch chain" : "Connect wallet"} failed:`, err);
      const msg =
        err instanceof Error
          ? err.message
          : action === "switch"
            ? "Switch rejected by wallet"
            : "Connection rejected by wallet";
      const lower = msg.toLowerCase();

      if (lower.includes("rejected") || lower.includes("denied") || lower.includes("declined")) {
        setErrorMsg(
          action === "switch"
            ? "Switch request rejected by wallet"
            : "Connection request rejected by wallet",
        );
      } else if (lower.includes("no web3 wallet") || lower.includes("connector")) {
        setErrorMsg("No wallet connector detected");
      } else {
        setErrorMsg(action === "switch" ? "Failed to switch network" : "Failed to connect wallet");
      }
    } finally {
      setPendingChainId(null);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef} id="header-chain-selector">
      {/* Switcher Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-semibold select-none transition cursor-pointer shadow-2xs ${
          activeChain
            ? "border-border/60 bg-muted/20 hover:bg-muted/40 text-foreground"
            : "border-border/60 bg-card hover:bg-muted text-muted-foreground"
        }`}
        title={isConnected ? "Switch EVM Network" : "Select EVM Network"}
      >
        {activeChain ? (
          <>
            <span
              className="size-2 rounded-full shadow-[0_0_6px_var(--color-dot)]"
              style={
                {
                  backgroundColor: activeChain.iconColor,
                  // Custom CSS variable for shadow glowing
                  "--color-dot": activeChain.iconColor,
                } as React.CSSProperties
              }
            />
            <span className="font-medium tracking-tight">{activeChain.name}</span>
            {activeChain.testnet && (
              <span className="rounded bg-primary/20 px-1 py-0.2 text-[9px] font-mono uppercase tracking-wider text-primary border border-primary/20 scale-90">
                Test
              </span>
            )}
          </>
        ) : (
          <>
            <Sparkles className="size-3 text-primary" />
            <span>Select Network</span>
          </>
        )}
        <ChevronDown
          className={`size-3 text-muted-foreground/80 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-64 origin-top-right rounded-xl border border-border bg-popover text-popover-foreground shadow-lg focus:outline-hidden z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header & Filter input */}
          <div className="p-2 border-b border-border/80 bg-muted/20">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search 18+ EVM networks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border/70 bg-card py-1.5 pl-8 pr-3 text-xs outline-hidden placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                autoFocus
              />
            </div>
          </div>

          {!isConnected && (
            <div className="flex items-start gap-1.5 border-b border-primary/15 bg-primary/5 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>Choose a network, then approve the wallet connection on that chain.</span>
            </div>
          )}

          {/* Error notifications */}
          {errorMsg && (
            <div className="px-3 py-1.5 bg-destructive/10 border-b border-destructive/20 text-[11px] text-destructive-foreground flex items-center gap-1.5">
              <AlertCircle className="size-3.5 text-destructive shrink-0" />
              <span className="truncate">{errorMsg}</span>
            </div>
          )}

          {/* Scrollable Networks List */}
          <div className="max-h-60 overflow-y-auto p-1.5 custom-scrollbar">
            {filteredChains.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No supported networks found
              </div>
            ) : (
              filteredChains.map((c) => {
                const isActive = isConnected && activeChainId === c.id;
                const isPending = pendingChainId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSwitch(c.id)}
                    disabled={pendingChainId !== null || isConnecting}
                    title={isConnected ? `Switch to ${c.name}` : `Connect wallet on ${c.name}`}
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition select-none disabled:cursor-wait disabled:opacity-70 ${
                      isActive
                        ? "bg-primary/10 text-primary font-bold border border-primary/20 shadow-2xs"
                        : "hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-transparent cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: c.iconColor }}
                      />
                      <div className="flex flex-col leading-tight">
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground/80 font-mono">
                          ID: {c.id} • {c.nativeCurrency?.symbol || "ETH"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isPending ? (
                        <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                      ) : (
                        <>
                          {c.testnet && (
                            <span className="rounded bg-muted px-1 py-0.2 text-[9px] font-mono text-muted-foreground border border-border/80">
                              Testnet
                            </span>
                          )}
                          {isActive && <Check className="size-3.5 text-primary shrink-0" />}
                        </>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Quick status footer */}
          <div className="px-3 py-2 bg-muted/30 border-t border-border/60 text-[10px] text-muted-foreground flex items-center justify-between font-mono">
            <span className="flex items-center gap-1">
              <Activity className="size-2.5 text-emerald-400" />
              {isConnected ? "Live Synchronized" : "Wallet Required"}
            </span>
            <span>{enrichedChains.length} Active Configs</span>
          </div>
        </div>
      )}
    </div>
  );
}
