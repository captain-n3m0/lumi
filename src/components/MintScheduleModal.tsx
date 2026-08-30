import { useState, useEffect } from "react";
import { X, Clock, Zap, Check, Wallet, AlertCircle, Loader2 } from "lucide-react";
import type { OpenSeaCollection } from "@/lib/opensea";
import { addScheduledMint } from "@/lib/mintStore";
import { useWeb3Wallet } from "@/lib/useWeb3Wallet";
import { queryOnChainContract, type OnChainContractInfo } from "@/lib/rpc";
import type { Address } from "viem";

interface MintScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: OpenSeaCollection | null;
}

export function MintScheduleModal({ open, onOpenChange, collection }: MintScheduleModalProps) {
  const [walletsCount, setWalletsCount] = useState(3);
  const [quantity, setQuantity] = useState(1);
  const [gasPriority, setGasPriority] = useState<"aggressive" | "normal" | "custom">("aggressive");
  const [scheduleType, setScheduleType] = useState<"instant" | "custom">("instant");
  const [scheduleMinutes, setScheduleMinutes] = useState(0);
  const [success, setSuccess] = useState(false);
  const [isSigningDirect, setIsSigningDirect] = useState(false);
  const [directTxHash, setDirectTxHash] = useState<string | null>(null);
  const [directError, setDirectError] = useState<string | null>(null);
  const [contractDetails, setContractDetails] = useState<OnChainContractInfo | null>(null);

  const wallet = useWeb3Wallet();

  useEffect(() => {
    if (open) {
      setSuccess(false);
      setDirectTxHash(null);
      setDirectError(null);
      if (collection?.contractAddress) {
        queryOnChainContract(collection.contractAddress)
          .then(setContractDetails)
          .catch(() => {});
      }
    }
  }, [open, collection]);

  if (!open || !collection) return null;

  const handleSchedule = () => {
    const scheduledTime =
      scheduleType === "instant"
        ? Date.now() + 1000
        : Date.now() + Math.max(1, scheduleMinutes) * 60 * 1000;

    addScheduledMint({
      collectionName: collection.name,
      contractAddress: collection.contractAddress,
      chain: collection.chain || "ethereum",
      imageUrl: collection.imageUrl,
      stage: "Scheduled",
      scheduledTime,
      walletsCount,
      quantityPerWallet: quantity,
      gasPriority,
    });

    setSuccess(true);
    setTimeout(() => {
      onOpenChange(false);
      setSuccess(false);
    }, 1200);
  };

  const handleDirectSignAndMint = async () => {
    if (!wallet.isConnected) {
      await wallet.connectWallet();
      return;
    }

    setIsSigningDirect(true);
    setDirectError(null);

    try {
      const txHash = await wallet.sendMintTransaction({
        to: collection.contractAddress as Address,
        valueWei: 0n,
      });

      setDirectTxHash(txHash);

      addScheduledMint({
        collectionName: collection.name,
        contractAddress: collection.contractAddress,
        chain: collection.chain || "ethereum",
        imageUrl: collection.imageUrl,
        stage: "Confirmed",
        scheduledTime: Date.now(),
        walletsCount: 1,
        quantityPerWallet: quantity,
        gasPriority: "aggressive",
        txHash,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to sign & broadcast transaction";
      setDirectError(message);
    } finally {
      setIsSigningDirect(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-6 relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-border">
          {collection.imageUrl ? (
            <img
              src={collection.imageUrl}
              alt={collection.name}
              className="w-12 h-12 rounded-xl object-cover border border-border"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
              {collection.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground truncate">{collection.name}</h3>
            <p className="text-xs font-mono text-muted-foreground truncate">
              {collection.contractAddress}
            </p>
            {contractDetails && (
              <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-primary">
                <span>{contractDetails.standard || "EVM"}</span>
                {contractDetails.totalSupply !== undefined && (
                  <span>• Total Supply: {contractDetails.totalSupply.toString()}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Direct Wallet Transaction Status */}
        {directTxHash && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono flex items-center justify-between">
            <span>
              Mint Broadcasted: {directTxHash.slice(0, 8)}...{directTxHash.slice(-6)}
            </span>
            <a
              href={`https://etherscan.io/tx/${directTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-emerald-300"
            >
              View Explorer
            </a>
          </div>
        )}

        {directError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{directError}</span>
          </div>
        )}

        {/* Form Options */}
        <div className="mt-5 flex flex-col gap-4">
          {/* Wallets & Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Participating Wallets
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={walletsCount}
                onChange={(e) => setWalletsCount(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Quantity / Wallet</label>
              <input
                type="number"
                min={1}
                max={10}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Gas Profile */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Gas Execution Profile
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["aggressive", "normal", "custom"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setGasPriority(p)}
                  className={`capitalize py-2 text-xs rounded-xl border font-medium transition ${
                    gasPriority === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {p === "aggressive" && <Zap className="w-3.5 h-3.5" />}
                    {p}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Timing */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Drop Execution Timing
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScheduleType("instant")}
                className={`py-2 text-xs rounded-xl border font-medium transition ${
                  scheduleType === "instant"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                Instant Drop
              </button>
              <button
                type="button"
                onClick={() => setScheduleType("custom")}
                className={`py-2 text-xs rounded-xl border font-medium transition ${
                  scheduleType === "custom"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                <span className="flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Scheduled (Delay)
                </span>
              </button>
            </div>

            {scheduleType === "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={scheduleMinutes}
                  onChange={(e) => setScheduleMinutes(Number(e.target.value))}
                  placeholder="Minutes from now"
                  className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">mins delay</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2">
          {/* Direct Web3 Mint with Connected Wallet */}
          <button
            type="button"
            onClick={handleDirectSignAndMint}
            disabled={isSigningDirect}
            className="px-3 py-2 text-xs font-medium rounded-xl border border-primary/40 text-primary hover:bg-primary/10 transition flex items-center gap-1.5 cursor-pointer"
          >
            {isSigningDirect ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wallet className="w-3.5 h-3.5" />
            )}
            {wallet.isConnected ? "Sign & Mint (Connected Wallet)" : "Connect & Mint Direct"}
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm rounded-xl text-muted-foreground hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSchedule}
              disabled={success}
              className="px-5 py-2 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              {success ? (
                <>
                  <Check className="w-4 h-4" />
                  Scheduled!
                </>
              ) : (
                "Schedule Multi-Wallet Task"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
