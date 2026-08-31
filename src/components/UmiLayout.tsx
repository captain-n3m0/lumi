import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  CreditCard,
  Send,
  HelpCircle,
  MessageCircle,
  ExternalLink,
  LogOut,
  Calculator,
  Sun,
  Moon,
  Loader2,
  Wallet,
  CheckCircle2,
  Zap,
  Activity,
  Search,
  Layers,
  Copy,
  Check,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import type { OpenSeaCollection } from "@/lib/opensea";
import { searchCollectionsUnified } from "@/lib/collectionSearch";
import { useWallet } from "@/hooks/useWallet";
import { useTheme } from "@/lib/theme";
import { EVM_CHAINS } from "@/lib/chains";
import { useManagedWallets } from "@/lib/walletStore";
import { useScheduledMints } from "@/lib/mintStore";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { PlatformIcon } from "@/components/icons/PlatformIcons";
import { WalletIcon } from "@/components/icons/WalletIcons";
import { ChainSelector } from "@/components/ChainSelector";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

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
      className={`relative h-5 w-9 shrink-0 rounded-full border border-border transition-colors cursor-pointer ${
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

export function LumiLogo({ className = "size-6" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md" fill="none">
        <defs>
          <linearGradient id="lumi-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id="lumi-grad-2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        {/* Luminous 8-point crystal star / prism */}
        <polygon
          points="50,6 61,37 94,40 68,61 77,94 50,75 23,94 32,61 6,40 39,37"
          fill="url(#lumi-grad-1)"
        />
        <circle cx="50" cy="50" r="14" fill="url(#lumi-grad-2)" opacity="0.9" />
        <polygon points="50,22 57,43 78,50 57,57 50,78 43,57 22,50 43,43" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

const navItems = [
  { to: "/", label: "Auto-Mints", icon: Zap },
  { to: "/wallets", label: "Wallet Matrix", icon: CreditCard },
  { to: "/disperse", label: "Gas Disperse", icon: Send },
] as const;

type WalletConnector = ReturnType<typeof useWallet>["connectors"][number];

function connectorWalletType(connector?: WalletConnector): string {
  const walletName = `${connector?.name ?? ""} ${connector?.id ?? ""}`.toLowerCase();

  if (walletName.includes("rabby")) return "rabby";
  if (walletName.includes("coinbase")) return "coinbase";
  if (walletName.includes("walletconnect")) return "walletconnect";
  if (walletName.includes("rainbow")) return "rainbow";
  if (walletName.includes("phantom")) return "phantom";
  if (walletName.includes("robinhood")) return "robinhood";
  if (walletName.includes("metamask") || walletName.includes("io.metamask")) return "metamask";

  return "wallet";
}

function connectorLabel(connector: WalletConnector): string {
  if (connector.id === "injected" && connector.name.toLowerCase() === "injected") {
    return "Browser wallet";
  }
  return connector.name || "Wallet";
}

function walletErrorMessage(error: unknown, fallback: string): string {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
  const lower = message.toLowerCase();

  if (lower.includes("rejected") || lower.includes("denied") || lower.includes("declined")) {
    return "Connection request rejected by wallet";
  }
  if (lower.includes("no web3 wallet") || lower.includes("connector")) {
    return "No wallet connector detected";
  }

  return message || fallback;
}

export function UmiLayout({ children }: { children: ReactNode }) {
  return <LumiLayout>{children}</LumiLayout>;
}

export function LumiLayout({ children }: { children: ReactNode }) {
  const [usd, setUsd] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcGasGwei, setCalcGasGwei] = useState("");
  const [calcEthPrice, setCalcEthPrice] = useState("");
  const [telemetryLoading, setTelemetryLoading] = useState(true);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [walletConnectError, setWalletConnectError] = useState<string | null>(null);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const { isDark, toggleTheme } = useTheme();
  const wallet = useWallet();
  const { wallets } = useManagedWallets();
  const [scheduledMints] = useScheduledMints();

  useEffect(() => {
    let isMounted = true;

    async function loadTelemetry() {
      try {
        const [gasRes, priceRes] = await Promise.all([
          fetch("/api/gas?chainId=1"),
          fetch("/api/market/eth-usd"),
        ]);

        if (gasRes.ok) {
          const gasData = (await gasRes.json()) as {
            gas?: Array<{ chainId: number; gasPriceGwei?: number | null; status: string }>;
          };
          const ethGas = gasData.gas?.find((item) => item.chainId === 1);
          if (isMounted) {
            setCalcGasGwei(
              ethGas?.status === "live" && typeof ethGas.gasPriceGwei === "number"
                ? String(ethGas.gasPriceGwei)
                : "",
            );
          }
        }

        if (priceRes.ok) {
          const priceData = (await priceRes.json()) as { priceUsd?: number };
          if (isMounted) {
            setCalcEthPrice(
              typeof priceData.priceUsd === "number" ? priceData.priceUsd.toFixed(2) : "",
            );
          }
        }
      } catch (err) {
        console.warn("Failed to load live telemetry:", err);
        if (isMounted) {
          setCalcGasGwei("");
          setCalcEthPrice("");
        }
      } finally {
        if (isMounted) {
          setTelemetryLoading(false);
        }
      }
    }

    loadTelemetry();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    function handleWalletMenuOutside(event: MouseEvent) {
      if (walletMenuRef.current && !walletMenuRef.current.contains(event.target as Node)) {
        setWalletMenuOpen(false);
      }
    }

    if (!walletMenuOpen) return undefined;
    document.addEventListener("mousedown", handleWalletMenuOutside);
    return () => document.removeEventListener("mousedown", handleWalletMenuOutside);
  }, [walletMenuOpen]);

  useEffect(() => {
    if (wallet.isConnected) {
      setWalletMenuOpen(false);
      setWalletConnectError(null);
    }
  }, [wallet.isConnected]);

  const copyAddress = () => {
    if (!wallet.address) return;
    navigator.clipboard.writeText(wallet.address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1500);
  };

  const formatFeeUsd = (gasUnits: number) => {
    const gasGwei = Number.parseFloat(calcGasGwei);
    const ethUsd = Number.parseFloat(calcEthPrice);
    if (!Number.isFinite(gasGwei) || gasGwei <= 0 || !Number.isFinite(ethUsd) || ethUsd <= 0) {
      return "--";
    }

    return `$${(gasUnits * gasGwei * 1e-9 * ethUsd).toFixed(3)}`;
  };

  const walletStatusError =
    walletConnectError ||
    (wallet.error ? walletErrorMessage(wallet.error, "Failed to connect wallet") : null);

  const handleWalletConnect = async (connectorId?: string) => {
    setWalletConnectError(null);
    wallet.clearError();

    try {
      await wallet.connect(connectorId);
      setWalletMenuOpen(false);
    } catch (err: unknown) {
      setWalletConnectError(walletErrorMessage(err, "Failed to connect wallet"));
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary selection:text-primary-foreground">
      {/* Top Luminous Header Navigation Dock */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Brand Logo & Tag */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-2.5 group transition-transform hover:scale-102"
            >
              <LumiLogo className="size-7" />
              <div className="flex flex-col leading-none">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black tracking-tight bg-gradient-to-r from-purple-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                    LUMI
                  </span>
                  <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-primary border border-primary/25">
                    MATRIX
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground/70 font-mono tracking-widest uppercase">
                  Multi-Chain Mint Terminal
                </span>
              </div>
            </Link>
          </div>

          {/* Center Navigation Capsule */}
          <nav className="hidden md:flex items-center gap-1 rounded-xl bg-muted/60 p-1 border border-border/60 shadow-2xs">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:text-foreground hover:bg-background/50 data-[status=active]:bg-card data-[status=active]:text-foreground data-[status=active]:shadow-xs data-[status=active]:border data-[status=active]:border-border/60"
              >
                <Icon className="size-3.5 text-primary" />
                <span>{label}</span>
                {to === "/" && scheduledMints.length > 0 && (
                  <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {scheduledMints.length}
                  </span>
                )}
                {to === "/wallets" && wallets.length > 0 && (
                  <span className="ml-0.5 flex px-1.5 h-4 items-center justify-center rounded-full bg-muted text-[10px] font-mono text-muted-foreground">
                    {wallets.length}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Right Action & Telemetry Hub */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Live Network & Gas Indicator */}
            <div className="hidden lg:flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs">
              <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[11px] text-muted-foreground">
                <span className="text-foreground font-semibold">{EVM_CHAINS.length}</span> EVM Nets
              </span>
              <span className="text-border">|</span>
              <button
                type="button"
                onClick={() => setCalcOpen(true)}
                className="flex items-center gap-1 font-mono text-[11px] text-amber-500 hover:text-amber-400 transition cursor-pointer"
                title="Open Gas Calculator"
              >
                {telemetryLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Activity className="size-3" />
                )}
                <span>{calcGasGwei ? `~${calcGasGwei} Gwei` : "Gas unavailable"}</span>
              </button>
            </div>

            {/* Currency Mode */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2 py-1">
              <Toggle checked={usd} onChange={setUsd} label="Show values in USD" />
              <span className="text-[11px] font-mono font-bold text-muted-foreground">USD</span>
            </div>

            {/* Calculator Trigger */}
            <button
              type="button"
              onClick={() => setCalcOpen(true)}
              aria-label="Gas calculator"
              className="grid size-8 place-items-center rounded-lg border border-border/80 bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer shadow-2xs"
              title="Gas Calculator"
            >
              <Calculator className="size-4" />
            </button>

            {/* Dark / Light Switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="grid size-8 place-items-center rounded-lg border border-border/80 bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer shadow-2xs"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? (
                <Moon className="size-4 text-cyan-400" />
              ) : (
                <Sun className="size-4 text-amber-500" />
              )}
            </button>

            {/* Real-time Chain Switcher */}
            <ChainSelector />

            {/* Web3 Wallet Connect */}
            {wallet.isConnected && wallet.address ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs shadow-2xs">
                <WalletIcon walletType={wallet.walletType || "wallet"} className="size-3.5" />
                <button
                  type="button"
                  onClick={copyAddress}
                  className="font-mono text-xs font-semibold text-foreground hover:text-primary transition flex items-center gap-1 cursor-pointer"
                  title="Click to copy address"
                >
                  <span>
                    {wallet.address.slice(0, 5)}...{wallet.address.slice(-4)}
                  </span>
                  {copiedAddr ? (
                    <Check className="size-3 text-emerald-400" />
                  ) : (
                    <Copy className="size-3 opacity-60" />
                  )}
                </button>
                <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground border-l border-primary/20 pl-1.5 ml-0.5">
                  {wallet.balance.isLoading ? "..." : wallet.balanceFormatted}{" "}
                  {wallet.balance.symbol}
                </span>
                <button
                  type="button"
                  onClick={() => setShowDisconnectConfirm(true)}
                  aria-label="Disconnect wallet"
                  className="text-muted-foreground hover:text-destructive transition ml-1 p-0.5 rounded cursor-pointer"
                  title="Disconnect"
                >
                  <LogOut className="size-3" />
                </button>
              </div>
            ) : (
              <div ref={walletMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setWalletConnectError(null);
                    wallet.clearError();
                    setWalletMenuOpen((open) => !open);
                  }}
                  disabled={wallet.isConnecting || wallet.isReconnecting}
                  aria-haspopup="menu"
                  aria-expanded={walletMenuOpen}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:brightness-110 active:scale-98 disabled:cursor-wait disabled:opacity-80 cursor-pointer"
                >
                  {wallet.isConnecting || wallet.isReconnecting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <WalletIcon walletType="wallet" className="size-3.5" />
                  )}
                  <span>
                    {wallet.isReconnecting
                      ? "Restoring..."
                      : wallet.isConnecting
                        ? "Connecting..."
                        : "Connect"}
                  </span>
                  <ChevronDown
                    className={`size-3 opacity-80 transition-transform ${walletMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {walletMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    <div className="border-b border-border/80 bg-muted/20 px-3 py-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                        <Wallet className="size-3.5 text-primary" />
                        <span>Connect wallet</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                        Choose an available EVM connector for live signing and transactions.
                      </p>
                    </div>

                    {walletStatusError && (
                      <div className="flex items-start gap-1.5 border-b border-destructive/20 bg-destructive/10 px-3 py-2 text-[11px] leading-snug text-destructive">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        <span>{walletStatusError}</span>
                      </div>
                    )}

                    <div className="p-1.5">
                      {wallet.connectors.length === 0 ? (
                        <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-3 text-[11px] leading-snug text-muted-foreground">
                          Install a browser wallet or enable Coinbase Wallet to connect.
                        </div>
                      ) : (
                        wallet.connectors.map((connector, index) => (
                          <button
                            key={`${connector.id}-${index}`}
                            type="button"
                            role="menuitem"
                            onClick={() => void handleWalletConnect(connector.id)}
                            disabled={wallet.isConnecting}
                            className="flex w-full items-center justify-between rounded-lg border border-transparent px-2.5 py-2 text-left text-xs transition hover:border-primary/20 hover:bg-muted/70 disabled:cursor-wait disabled:opacity-70 cursor-pointer"
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <WalletIcon
                                walletType={connectorWalletType(connector)}
                                className="size-4 shrink-0"
                              />
                              <span className="flex min-w-0 flex-col leading-tight">
                                <span className="truncate font-semibold text-foreground">
                                  {connectorLabel(connector)}
                                </span>
                                <span className="truncate text-[10px] font-mono text-muted-foreground">
                                  {connector.id === "injected"
                                    ? "Installed provider"
                                    : "External connector"}
                                </span>
                              </span>
                            </span>
                            {wallet.isConnecting ? (
                              <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                            ) : (
                              <ExternalLink className="size-3 shrink-0 text-muted-foreground/60" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Strip */}
        <div className="flex md:hidden items-center justify-around border-t border-border/60 bg-muted/40 p-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-muted-foreground transition data-[status=active]:text-primary"
            >
              <Icon className="size-3.5" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8">{children}</main>

      {/* Footer Info Strip */}
      <footer className="border-t border-border/60 bg-background/50 py-6 mt-auto">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <LumiLogo className="size-4" />
            <span className="font-semibold text-foreground">Lumi Matrix Engine</span>
            <span>•</span>
            <span>High-frequency EVM mint & gas distribution orchestration</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#faq" className="hover:text-foreground transition flex items-center gap-1">
              <HelpCircle className="size-3.5" />
              FAQ
            </a>
            <a
              href="https://discord.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition flex items-center gap-1"
            >
              <MessageCircle className="size-3.5" />
              Discord Support
              <ExternalLink className="size-2.5" />
            </a>
          </div>
        </div>
      </footer>

      {/* Gas Calculator Modal */}
      {calcOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Calculator className="size-4" />
                </div>
                <span>EVM Gas Fee Calculator</span>
              </div>
              <button
                type="button"
                onClick={() => setCalcOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer text-sm p-1 rounded-md hover:bg-muted"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-3 py-4 text-xs">
              <div>
                <label className="text-muted-foreground mb-1 block font-medium">
                  Gas Price (Gwei)
                </label>
                <input
                  type="number"
                  value={calcGasGwei}
                  onChange={(e) => setCalcGasGwei(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground font-mono outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block font-medium">
                  ETH Price (USD)
                </label>
                <input
                  type="number"
                  value={calcEthPrice}
                  onChange={(e) => setCalcEthPrice(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground font-mono outline-none focus:border-primary"
                />
              </div>
              <div className="rounded-xl bg-muted/40 p-3.5 flex flex-col gap-2 mt-1 border border-border/60">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Standard Transfer (21k gas):</span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatFeeUsd(21000)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">NFT Mint (~120k gas):</span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatFeeUsd(120000)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Disperse 10 Wallets (~300k gas):</span>
                  <span className="font-mono font-bold text-primary">{formatFeeUsd(300000)}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setCalcOpen(false)}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold cursor-pointer hover:opacity-90 transition shadow-xs"
              >
                Close Calculator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Wallet Disconnect Dialog */}
      <AlertDialog open={showDisconnectConfirm} onOpenChange={setShowDisconnectConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground font-bold tracking-tight flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <AlertTriangle className="size-4" />
              </span>
              <span>Confirm Disconnection</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs mt-2.5 leading-relaxed">
              Disconnecting your active wallet session will immediately suspend contract-level
              balance tracking, auto-refreshes, and ongoing automated interactions inside the
              matrix.
              <span className="block mt-2 font-semibold text-amber-500/90 bg-amber-500/5 border border-amber-500/15 p-2 rounded-md">
                Warning: Any pending high-frequency mint schedules or transaction dispatch sequences
                could be stalled.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel
              onClick={() => setShowDisconnectConfirm(false)}
              className="text-xs font-semibold cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowDisconnectConfirm(false);
                await wallet.disconnect();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold cursor-pointer"
            >
              Disconnect Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Zap,
  title,
  subtitle,
}: {
  icon?: typeof Zap;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center rounded-2xl border border-dashed border-border/80 bg-card/40 my-4">
      <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3">
        <Icon className="size-7" />
      </div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground max-w-sm">{subtitle}</p>
    </div>
  );
}

export function SearchBar({
  placeholder = "Search collection name, slug, or paste contract 0x...",
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

  const quickTags = [
    {
      label: "Ethereum",
      query: "ethereum",
      icon: <ChainIcon chainId="ethereum" className="size-3.5" />,
    },
    { label: "Base", query: "base", icon: <ChainIcon chainId="base" className="size-3.5" /> },
    {
      label: "Polygon",
      query: "polygon",
      icon: <ChainIcon chainId="polygon" className="size-3.5" />,
    },
    {
      label: "Arbitrum",
      query: "arbitrum",
      icon: <ChainIcon chainId="arbitrum" className="size-3.5" />,
    },
    { label: "Zora", query: "zora", icon: <PlatformIcon platform="zora" className="size-3.5" /> },
  ];

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const debounce = setTimeout(async () => {
      try {
        const res = await searchCollectionsUnified(query);
        if (isMounted) {
          setResults(res);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }, 180);

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
    <div ref={containerRef} className="relative flex w-full flex-col gap-3">
      {/* Search Input Box */}
      <div className="relative">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!query.trim()) return;
            const firstRes = results[0];
            if (firstRes && onSelect) {
              onSelect(firstRes);
              return;
            }
            try {
              setLoading(true);
              const found = await searchCollectionsUnified(query.trim());
              const firstFound = found[0];
              if (firstFound && onSelect) {
                onSelect(firstFound);
              }
            } finally {
              setLoading(false);
            }
          }}
          className={`flex items-center gap-3 rounded-2xl border bg-card/90 px-4 py-3 shadow-sm transition-all backdrop-blur-xs ${
            isFocused || query
              ? "border-primary ring-2 ring-primary/20 shadow-md"
              : "border-border hover:border-border/80"
          }`}
        >
          <Search className="size-4.5 text-muted-foreground shrink-0" />
          <input
            id="opensea-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            aria-label={placeholder}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs text-muted-foreground hover:text-foreground p-1 cursor-pointer"
            >
              ✕
            </button>
          )}
          {loading ? (
            <div className="grid size-7 shrink-0 place-items-center text-primary">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : (
            <button
              id="opensea-search-submit"
              type="submit"
              aria-label="Submit search"
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground transition hover:opacity-90 cursor-pointer shadow-xs"
            >
              <span>Find</span>
              <span aria-hidden>→</span>
            </button>
          )}
        </form>
      </div>

      {/* Quick Search Preset Tags */}
      {!query && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-[11px] font-medium text-muted-foreground/70 mr-1">
            Quick Suggestions:
          </span>
          {quickTags.map((tag) => (
            <button
              key={tag.label}
              type="button"
              onClick={() => setQuery(tag.query)}
              className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-primary/50 hover:bg-card hover:text-foreground cursor-pointer shadow-2xs"
            >
              {tag.icon}
              <span>{tag.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search Results List */}
      {query.trim().length > 0 && (
        <div className="flex flex-col gap-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
            <span>
              Matches for <strong className="text-foreground">"{query}"</strong>
            </span>
            <span>{loading ? "Searching live sources" : `${results.length} found`}</span>
          </div>

          {results.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm divide-y divide-border/50">
              {results.map((col) => (
                <div
                  key={col.contractAddress + col.name}
                  id={`collection-${col.collection}`}
                  onClick={() => onSelect?.(col)}
                  className="group flex items-center justify-between p-3.5 transition-colors hover:bg-muted/50 cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-muted border border-border/60">
                      {col.imageUrl ? (
                        <img
                          src={col.imageUrl}
                          alt={col.name}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-primary/10 text-xs font-bold text-primary">
                          {col.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 flex size-4 items-center justify-center rounded-tl-md bg-cyan-400 text-black">
                        <Sparkles className="size-2.5" />
                      </span>
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm truncate">
                          {col.name}
                        </span>
                        {col.openseaUrl && (
                          <a
                            href={col.openseaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground transition hover:text-foreground inline-flex items-center gap-1 text-[11px]"
                            title="View on OpenSea"
                          >
                            <PlatformIcon platform="opensea" className="size-3" />
                            <ExternalLink className="size-2.5" />
                          </a>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-2 text-xs font-mono text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-bold text-foreground border border-border/50 uppercase">
                          <ChainIcon chainId={col.chain || "ethereum"} className="size-3" />
                          <span>{col.chain}</span>
                        </span>
                        <span>•</span>
                        <span>{formatShortAddress(col.contractAddress)}</span>
                        {col.itemCount > 0 && (
                          <>
                            <span className="opacity-40">•</span>
                            <span className="text-foreground/80">
                              {col.itemCount.toLocaleString()} items
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect?.(col);
                    }}
                    className="shrink-0 flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground opacity-90 group-hover:opacity-100 transition shadow-xs cursor-pointer"
                  >
                    <Zap className="size-3" />
                    <span>Schedule</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            !loading && (
              <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                No live collections found for "{query}". You can also enter a direct smart contract
                address (0x...).
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
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-cyan-900/30 border border-primary/25 px-4 py-2.5 text-xs text-foreground shadow-2xs">
      <div className="flex items-center gap-2 font-medium">
        <Sparkles className="size-3.5 text-cyan-400 shrink-0" />
        <span>{text}</span>
      </div>
      <a
        href="https://discord.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold text-primary hover:underline flex items-center gap-1"
      >
        <span>{actionLabel}</span>
        <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
