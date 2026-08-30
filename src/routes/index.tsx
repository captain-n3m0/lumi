import { createFileRoute } from "@tanstack/react-router";
import { Banner, EmptyState, SearchBar, UmiLayout } from "@/components/UmiLayout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Umi — Multi-chain NFT Mint Scheduler" },
      {
        name: "description",
        content:
          "Schedule NFT mints across chains, manage hundreds of wallets, and disperse gas from one simple dashboard.",
      },
      { property: "og:title", content: "Umi — Multi-chain NFT Mint Scheduler" },
      {
        property: "og:description",
        content: "Schedule mints, manage wallets, and disperse gas from one simple dashboard.",
      },
    ],
  }),
  component: Mints,
});

function Mints() {
  return (
    <UmiLayout>
      <div className="flex flex-col gap-3">
        <Banner
          text="Mint didn't work? Found a bug? Please report it."
          actionLabel="Report an issue"
        />
        <SearchBar placeholder="Search" />
        <EmptyState title="No mints founds" subtitle="Once scheduled, they'll appear here" />
      </div>
    </UmiLayout>
  );
}
