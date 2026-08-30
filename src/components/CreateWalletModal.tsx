import { useState } from "react";
import { Plus, Check, Loader2, Sparkles, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { generateEVMWallets, useManagedWallets } from "@/lib/walletStore";

export function CreateWalletModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addWallets, wallets } = useManagedWallets();
  const [count, setCount] = useState(1);
  const [namePrefix, setNamePrefix] = useState("Wallet");
  const [isGenerating, setIsGenerating] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const startIndex = wallets.length + 1;
        const generated = generateEVMWallets(count, namePrefix.trim() || "Wallet", startIndex);
        addWallets(generated);
        setSuccessCount(generated.length);
        setTimeout(() => {
          setIsGenerating(false);
          setSuccessCount(null);
          onOpenChange(false);
        }, 900);
      } catch (err) {
        console.error(err);
        setIsGenerating(false);
      }
    }, 150);
  };

  const presetCounts = [1, 5, 10, 25, 50];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Create Wallets
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Instantly generate fresh, cryptographically secure EVM wallets with private keys stored
            locally on your device.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div>
            <label className="text-xs font-semibold text-foreground/80 mb-1.5 block">
              Number of Wallets
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={250}
                value={count}
                onChange={(e) =>
                  setCount(Math.max(1, Math.min(250, parseInt(e.target.value) || 1)))
                }
                className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <div className="flex items-center gap-1.5">
                {presetCounts.map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCount(num)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition cursor-pointer ${
                      count === num
                        ? "bg-primary text-primary-foreground border-primary font-medium"
                        : "bg-muted text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    +{num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground/80 mb-1.5 block">
              Name Prefix
            </label>
            <input
              type="text"
              value={namePrefix}
              onChange={(e) => setNamePrefix(e.target.value)}
              placeholder="e.g. Sniper, Burner, Main"
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Wallets will be named:{" "}
              <span className="font-mono">
                {namePrefix} {wallets.length + 1}
              </span>
              ,{" "}
              <span className="font-mono">
                {namePrefix} {wallets.length + 2}
              </span>
              , etc.
            </p>
          </div>

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>
              Private keys are generated client-side using standard secp256k1 curves. You can export
              them anytime from the wallets table.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isGenerating || successCount !== null}
            onClick={handleGenerate}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Generating...
              </>
            ) : successCount !== null ? (
              <>
                <Check className="size-3.5 text-green-300" />
                Created {successCount} Wallets!
              </>
            ) : (
              <>
                <Plus className="size-3.5" />
                Generate {count} {count === 1 ? "Wallet" : "Wallets"}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
