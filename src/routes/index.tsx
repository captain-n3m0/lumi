import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Banner, EmptyState, SearchBar, UmiLayout } from "@/components/UmiLayout";
import { MintScheduleModal } from "@/components/MintScheduleModal";
import { ScheduledMintsList } from "@/components/ScheduledMintsList";
import { useScheduledMints } from "@/lib/mintStore";
import type { OpenSeaCollection } from "@/lib/opensea";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumi — Multi-chain NFT Mint Scheduler" },
      {
        name: "description",
        content:
          "Schedule NFT mints across chains, manage hundreds of wallets, and disperse gas from one simple dashboard.",
      },
      { property: "og:title", content: "Lumi — Multi-chain NFT Mint Scheduler" },
      {
        property: "og:description",
        content: "Schedule mints, manage wallets, and disperse gas from one simple dashboard.",
      },
    ],
  }),
  component: Mints,
});

function Mints() {
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<OpenSeaCollection | null>(null);
  const [scheduledMints] = useScheduledMints();

  const handleSelectCollection = (col: OpenSeaCollection) => {
    setSelectedCollection(col);
    setScheduleModalOpen(true);
  };

  return (
    <UmiLayout>
      <div className="flex flex-col gap-3">
        <Banner
          text="Mint didn't work? Found a bug? Please report it."
          actionLabel="Report an issue"
        />
        <SearchBar placeholder="Search" onSelect={handleSelectCollection} />

        {scheduledMints.length > 0 ? (
          <ScheduledMintsList />
        ) : (
          <EmptyState title="No mints found" subtitle="Once scheduled, they'll appear here" />
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
