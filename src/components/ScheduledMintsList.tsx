import { Trash2, CheckCircle2, Clock, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { useScheduledMints, type ScheduledMint } from "@/lib/mintStore";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { PlatformIcon } from "@/components/icons/PlatformIcons";

export function ScheduledMintsList() {
  const [mints, cancelMint] = useScheduledMints();

  if (mints.length === 0) {
    return null;
  }

  const getStageBadge = (stage: ScheduledMint["stage"]) => {
    switch (stage) {
      case "Scheduled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="size-3" />
            Scheduled
          </span>
        );
      case "Fetching Payload":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Loader2 className="size-3 animate-spin" />
            Resolving Proofs
          </span>
        );
      case "Broadcasting Tx":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Loader2 className="size-3 animate-spin" />
            Broadcasting
          </span>
        );
      case "Confirmed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3" />
            Confirmed
          </span>
        );
      case "Failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="size-3" />
            Failed
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-3 mt-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-foreground">
          Active & Scheduled Drops ({mints.length})
        </h3>
      </div>

      <div className="flex flex-col gap-2.5">
        {mints.map((mint) => (
          <div
            key={mint.id}
            className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-card shadow-xs transition hover:border-primary/40"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {mint.imageUrl ? (
                  <img
                    src={mint.imageUrl}
                    alt={mint.collectionName}
                    className="size-10 rounded-lg object-cover border border-border shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="size-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                    {mint.collectionName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground text-sm truncate">
                      {mint.collectionName}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border/40">
                      <ChainIcon chainId={mint.chain} className="size-3" />
                      <span className="capitalize">{mint.chain}</span>
                    </span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground truncate">
                    {mint.contractAddress}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {getStageBadge(mint.stage)}
                <button
                  type="button"
                  onClick={() => cancelMint(mint.id)}
                  className="text-muted-foreground/60 hover:text-rose-400 p-1.5 rounded-lg transition cursor-pointer"
                  title="Cancel / Remove Task"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>

            {/* Sub-info bar */}
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2.5">
              <div className="flex items-center gap-3">
                <span>{mint.walletsCount} wallets</span>
                <span>•</span>
                <span>{mint.quantityPerWallet} qty/wallet</span>
                <span>•</span>
                <span className="capitalize text-primary">{mint.gasPriority} Gas</span>
              </div>

              {mint.txHash ? (
                <span className="font-mono text-emerald-400 flex items-center gap-1">
                  <PlatformIcon platform="etherscan" className="size-3.5" />
                  Tx: {mint.txHash.slice(0, 6)}...{mint.txHash.slice(-4)}
                </span>
              ) : (
                <a
                  href={`https://opensea.io/assets/${mint.chain}/${mint.contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition"
                >
                  <PlatformIcon platform="opensea" className="size-3" />
                  <span>OpenSea</span>
                  <ExternalLink className="size-2.5" />
                </a>
              )}
            </div>

            {/* Recent Log message */}
            {mint.logs.length > 0 && (
              <div className="text-[11px] font-mono bg-muted/40 rounded-lg p-2 text-muted-foreground">
                <span className="text-foreground/70">
                  [{mint.logs[mint.logs.length - 1]!.time}]
                </span>{" "}
                {mint.logs[mint.logs.length - 1]!.message}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
