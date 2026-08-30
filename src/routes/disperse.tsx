import { createFileRoute } from "@tanstack/react-router";
import { Asterisk } from "lucide-react";
import { EmptyState, SearchBar, UmiLayout } from "@/components/UmiLayout";

export const Route = createFileRoute("/disperse")({
  head: () => ({
    meta: [
      { title: "Disperse — Lumi" },
      {
        name: "description",
        content: "Send gas from a funder wallet to many wallets at once with Lumi's disperse tool.",
      },
      { property: "og:title", content: "Disperse — Lumi" },
      {
        property: "og:description",
        content: "Send gas from a funder wallet to many wallets at once.",
      },
    ],
  }),
  component: Disperse,
});

function Disperse() {
  return (
    <UmiLayout>
      <div className="flex flex-col gap-3">
        <SearchBar placeholder="Funder wallet address" />
        <EmptyState
          icon={Asterisk}
          title="Nothing to disperse"
          subtitle="Pick a funder wallet to start a batch transfer"
        />
      </div>
    </UmiLayout>
  );
}
