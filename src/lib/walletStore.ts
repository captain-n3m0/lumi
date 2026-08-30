import { useState, useEffect } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { formatEther, type Address, createPublicClient, http } from "viem";
import { getChainById, type ChainInfo } from "@/lib/chains";

export interface StoredWallet {
  id: string;
  name: string;
  address: `0x${string}`;
  privateKey?: `0x${string}`; // stored locally for client-side execution/export
  createdAt: number;
  tags?: string[];
  balances?: Record<string, string>; // chainId -> formatted balance (e.g. "0.045")
}

const WALLETS_STORAGE_KEY = "lumi_managed_wallets";

export function loadStoredWallets(): StoredWallet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WALLETS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to load wallets from localStorage:", err);
    return [];
  }
}

export function saveStoredWallets(wallets: StoredWallet[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WALLETS_STORAGE_KEY, JSON.stringify(wallets));
    window.dispatchEvent(new Event("lumi_wallets_updated"));
  } catch (err) {
    console.error("Failed to save wallets to localStorage:", err);
  }
}

/**
 * Hook to reactively subscribe to managed wallets
 */
export function useManagedWallets() {
  const [wallets, setWallets] = useState<StoredWallet[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    const data = loadStoredWallets();
    setWallets(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const handleUpdate = () => refresh();
    window.addEventListener("lumi_wallets_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("lumi_wallets_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const addWallets = (newWallets: Omit<StoredWallet, "id" | "createdAt">[]) => {
    const current = loadStoredWallets();
    const prepared: StoredWallet[] = newWallets.map((w, index) => ({
      ...w,
      id: `w_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
    }));
    const merged = [...current, ...prepared];
    saveStoredWallets(merged);
    return prepared;
  };

  const updateWallet = (id: string, updates: Partial<StoredWallet>) => {
    const current = loadStoredWallets();
    const updated = current.map((w) => (w.id === id ? { ...w, ...updates } : w));
    saveStoredWallets(updated);
  };

  const deleteWallets = (ids: string[]) => {
    const idSet = new Set(ids);
    const current = loadStoredWallets();
    const updated = current.filter((w) => !idSet.has(w.id));
    saveStoredWallets(updated);
  };

  const clearAllWallets = () => {
    saveStoredWallets([]);
  };

  return {
    wallets,
    loading,
    addWallets,
    updateWallet,
    deleteWallets,
    clearAllWallets,
    refresh,
  };
}

/**
 * Generate N brand new EVM Wallets with cryptographically secure private keys
 */
export function generateEVMWallets(
  count: number,
  namePrefix: string = "Wallet",
  startIndex: number = 1,
): Array<{ name: string; address: `0x${string}`; privateKey: `0x${string}` }> {
  const results: Array<{ name: string; address: `0x${string}`; privateKey: `0x${string}` }> = [];

  for (let i = 0; i < count; i++) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    results.push({
      name: `${namePrefix} ${startIndex + i}`,
      address: account.address,
      privateKey,
    });
  }

  return results;
}

/**
 * Parse private keys from raw text string (one per line, with or without 0x)
 */
export function parsePrivateKeys(
  rawText: string,
  namePrefix: string = "Imported",
): Array<{ name: string; address: `0x${string}`; privateKey: `0x${string}` }> {
  const lines = rawText
    .split(/[\r\n,]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const results: Array<{ name: string; address: `0x${string}`; privateKey: `0x${string}` }> = [];

  lines.forEach((line, index) => {
    try {
      let key = line;
      if (!key.startsWith("0x")) {
        key = `0x${key}`;
      }
      if (key.length === 66 && /^0x[0-9a-fA-F]{64}$/.test(key)) {
        const privKey = key as `0x${string}`;
        const account = privateKeyToAccount(privKey);
        results.push({
          name: `${namePrefix} ${index + 1}`,
          address: account.address,
          privateKey: privKey,
        });
      }
    } catch {
      // ignore malformed line
    }
  });

  return results;
}

/**
 * Fetch on-chain balances for an array of wallet addresses on a specific chain
 */
export async function fetchChainBalancesForWallets(
  addresses: `0x${string}`[],
  chain: ChainInfo,
): Promise<Record<string, string>> {
  if (!addresses.length) return {};

  const balances: Record<string, string> = {};
  const rpcUrl = chain.rpcUrls[0];
  const client = createPublicClient({
    transport: http(rpcUrl, { timeout: 7000 }),
  });

  // Batch query with concurrency limit
  const batchSize = 10;
  for (let i = 0; i < addresses.length; i += batchSize) {
    const chunk = addresses.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async (address) => {
        try {
          const balance = await client.getBalance({ address: address as Address });
          balances[address.toLowerCase()] = parseFloat(formatEther(balance)).toFixed(4);
        } catch {
          balances[address.toLowerCase()] = "0.0000";
        }
      }),
    );
  }

  return balances;
}
