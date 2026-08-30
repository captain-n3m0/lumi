import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Banner, EmptyState, SearchBar, UmiLayout } from "@/components/UmiLayout";
import { MintScheduleModal } from "@/components/MintScheduleModal";
import { ScheduledMintsList } from "@/components/ScheduledMintsList";
import { useScheduledMints } from "@/lib/mintStore";
import { useManagedWallets } from "@/lib/walletStore";
import type { OpenSeaCollection } from "@/lib/opensea";
import { Zap, ShieldCheck, Plus, Sparkles, Clock } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumi — Multi-Chain NFT Mint Scheduler & Sniper" },
      {
        name: "description",
        content:
          "High-speed automated multi-chain NFT mint scheduler, MEV protected gas execution, and mass wallet matrix in Lumi.",
      },
      { property: "og:title", content: "Lumi — Multi-Chain NFT Mint Scheduler & Sniper" },
      {
        property: "og:description",
        content: "Schedule mints, manage wallets, and disperse gas from one powerful terminal.",
      },
    ],
  }),
  component: Mints,
});

function Mints() {
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<OpenSeaCollection | null>(null);
  const [scheduledMints] = useScheduledMints();
  const { wallets } = useManagedWallets();

  const handleSelectCollection = (col: OpenSeaCollection) => {
    setSelectedCollection(col);
    setScheduleModalOpen(true);
  };

  const handleOpenCustomContract = () => {
    setSelectedCollection({
      collection: "custom",
      name: "Custom Smart Contract Mint",
      contractAddress: "0x",
      chain: "ethereum",
      openseaUrl: "",
      imageUrl: "",
      itemCount: 0,
      verified: false,
    });
    setScheduleModalOpen(true);
  };

  return (
    <UmiLayout>
      <div className="flex flex-col gap-5">
        {/* Top Hero Banner & Quick Actions */}
        <div className="rounded-2xl border border-border/80 bg-gradient-to-b from-card to-card/60 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="flex size-2 rounded-full bg-cyan-400 animate-ping" />
                <h1 className="text-lg font-bold text-foreground tracking-tight">
                  Auto-Mint Command Terminal
                </h1>
                <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-400 border border-cyan-500/20">
                  MEV SHIELD ACTIVE
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Automate public drops, whitelist phases, and custom contract mints with
                high-frequency execution across 18 chains.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCustomContract}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:brightness-110 active:scale-98 cursor-pointer shrink-0"
            >
              <Plus className="size-4" />
              <span>Custom Contract Mint</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-border/60 text-xs">
            <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 p-2.5 border border-border/40">
              <div className="p-1.5 rounded-lg bg-primary/15 text-primary">
                <Clock className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-foreground font-mono">{scheduledMints.length}</span>
                <span className="text-[10px] text-muted-foreground">Active Tasks</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 p-2.5 border border-border/40">
              <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400">
                <Zap className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-foreground font-mono">{wallets.length}</span>
                <span className="text-[10px] text-muted-foreground">Configured Wallets</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 p-2.5 border border-border/40">
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                <ShieldCheck className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-emerald-400 font-mono">Flashbots</span>
                <span className="text-[10px] text-muted-foreground">Private Mempool</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 p-2.5 border border-border/40">
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
                <Sparkles className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-foreground font-mono">18 Nets</span>
                <span className="text-[10px] text-muted-foreground">Multi-Chain Engine</span>
              </div>
            </div>
          </div>
        </div>

        <Banner
          text="Looking to snipe an upcoming launchpad drop or custom contract? Search below or enter any contract address."
          actionLabel="View Support Docs"
        />

        <SearchBar
          placeholder="Search collection name, slug, or paste contract 0x..."
          onSelect={handleSelectCollection}
        />

        {scheduledMints.length > 0 ? (
          <ScheduledMintsList />
        ) : (
          <EmptyState
            icon={Zap}
            title="No scheduled mint drops yet"
            subtitle="Search for an NFT collection or use 'Custom Contract Mint' to set up automated execution across your wallet matrix."
          />
        )}
      </div>

      <MintScheduleModal
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
        collection={selectedCollection}
      />
    </UmiLayout>
  );
}
