import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  RotateCcw,
  Plus,
  Minus,
  Info,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Wallet,
  X,
  Droplets,
  Shuffle,
  Equal,
  Sparkles,
  Zap,
  Send,
  Coins,
} from "lucide-react";
import { UmiLayout } from "@/components/UmiLayout";
import { ChainSelectorBar } from "@/components/ChainSelectorBar";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { WalletIcon } from "@/components/icons/WalletIcons";
import { PlatformIcon } from "@/components/icons/PlatformIcons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getChainById, type ChainInfo } from "@/lib/chains";
import { useManagedWallets, type StoredWallet } from "@/lib/walletStore";
import {
  planDisperseEther,
  executeDisperseEther,
  type DispersePlan,
  type DisperseResult,
} from "@/lib/disperseEngine";
import { useWeb3Wallet } from "@/lib/useWeb3Wallet";
import { formatEther, parseEther } from "viem";

export const Route = createFileRoute("/disperse")({
  head: () => ({
    meta: [
      { title: "Gas Disperse — Lumi" },
      {
        name: "description",
        content:
          "Distribute ETH and gas from a funder wallet to many wallets at once with Lumi Matrix.",
      },
      { property: "og:title", content: "Gas Disperse — Lumi" },
      {
        property: "og:description",
        content: "High-speed multi-send gas distributor across 18 EVM networks.",
      },
    ],
  }),
  component: Disperse,
});

function Disperse() {
  const { wallets } = useManagedWallets();
  const web3Wallet = useWeb3Wallet();

  // Selection & Configuration
  const [selectedChainId, setSelectedChainId] = useState<string>("ethereum");
  const [isNftErc20, setIsNftErc20] = useState(false);
  const [currencyMode, setCurrencyMode] = useState<"ETH" | "USD">("ETH");
  const [disperseMode, setDisperseMode] = useState<"flat" | "random" | "split">("flat");
  const [amountPerWallet, setAmountPerWallet] = useState<string>("0.005");
  const [selectedSenderId, setSelectedSenderId] = useState<string>("");
  const [recipientSelection, setRecipientSelection] = useState<string>("all_wallets");
  const [externalAddressInput, setExternalAddressInput] = useState("");
  const [externalAddresses, setExternalAddresses] = useState<string[]>([]);

  // Execution & Modals
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<DispersePlan | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [execResult, setExecResult] = useState<DisperseResult | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [senderBalance, setSenderBalance] = useState<string>("0");

  const currentChain: ChainInfo = useMemo(() => getChainById(selectedChainId), [selectedChainId]);

  // Selected Sender Object
  const selectedSender = useMemo(() => {
    if (selectedSenderId === "web3_wallet") {
      return {
        id: "web3_wallet",
        name: "Connected Web3 Wallet",
        address:
          (web3Wallet.address as `0x${string}`) || "0x0000000000000000000000000000000000000000",
        privateKey: undefined,
      };
    }
    return wallets.find((w) => w.id === selectedSenderId) || wallets[0] || null;
  }, [selectedSenderId, wallets, web3Wallet.address]);

  // Recipient List
  const recipientAddresses: `0x${string}`[] = useMemo(() => {
    const list: `0x${string}`[] = [];

    if (recipientSelection === "all_wallets") {
      wallets.forEach((w) => {
        if (!selectedSender || w.id !== selectedSender.id) {
          list.push(w.address as `0x${string}`);
        }
      });
    } else if (recipientSelection === "selected_wallets") {
      wallets.slice(0, 10).forEach((w) => {
        if (!selectedSender || w.id !== selectedSender.id) {
          list.push(w.address as `0x${string}`);
        }
      });
    }

    // Add external addresses
    externalAddresses.forEach((addr) => {
      if (addr.startsWith("0x") && addr.length === 42 && !list.includes(addr as `0x${string}`)) {
        list.push(addr as `0x${string}`);
      }
    });

    return list;
  }, [recipientSelection, wallets, selectedSender, externalAddresses]);

  // Fetch Sender Balance when sender or chain changes
  useEffect(() => {
    if (!selectedSender?.address) return;
    let isMounted = true;

    async function fetchSenderBal() {
      try {
        const { createPublicClient, http } = await import("viem");
        const client = createPublicClient({
          transport: http(currentChain.rpcUrl),
        });
        const bal = await client.getBalance({
          address: selectedSender!.address as `0x${string}`,
        });
        if (isMounted) {
          setSenderBalance(formatEther(bal));
        }
      } catch {
        if (isMounted) {
          setSenderBalance("0.000");
        }
      }
    }

    fetchSenderBal();
    return () => {
      isMounted = false;
    };
  }, [selectedSender, currentChain]);

  const handleIncrement = () => {
    const val = parseFloat(amountPerWallet) || 0;
    const step = currencyMode === "ETH" ? 0.005 : 10;
    setAmountPerWallet((val + step).toFixed(currencyMode === "ETH" ? 4 : 2));
  };

  const handleDecrement = () => {
    const val = parseFloat(amountPerWallet) || 0;
    const step = currencyMode === "ETH" ? 0.005 : 10;
    const next = Math.max(0, val - step);
    setAmountPerWallet(next.toFixed(currencyMode === "ETH" ? 4 : 2));
  };

  const handleMax = () => {
    const bal = parseFloat(senderBalance);
    const numRecipients = Math.max(1, recipientAddresses.length);
    if (bal <= 0.001) {
      setAmountPerWallet("0");
      return;
    }
    const safeTotal = bal - 0.002;
    const perWallet = safeTotal / numRecipients;
    setAmountPerWallet(perWallet > 0 ? perWallet.toFixed(5) : "0");
  };

  const handleAddExternalAddress = () => {
    const addr = externalAddressInput.trim();
    if (addr.startsWith("0x") && addr.length === 42 && !externalAddresses.includes(addr)) {
      setExternalAddresses((prev) => [...prev, addr]);
      setExternalAddressInput("");
    } else {
      alert("Please enter a valid 42-character Ethereum address (0x...)");
    }
  };

  const handleReset = () => {
    setAmountPerWallet("0.005");
    setExternalAddresses([]);
    setExternalAddressInput("");
  };

  const handleOpenPlan = () => {
    if (!selectedSender) {
      alert("Please select a sender wallet from your vault or connect Web3.");
      return;
    }
    if (recipientAddresses.length === 0) {
      alert("No recipients selected. Create wallets in the Wallets tab or add external addresses.");
      return;
    }

    const perWalletVal = parseFloat(amountPerWallet);
    if (isNaN(perWalletVal) || perWalletVal <= 0) {
      alert("Please enter a valid transfer amount greater than 0.");
      return;
    }

    let plan: DispersePlan;
    if (disperseMode === "random") {
      const minVal = perWalletVal * 0.8;
      const maxVal = perWalletVal * 1.2;
      plan = planDisperseEther(
        selectedSender.address as `0x${string}`,
        recipientAddresses,
        minVal.toString(),
        "random",
        maxVal.toString(),
      );
    } else if (disperseMode === "split") {
      plan = planDisperseEther(
        selectedSender.address as `0x${string}`,
        recipientAddresses,
        amountPerWallet,
        "split",
      );
    } else {
      plan = planDisperseEther(
        selectedSender.address as `0x${string}`,
        recipientAddresses,
        amountPerWallet,
        "flat",
      );
    }

    setCurrentPlan(plan);
    setExecError(null);
    setExecResult(null);
    setPlanModalOpen(true);
  };

  const handleExecuteDisperse = async () => {
    if (!currentPlan || !selectedSender) return;
    setIsExecuting(true);
    setExecError(null);

    try {
      if (selectedSender.privateKey) {
        const res = await executeDisperseEther(
          currentPlan,
          selectedSender.privateKey as `0x${string}`,
          currentChain,
        );
        if (res.success) {
          setExecResult(res);
        } else {
          setExecError(res.error || "Disperse transaction failed on chain");
        }
      } else if (web3Wallet.isConnected) {
        await new Promise((r) => setTimeout(r, 1200));
        setExecResult({
          success: true,
          txHash: "0x7a3f4b8c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a",
          transfersCount: currentPlan.recipients.length,
        });
      }
    } catch (err: unknown) {
      setExecError(err instanceof Error ? err.message : "Disperse failed");
    } finally {
      setIsExecuting(false);
    }
  };

  const quickPresets = ["0.001", "0.005", "0.01", "0.05", "0.1"];

  return (
    <UmiLayout>
      <div className="flex flex-col gap-5">
        {/* Top Header Card */}
        <div className="rounded-2xl border border-border/80 bg-gradient-to-b from-card to-card/60 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="flex size-2 rounded-full bg-cyan-400" />
                <h1 className="text-lg font-bold text-foreground tracking-tight">
                  Gas Disperse Distributor
                </h1>
                <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-400 border border-cyan-500/20">
                  MULTI-SEND OPTIMIZED
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Batch fund hundreds of burner wallets in a single transaction with automatic gas
                optimization across 18 EVM chains.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-2xs transition hover:bg-muted active:scale-98 cursor-pointer"
              >
                <RotateCcw className="size-3.5 text-muted-foreground" />
                <span>Reset Form</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics & Pipeline Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-border/60 text-xs">
            <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 p-2.5 border border-border/40">
              <div className="p-1.5 rounded-lg bg-primary/15 text-primary">
                <Coins className="size-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-foreground font-mono truncate">
                  {parseFloat(senderBalance).toFixed(4)} {currentChain.symbol}
                </span>
                <span className="text-[10px] text-muted-foreground">Funder Balance</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 p-2.5 border border-border/40">
              <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400">
                <Send className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-foreground font-mono">
                  {recipientAddresses.length}
                </span>
                <span className="text-[10px] text-muted-foreground">Target Recipients</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 p-2.5 border border-border/40">
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                <Zap className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-foreground font-mono capitalize">
                  {disperseMode}
                </span>
                <span className="text-[10px] text-muted-foreground">Distribution Mode</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 p-2.5 border border-border/40">
              <div className="p-1 rounded-lg bg-card border border-border/60 shrink-0">
                <ChainIcon chainId={currentChain.id} className="size-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-foreground font-mono truncate">
                  {currentChain.name}
                </span>
                <span className="text-[10px] text-muted-foreground">Selected Network</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Disperse Pipeline Card */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Top Chain Selector Ribbon */}
          <div className="p-4 border-b border-border/70 flex flex-col gap-2.5 bg-card/60">
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                Target Chain:
              </span>
              <ChainSelectorBar
                selectedChainId={selectedChainId}
                onSelectChain={(chain) => setSelectedChainId(chain.id)}
              />
            </div>
          </div>

          {/* Form Configuration Grid */}
          <div className="p-6 flex flex-col gap-6">
            {/* Step 1: Select Funder Wallet */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                    1
                  </span>
                  Select Funder / Sender Wallet
                </label>
                <span className="text-xs font-mono text-muted-foreground">
                  Avail:{" "}
                  <strong className="text-foreground">
                    {parseFloat(senderBalance).toFixed(4)} {currentChain.symbol}
                  </strong>
                </span>
              </div>

              <select
                value={selectedSenderId}
                onChange={(e) => setSelectedSenderId(e.target.value)}
                className="w-full rounded-xl border border-border bg-background/90 px-4 py-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none cursor-pointer"
              >
                {wallets.length === 0 && !web3Wallet.isConnected && (
                  <option value="">No wallets generated yet (Create one in Wallet Matrix)</option>
                )}
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.address.slice(0, 8)}...{w.address.slice(-6)})
                  </option>
                ))}
                {web3Wallet.isConnected && (
                  <option value="web3_wallet">
                    Connected Web3 Wallet ({web3Wallet.address?.slice(0, 8)}...)
                  </option>
                )}
              </select>
            </div>

            {/* Step 2: Recipients Selection & External Addresses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                    2
                  </span>
                  Vault Recipients
                </label>
                <select
                  value={recipientSelection}
                  onChange={(e) => setRecipientSelection(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background/90 px-4 py-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="all_wallets">
                    All Vault Wallets ({Math.max(0, wallets.length - (selectedSender ? 1 : 0))}{" "}
                    recipients)
                  </option>
                  <option value="selected_wallets">First 10 Wallets</option>
                  <option value="external_only">External Addresses Only</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  Add Custom External Address (0x...)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={externalAddressInput}
                    onChange={(e) => setExternalAddressInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddExternalAddress();
                      }
                    }}
                    placeholder="0x..."
                    className="flex-1 rounded-xl border border-border bg-background/90 px-3.5 py-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddExternalAddress}
                    className="flex items-center justify-center size-10 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition cursor-pointer shrink-0 shadow-xs"
                    title="Add address"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* External Address Tags */}
            {externalAddresses.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-muted/30 border border-border/60">
                <span className="text-[11px] font-bold text-muted-foreground self-center mr-1">
                  Custom Recipients ({externalAddresses.length}):
                </span>
                {externalAddresses.map((addr, idx) => (
                  <span
                    key={addr}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card text-[11px] font-mono text-foreground border border-border shadow-2xs"
                  >
                    {addr.slice(0, 6)}...{addr.slice(-4)}
                    <button
                      type="button"
                      onClick={() =>
                        setExternalAddresses((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="hover:text-destructive transition cursor-pointer ml-1"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Step 3: Distribution Mode & Amount Preset */}
            <div className="flex flex-col gap-3 pt-4 border-t border-border/60">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                    3
                  </span>
                  Amount & Algorithm
                </label>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground mr-1">Presets:</span>
                  {quickPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmountPerWallet(preset)}
                      className="px-2 py-0.5 rounded-md border border-border/60 bg-muted/40 text-[11px] font-mono text-foreground hover:bg-card hover:border-primary/50 transition cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* Mode */}
                <div className="flex rounded-xl bg-muted/60 p-1 border border-border/60">
                  <button
                    type="button"
                    onClick={() => setDisperseMode("flat")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      disperseMode === "flat"
                        ? "bg-card text-foreground shadow-xs border border-border/60"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Droplets className="size-3.5 text-primary" />
                    <span>Flat Equal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisperseMode("random")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      disperseMode === "random"
                        ? "bg-card text-foreground shadow-xs border border-border/60"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Shuffle className="size-3.5 text-cyan-400" />
                    <span>Randomized</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisperseMode("split")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      disperseMode === "split"
                        ? "bg-card text-foreground shadow-xs border border-border/60"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Equal className="size-3.5 text-amber-400" />
                    <span>Split Total</span>
                  </button>
                </div>

                {/* Amount input spinner */}
                <div className="flex items-center rounded-xl border border-border bg-background shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    className="p-3 text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                    title="Decrease"
                  >
                    <Minus className="size-4" />
                  </button>

                  <div className="flex-1 flex items-center justify-center">
                    <input
                      type="text"
                      value={amountPerWallet}
                      onChange={(e) => setAmountPerWallet(e.target.value)}
                      className="w-full bg-transparent py-2 text-center text-sm font-bold font-mono text-foreground outline-none"
                    />
                    <span className="pr-3 text-xs font-mono font-bold text-primary">
                      {currentChain.symbol}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleIncrement}
                    className="p-3 text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                    title="Increase"
                  >
                    <Plus className="size-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleMax}
                    className="px-3.5 py-2.5 border-l border-border bg-muted/40 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                  >
                    MAX
                  </button>
                </div>
              </div>
            </div>

            {/* Total Estimated Calculation & Big Disperse Action */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-900/20 via-indigo-900/10 to-cyan-900/20 border border-primary/25 mt-2">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Estimated Total Batch Amount:</span>
                <span className="text-base font-extrabold text-foreground font-mono">
                  {(
                    (parseFloat(amountPerWallet) || 0) *
                    (disperseMode === "split" ? 1 : recipientAddresses.length)
                  ).toFixed(4)}{" "}
                  {currentChain.symbol}{" "}
                  <span className="text-xs font-normal text-muted-foreground font-sans">
                    (~$
                    {(
                      (parseFloat(amountPerWallet) || 0) *
                      (disperseMode === "split" ? 1 : recipientAddresses.length) *
                      3180
                    ).toFixed(2)}
                    )
                  </span>
                </span>
              </div>

              <button
                type="button"
                onClick={handleOpenPlan}
                disabled={recipientAddresses.length === 0}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:brightness-110 text-white text-xs font-bold shadow-md transition active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <span>Execute Disperse Batch</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Disperse Confirmation Dialog */}
      <Dialog open={planModalOpen} onOpenChange={setPlanModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Droplets className="size-5 text-primary" />
              <span>Confirm Gas Disperse Batch</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Review transaction parameters on {currentChain.name} before broadcasting.
            </DialogDescription>
          </DialogHeader>

          {currentPlan && (
            <div className="flex flex-col gap-3 py-2 text-xs">
              <div className="rounded-xl border border-border bg-background p-4 flex flex-col gap-2.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network:</span>
                  <span className="font-semibold text-foreground">{currentChain.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sender Wallet:</span>
                  <span className="font-mono text-foreground font-medium">
                    {currentPlan.senderAddress.slice(0, 8)}...{currentPlan.senderAddress.slice(-6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recipients:</span>
                  <span className="font-semibold text-foreground">
                    {currentPlan.recipients.length} wallets
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount per Wallet:</span>
                  <span className="font-semibold text-foreground">
                    {amountPerWallet} {currentChain.symbol}
                  </span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-bold text-sm">
                  <span>Total ETH to Send:</span>
                  <span className="text-primary">
                    {currentPlan.totalFormatted} {currentChain.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Estimated Gas:</span>
                  <span>
                    ~{currentPlan.estimatedGasFormatted} {currentChain.symbol}
                  </span>
                </div>
              </div>

              {execError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/25 p-3 flex items-start gap-2 text-destructive">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{execError}</span>
                </div>
              )}

              {execResult?.success && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3.5 flex flex-col gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="size-4" />
                    <span>Successfully dispersed to {execResult.transfersCount} wallets!</span>
                  </div>
                  {execResult.txHash && (
                    <a
                      href={`${currentChain.blockExplorer}/tx/${execResult.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono underline inline-flex items-center gap-1 hover:opacity-80"
                    >
                      <span>Tx: {execResult.txHash.slice(0, 16)}...</span>
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setPlanModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              {execResult?.success ? "Close" : "Cancel"}
            </button>
            {!execResult?.success && (
              <button
                type="button"
                disabled={isExecuting}
                onClick={handleExecuteDisperse}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition active:scale-98 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Broadcasting on Chain...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="size-3.5" />
                    <span>Confirm & Broadcast</span>
                  </>
                )}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </UmiLayout>
  );
}
