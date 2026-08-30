import { EVM_CHAINS, type ChainInfo } from "@/lib/chains";
import { ChainIcon } from "./icons/ChainIcons";

export { ChainIcon } from "./icons/ChainIcons";

export interface ChainSelectorBarProps {
  selectedChainId: string;
  onSelectChain: (chain: ChainInfo) => void;
  className?: string;
}

export function ChainSelectorBar({
  selectedChainId,
  onSelectChain,
  className = "",
}: ChainSelectorBarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 p-1 ${className}`}>
      {EVM_CHAINS.map((chain) => {
        const isSelected = selectedChainId === chain.id;
        return (
          <button
            key={chain.id}
            type="button"
            onClick={() => onSelectChain(chain)}
            title={`${chain.name} (${chain.symbol})`}
            className={`group relative flex size-7 items-center justify-center rounded-lg border transition-all cursor-pointer ${
              isSelected
                ? "border-primary bg-primary/10 shadow-xs ring-2 ring-primary/30"
                : "border-border/60 bg-card/60 opacity-65 hover:border-border hover:bg-muted hover:opacity-100"
            }`}
          >
            {/* Authentic SVG Vector Icon for each Chain */}
            <ChainIcon chainId={chain.id} className="size-4" />

            {/* Testnet badge */}
            {chain.testnet && (
              <span className="absolute -top-1 -right-1 size-2 rounded-full bg-amber-500 ring-1 ring-background" />
            )}
          </button>
        );
      })}
    </div>
  );
}
