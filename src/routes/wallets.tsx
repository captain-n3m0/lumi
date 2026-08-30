import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  ArrowDownToLine,
  Search,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  ExternalLink,
  Key,
  CreditCard,
  ArrowUpDown,
  Download,
  Send,
  Loader2,
  Coins,
  ShieldCheck,
  Sparkles,
  Filter,
} from "lucide-react";
import { Banner, UmiLayout } from "@/components/UmiLayout";
import { ChainSelectorBar } from "@/components/ChainSelectorBar";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { PlatformIcon } from "@/components/icons/PlatformIcons";
import { CreateWalletModal } from "@/components/CreateWalletModal";
import { ImportWalletModal, ExportWalletModal } from "@/components/ImportWalletModal";
import { EVM_CHAINS, getChainById, type ChainInfo } from "@/lib/chains";
import {
  useManagedWallets,
  fetchChainBalancesForWallets,
  type StoredWallet,
} from "@/lib/walletStore";

export const Route = createFileRoute("/wallets")({
  head: () => ({
    meta: [
      { title: "Wallet Matrix — Lumi" },
      {
        name: "description",
        content:
          "Generate, import, and track multi-chain balances for hundreds of minting wallets in Lumi Matrix.",
      },
      { property: "og:title", content: "Wallet Matrix — Lumi" },
      {
        property: "og:description",
        content: "High-density multi-chain wallet management with instant balance synchronization.",
      },
    ],
  }),
  component: Wallets,
});

function Wallets() {
  const { wallets, loading, deleteWallets, updateWallet } = useManagedWallets();
  const [selectedChainId, setSelectedChainId] = useState<string>("ethereum");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "funded" | "empty">("all");
  const [selectedWalletIds, setSelectedWalletIds] = useState<Set<string>>(new Set());
  const [sortAsc, setSortAsc] = useState<boolean | null>(null);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Balances state
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [isFetchingBalances, setIsFetchingBalances] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [revealedKeyId, setRevealedKeyId] = useState<string | null>(null);

  const currentChain: ChainInfo = useMemo(() => getChainById(selectedChainId), [selectedChainId]);

  // Auto-fetch balances when chain or wallets change
  useEffect(() => {
    if (!wallets.length) return;
    let isMounted = true;
    setIsFetchingBalances(true);

    const addresses = wallets.map((w) => w.address);
    fetchChainBalancesForWallets(addresses, currentChain)
      .then((res) => {
        if (isMounted) {
          setBalances((prev) => ({ ...prev, ...res }));
        }
      })
      .catch((err) => console.warn("Failed to fetch balances:", err))
      .finally(() => {
        if (isMounted) setIsFetchingBalances(false);
      });

    return () => {
      isMounted = false;
    };
  }, [wallets, currentChain]);

  const handleRefreshBalances = async () => {
    if (!wallets.length) return;
    setIsFetchingBalances(true);
    try {
      const addresses = wallets.map((w) => w.address);
      const res = await fetchChainBalancesForWallets(addresses, currentChain);
      setBalances((prev) => ({ ...prev, ...res }));
    } finally {
      setIsFetchingBalances(false);
    }
  };

  // Aggregate stats
  const totalChainBalance = useMemo(() => {
    let sum = 0;
    for (const w of wallets) {
      const b = parseFloat(balances[w.address.toLowerCase()] || "0");
      if (!isNaN(b)) sum += b;
    }
    return sum;
  }, [wallets, balances]);

  const fundedCount = useMemo(() => {
    return wallets.filter((w) => {
      const b = parseFloat(balances[w.address.toLowerCase()] || "0");
      return b > 0;
    }).length;
  }, [wallets, balances]);

  // Filtered & Sorted Wallets
  const filteredWallets = useMemo(() => {
    let list = wallets.filter((w) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q || w.name.toLowerCase().includes(q) || w.address.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      const bal = parseFloat(balances[w.address.toLowerCase()] || "0");
      if (filterMode === "funded") return bal > 0;
      if (filterMode === "empty") return bal === 0;
      return true;
    });

    if (sortAsc !== null) {
      list = [...list].sort((a, b) => {
        const balA = parseFloat(balances[a.address.toLowerCase()] || "0");
        const balB = parseFloat(balances[b.address.toLowerCase()] || "0");
        return sortAsc ? balA - balB : balB - balA;
      });
    }

    return list;
  }, [wallets, searchQuery, filterMode, sortAsc, balances]);

  const toggleSelectAll = () => {
    if (selectedWalletIds.size === filteredWallets.length) {
      setSelectedWalletIds(new Set());
    } else {
      setSelectedWalletIds(new Set(filteredWallets.map((w) => w.id)));
    }
  };

  const toggleSelectWallet = (id: string) => {
    const next = new Set(selectedWalletIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedWalletIds(next);
  };

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleDeleteSelected = () => {
    if (!selectedWalletIds.size) return;
    if (confirm(`Are you sure you want to delete ${selectedWalletIds.size} wallet(s)?`)) {
      deleteWallets(Array.from(selectedWalletIds));
      setSelectedWalletIds(new Set());
    }
  };

  const selectedWalletObjects = useMemo(() => {
    return wallets.filter((w) => selectedWalletIds.has(w.id));
  }, [wallets, selectedWalletIds]);

  return (
    <UmiLayout>
      <div className="flex flex-col gap-5">
        {/* Top Header Card */}
        <div className="rounded-2xl border border-border/80 bg-gradient-to-b from-card to-card/60 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="flex size-2 rounded-full bg-purple-400" />
                <h1 className="text-lg font-bold text-foreground tracking-tight">
                  Wallet Matrix Vault
                </h1>
                <span className="rounded-md bg-purple-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-400 border border-purple-500/20">
                  AES-256 ISOLATED
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Manage burner wallets, mint executors, and synchronize balances across 18 EVM chains
                with private key backup.
              </p>
            </div>

            {/* Main Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md transition hover:brightness-110 active:scale-98 cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Create Wallets</span>
              </button>

              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-2xs transition hover:bg-muted active:scale-98 cursor-pointer"
              >
                <ArrowDownToLine className="size-3.5 text-primary" />
                <span>Import</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedWalletIds(new Set(wallets.map((w) => w.id)));
                  setExportOpen(true);
                }}
                disabled={wallets.length === 0}
                className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-2xs transition hover:bg-muted active:scale-98 cursor-pointer disabled:opacity-50"
                title="Export all wallets to CSV/JSON"
              >
                <Download className="size-3.5 text-muted-foreground" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-border/60 text-xs">
            <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 p-2.5 border border-border/40">
              <div className="p-1.5 rounded-lg bg-primary/15 text-primary">
                <CreditCard className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-foreground font-mono">{wallets.length}</span>
                <span className="text-[10px] text-muted-foreground">Total Wallets</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 p-2.5 border border-border/40">
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                <Coins className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-foreground font-mono truncate">
                  {totalChainBalance.toFixed(4)} {currentChain.symbol}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Total {currentChain.name} Balance
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 p-2.5 border border-border/40">
              <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400">
                <Sparkles className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-foreground font-mono">
                  {fundedCount}{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    / {wallets.length}
                  </span>
                </span>
                <span className="text-[10px] text-muted-foreground">Funded Wallets</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted/40 p-2.5 border border-border/40">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1 rounded-lg bg-card border border-border/60 shrink-0">
                  <ChainIcon chainId={currentChain.id} className="size-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-foreground capitalize text-[11px] truncate">
                    {currentChain.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    RPC: {currentChain.testnet ? "Testnet" : "Mainnet"}
                  </span>
                </div>
              </div>
              <Link
                to="/disperse"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:opacity-90 transition shadow-2xs shrink-0"
              >
                <Send className="size-2.5" />
                <span>Disperse</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Main Wallets Container */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Controls Bar: Chain Ribbon, Search & Filters */}
          <div className="p-4 border-b border-border/70 flex flex-col gap-3.5 bg-card/50">
            {/* Chain Selector */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                Chain Network:
              </span>
              <ChainSelectorBar
                selectedChainId={selectedChainId}
                onSelectChain={(chain) => setSelectedChainId(chain.id)}
              />
            </div>

            {/* Filter Pills & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-border/40">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    filterMode === "all"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({wallets.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("funded")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    filterMode === "funded"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Funded ({fundedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("empty")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    filterMode === "empty"
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Zero Balance ({wallets.length - fundedCount})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by label or address..."
                    className="w-full rounded-xl border border-border bg-background/90 pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleRefreshBalances}
                  disabled={isFetchingBalances}
                  className="p-2 rounded-xl border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer shrink-0"
                  title="Sync balances now"
                >
                  <RefreshCw
                    className={`size-3.5 ${isFetchingBalances ? "animate-spin text-primary" : ""}`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Batch Selection Action Bar (when wallets are selected) */}
          {selectedWalletIds.size > 0 && (
            <div className="bg-primary/10 border-b border-primary/25 px-4 py-2.5 flex items-center justify-between text-xs animate-in fade-in duration-100">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                <span>
                  {selectedWalletIds.size} of {filteredWallets.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition cursor-pointer"
                >
                  <Download className="size-3" />
                  <span>Export</span>
                </button>
                <Link
                  to="/disperse"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 transition cursor-pointer shadow-xs"
                >
                  <Send className="size-3" />
                  <span>Disperse Gas</span>
                </Link>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 transition cursor-pointer"
                >
                  <Trash2 className="size-3" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          )}

          {/* Wallets Table Header */}
          <div className="grid grid-cols-[40px_1fr_1.6fr_1fr] items-center px-4 py-3 border-b border-border/60 text-[11px] font-bold tracking-wider text-muted-foreground uppercase bg-muted/20">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={
                  filteredWallets.length > 0 && selectedWalletIds.size === filteredWallets.length
                }
                onChange={toggleSelectAll}
                className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
              />
            </div>
            <div className="px-2">LABEL / NAME</div>
            <div className="px-2">EVM ADDRESS</div>
            <div className="px-2 text-right flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => setSortAsc((prev) => (prev === null ? false : !prev))}
                className="inline-flex items-center gap-1 hover:text-foreground transition cursor-pointer"
                title="Sort by balance"
              >
                <span>BALANCE</span>
                <ArrowUpDown className="size-3" />
              </button>
            </div>
          </div>

          {/* Wallets List / Empty State */}
          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2 text-primary" />
              <span className="text-xs">Decrypting wallet matrix...</span>
            </div>
          ) : filteredWallets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-4">
              <div className="size-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-3">
                <CreditCard className="size-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {wallets.length === 0 ? "No wallets in vault yet" : "No matching wallets found"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {wallets.length === 0
                  ? "Generate burner wallets in bulk or import your existing private keys / mnemonics."
                  : "Try adjusting your search query or switching filter mode."}
              </p>
              {wallets.length === 0 && (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-90 transition cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Generate Wallets</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted transition cursor-pointer"
                  >
                    <ArrowDownToLine className="size-3.5" />
                    <span>Import Keys</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredWallets.map((wallet) => {
                const isSelected = selectedWalletIds.has(wallet.id);
                const rawBal = balances[wallet.address.toLowerCase()] || "0.0000";
                const isCopied = copiedAddress === wallet.address;
                const isKeyRevealed = revealedKeyId === wallet.id;
                const isFunded = parseFloat(rawBal) > 0;

                return (
                  <div
                    key={wallet.id}
                    className={`grid grid-cols-[40px_1fr_1.6fr_1fr] items-center px-4 py-3 text-xs transition-colors group ${
                      isSelected ? "bg-primary/10" : "hover:bg-muted/40"
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectWallet(wallet.id)}
                        className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                      />
                    </div>

                    {/* Name (Editable inline) */}
                    <div className="px-2 font-medium text-foreground truncate flex items-center gap-1.5">
                      <span
                        className={`size-2 rounded-full shrink-0 ${isFunded ? "bg-emerald-400" : "bg-muted-foreground/40"}`}
                      />
                      <input
                        type="text"
                        value={wallet.name}
                        onChange={(e) => updateWallet(wallet.id, { name: e.target.value })}
                        className="bg-transparent hover:bg-muted/60 focus:bg-background focus:ring-1 focus:ring-primary rounded px-1.5 py-0.5 w-full text-xs font-medium text-foreground outline-none transition truncate"
                      />
                    </div>

                    {/* Address with Copy & Explorer */}
                    <div className="px-2 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground min-w-0">
                      <span className="truncate text-foreground/90">
                        {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleCopy(wallet.address)}
                        className="text-muted-foreground/60 hover:text-foreground transition p-1 rounded cursor-pointer"
                        title="Copy address"
                      >
                        {isCopied ? (
                          <Check className="size-3 text-emerald-400" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>

                      <a
                        href={`${currentChain.blockExplorer}/address/${wallet.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground/60 hover:text-foreground transition p-1 rounded"
                        title="View on block explorer"
                      >
                        <ExternalLink className="size-3" />
                      </a>

                      {/* Export / Reveal Private Key Tool */}
                      {wallet.privateKey && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isKeyRevealed) setRevealedKeyId(null);
                            else setRevealedKeyId(wallet.id);
                          }}
                          className={`p-1 rounded transition cursor-pointer ${
                            isKeyRevealed
                              ? "text-amber-500 font-bold"
                              : "text-muted-foreground/40 hover:text-amber-500"
                          }`}
                          title={isKeyRevealed ? "Hide private key" : "View private key"}
                        >
                          <Key className="size-3" />
                        </button>
                      )}
                    </div>

                    {/* Balance */}
                    <div className="px-2 text-right font-mono font-bold text-foreground">
                      <span
                        className={`text-xs ${isFunded ? "text-emerald-400" : "text-muted-foreground"}`}
                      >
                        {rawBal} {currentChain.symbol}
                      </span>
                    </div>

                    {/* Revealed Private Key row (if toggled) */}
                    {isKeyRevealed && wallet.privateKey && (
                      <div className="col-span-4 mt-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-[11px] font-mono text-amber-600 dark:text-amber-400 animate-in fade-in">
                        <span className="truncate pr-2 font-mono">Key: {wallet.privateKey}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(wallet.privateKey!);
                            alert("Private key copied to clipboard!");
                          }}
                          className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 font-sans text-[10px] font-bold cursor-pointer transition"
                        >
                          Copy Key
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Table Footer Summary */}
          {wallets.length > 0 && (
            <div className="p-4 border-t border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <div>
                Displaying{" "}
                <span className="font-bold text-foreground">{filteredWallets.length}</span> of{" "}
                <span className="font-bold text-foreground">{wallets.length}</span> total vault
                wallets
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWalletIds(new Set(wallets.map((w) => w.id)));
                    setExportOpen(true);
                  }}
                  className="hover:text-foreground transition cursor-pointer font-medium"
                >
                  Export All (.csv / .json)
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleRefreshBalances}
                  disabled={isFetchingBalances}
                  className="inline-flex items-center gap-1.5 hover:text-foreground transition cursor-pointer font-medium"
                >
                  <RefreshCw
                    className={`size-3 ${isFetchingBalances ? "animate-spin text-primary" : ""}`}
                  />
                  Sync All Balances
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateWalletModal open={createOpen} onOpenChange={setCreateOpen} />
      <ImportWalletModal open={importOpen} onOpenChange={setImportOpen} />
      <ExportWalletModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        wallets={selectedWalletObjects.length > 0 ? selectedWalletObjects : wallets}
      />
    </UmiLayout>
  );
}
