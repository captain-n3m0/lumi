import { useState } from "react";
import { Download, Upload, Key, FileText, Check, AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { parsePrivateKeys, useManagedWallets } from "@/lib/walletStore";

export function ImportWalletModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addWallets } = useManagedWallets();
  const [activeTab, setActiveTab] = useState<"keys" | "file">("keys");
  const [rawKeys, setRawKeys] = useState("");
  const [namePrefix, setNamePrefix] = useState("Imported");
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const handleImport = () => {
    setError(null);
    if (!rawKeys.trim()) {
      setError("Please enter at least one valid 64-character private key");
      return;
    }

    setIsImporting(true);
    setTimeout(() => {
      try {
        const parsed = parsePrivateKeys(rawKeys, namePrefix.trim() || "Imported");
        if (!parsed.length) {
          setError("No valid 64-character hex private keys found in the input.");
          setIsImporting(false);
          return;
        }

        addWallets(parsed);
        setImportedCount(parsed.length);
        setTimeout(() => {
          setIsImporting(false);
          setImportedCount(null);
          setRawKeys("");
          onOpenChange(false);
        }, 900);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Import failed");
        setIsImporting(false);
      }
    }, 150);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawKeys(content);
        setActiveTab("keys");
      }
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Upload className="size-5 text-primary" />
            Import Wallets
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Paste private keys directly or upload a CSV/text file. Keys are validated and stored
            locally in your browser session.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="flex border-b border-border text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("keys")}
            className={`flex items-center gap-2 px-3.5 py-2 border-b-2 transition cursor-pointer ${
              activeTab === "keys"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Key className="size-3.5" />
            Private Keys
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("file")}
            className={`flex items-center gap-2 px-3.5 py-2 border-b-2 transition cursor-pointer ${
              activeTab === "file"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="size-3.5" />
            File Upload (CSV/TXT)
          </button>
        </div>

        <div className="flex flex-col gap-3.5 py-2">
          {activeTab === "keys" ? (
            <div>
              <label className="text-xs font-semibold text-foreground/80 mb-1.5 block">
                Paste Private Keys (one per line)
              </label>
              <textarea
                value={rawKeys}
                onChange={(e) => setRawKeys(e.target.value)}
                placeholder="0x4f3edf983ac636a65a842ce7c78d5aa706d3b113bce9c46f30d7d21715b23b1d&#10;0x6cbed15c793ce57650b9877cf5bab067843098a63c52fa1bcb09e864a74e9aee"
                rows={5}
                className="w-full font-mono text-xs rounded-lg border border-border bg-background p-2.5 text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 bg-background/50 hover:bg-muted/40 transition">
              <Upload className="size-8 text-muted-foreground/60 mb-2" />
              <p className="text-xs font-medium text-foreground">Upload CSV or TXT file</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Contains private keys in column 1 or line-by-line
              </p>
              <label className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 cursor-pointer transition">
                <input
                  type="file"
                  accept=".csv,.txt,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                Choose File
              </label>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-foreground/80 mb-1 block">
              Wallet Label Prefix
            </label>
            <input
              type="text"
              value={namePrefix}
              onChange={(e) => setNamePrefix(e.target.value)}
              placeholder="e.g. Imported, Funder, Burner"
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
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
            disabled={isImporting || importedCount !== null || !rawKeys.trim()}
            onClick={handleImport}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {isImporting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Importing...
              </>
            ) : importedCount !== null ? (
              <>
                <Check className="size-3.5 text-green-300" />
                Imported {importedCount} Wallets!
              </>
            ) : (
              <>
                <Upload className="size-3.5" />
                Import Wallets
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ExportWalletModal({
  open,
  onOpenChange,
  wallets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: Array<{ name: string; address: string; privateKey?: string }>;
}) {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const copyAddresses = () => {
    const text = wallets.map((w) => w.address).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedType("addresses");
    setTimeout(() => setCopiedType(null), 2000);
  };

  const copyKeys = () => {
    const text = wallets.map((w) => w.privateKey || "N/A").join("\n");
    navigator.clipboard.writeText(text);
    setCopiedType("keys");
    setTimeout(() => setCopiedType(null), 2000);
  };

  const downloadCSV = () => {
    const csvContent = [
      "Name,Address,Private Key",
      ...wallets.map((w) => `"${w.name}","${w.address}","${w.privateKey || ""}"`),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lumi_wallets_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadJSON = () => {
    const jsonContent = JSON.stringify(wallets, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lumi_wallets_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Download className="size-5 text-primary" />
            Export Wallets ({wallets.length})
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Save or copy wallet addresses and private keys for external bots, scripts, or backups.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2.5 py-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={copyAddresses}
              className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border bg-background hover:bg-muted transition text-xs font-medium cursor-pointer"
            >
              {copiedType === "addresses" ? (
                <Check className="size-4 text-green-500" />
              ) : (
                <FileText className="size-4 text-primary" />
              )}
              {copiedType === "addresses" ? "Copied Addresses!" : "Copy Addresses"}
            </button>

            <button
              type="button"
              onClick={copyKeys}
              className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border bg-background hover:bg-muted transition text-xs font-medium cursor-pointer"
            >
              {copiedType === "keys" ? (
                <Check className="size-4 text-green-500" />
              ) : (
                <Key className="size-4 text-amber-500" />
              )}
              {copiedType === "keys" ? "Copied Keys!" : "Copy Private Keys"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={downloadCSV}
              className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border bg-background hover:bg-muted transition text-xs font-medium cursor-pointer"
            >
              <Download className="size-4 text-blue-500" />
              Download CSV
            </button>

            <button
              type="button"
              onClick={downloadJSON}
              className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border bg-background hover:bg-muted transition text-xs font-medium cursor-pointer"
            >
              <Download className="size-4 text-purple-500" />
              Download JSON
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
