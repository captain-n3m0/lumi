import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { EmptyState, SearchBar, UmiLayout } from "@/components/UmiLayout";

export const Route = createFileRoute("/wallets")({
  head: () => ({
    meta: [
      { title: "Wallets — Lumi" },
      {
        name: "description",
        content: "Generate, import, and track balances for all of your minting wallets in Lumi.",
      },
      { property: "og:title", content: "Wallets — Lumi" },
      {
        property: "og:description",
        content: "Generate, import, and track balances for all of your minting wallets.",
      },
    ],
  }),
  component: Wallets,
});

function Wallets() {
  return (
    <UmiLayout>
      <div className="flex flex-col gap-3">
        <SearchBar placeholder="Search wallets" />
        <EmptyState
          icon={CreditCard}
          title="No wallets yet"
          subtitle="Generate or import wallets to get started"
        />
      </div>
    </UmiLayout>
  );
}
