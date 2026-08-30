import { useSyncExternalStore, useState, useEffect } from "react";
import type { MintStage } from "./queue/types";
import { createPublicClient, http } from "viem";
import { EVM_CHAINS } from "./chains";

export interface ScheduledMint {
  id: string;
  collectionName: string;
  contractAddress: string;
  chain: string;
  imageUrl?: string | undefined;
  stage: MintStage;
  scheduledTime: number; // timestamp ms
  walletsCount: number;
  quantityPerWallet: number;
  gasPriority: "aggressive" | "normal" | "custom";
  txHash?: string | undefined;
  logs: Array<{ time: string; message: string; type: "info" | "warn" | "error" | "success" }>;
}

const STORAGE_KEY = "umi_scheduled_mints";

let listeners: Array<() => void> = [];
let memoryMints: ScheduledMint[] = [];
let isInitialized = false;

const emptyMints: ScheduledMint[] = [];

function initFromStorage() {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      memoryMints = JSON.parse(raw);
      // Resume monitoring for active, unconfirmed transactions with txHashes on load
      memoryMints.forEach((m) => {
        if (m.txHash && m.stage !== "Confirmed" && m.stage !== "Failed") {
          monitorOnChainTransaction(m.id, m.chain, m.txHash);
        }
      });
    }
  } catch {
    // fallback
  }
}

function notify() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryMints));
    } catch {
      // ignore
    }
  }
  listeners.forEach((l) => l());
}

/**
 * Monitors the transaction receipt on-chain using a public RPC client
 */
export function monitorOnChainTransaction(id: string, chainIdOrName: string, txHash: string) {
  const chain =
    EVM_CHAINS.find(
      (c) =>
        c.id.toLowerCase() === chainIdOrName.toLowerCase() ||
        c.name.toLowerCase() === chainIdOrName.toLowerCase() ||
        c.chainId.toString() === chainIdOrName,
    ) || EVM_CHAINS[0]!;

  const rpcUrl = chain.rpcUrls[0]!;
  const client = createPublicClient({
    transport: http(rpcUrl),
  });

  (async () => {
    try {
      updateMintStage(
        id,
        "Broadcasting Tx",
        `[RPC] Broadcasting transaction to ${chain.name} RPC nodes. Tx Hash: ${txHash.slice(0, 10)}...`,
        txHash,
      );

      const receipt = await client.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        timeout: 60000,
      });

      if (receipt.status === "success") {
        updateMintStage(
          id,
          "Confirmed",
          `[RPC] Confirmed on-chain in block ${receipt.blockNumber}! Gas used: ${receipt.gasUsed.toString()}`,
          txHash,
        );
      } else {
        updateMintStage(
          id,
          "Failed",
          `[RPC] Transaction reverted on-chain. Hash: ${txHash}`,
          txHash,
        );
      }
    } catch (err: unknown) {
      console.error("Failed to monitor tx:", err);
      try {
        const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
        if (tx && tx.blockNumber) {
          updateMintStage(
            id,
            "Confirmed",
            `[RPC] Transaction confirmed in block ${tx.blockNumber}.`,
            txHash,
          );
        } else {
          updateMintStage(
            id,
            "Failed",
            err instanceof Error ? err.message : "Transaction confirmation timed out or failed.",
            txHash,
          );
        }
      } catch {
        updateMintStage(id, "Failed", "Transaction confirmation timed out or failed.", txHash);
      }
    }
  })();
}

export function addScheduledMint(mint: Omit<ScheduledMint, "id" | "logs">): ScheduledMint {
  initFromStorage();

  const newMint: ScheduledMint = {
    ...mint,
    id: `mint_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    logs: [
      {
        time: new Date().toLocaleTimeString(),
        message: `Task scheduled for ${mint.collectionName} on ${mint.chain}`,
        type: "info",
      },
    ],
  };

  memoryMints = [newMint, ...memoryMints];
  notify();

  const delay = Math.max(0, newMint.scheduledTime - Date.now());

  if (newMint.txHash) {
    monitorOnChainTransaction(newMint.id, newMint.chain, newMint.txHash);
  } else {
    setTimeout(
      async () => {
        updateMintStage(
          newMint.id,
          "Fetching Payload",
          `[RPC] Connecting to ${newMint.chain} RPC node to verify contract status...`,
        );

        try {
          const chainConfig =
            EVM_CHAINS.find(
              (c) =>
                c.id.toLowerCase() === newMint.chain.toLowerCase() ||
                c.name.toLowerCase() === newMint.chain.toLowerCase(),
            ) || EVM_CHAINS[0]!;

          const rpcUrl = chainConfig.rpcUrls[0]!;
          const client = createPublicClient({
            transport: http(rpcUrl),
          });

          const bytecode = await client.getBytecode({
            address: newMint.contractAddress as `0x${string}`,
          });

          if (bytecode && bytecode !== "0x") {
            updateMintStage(
              newMint.id,
              "Broadcasting Tx",
              `[RPC] Contract verified on-chain at ${newMint.contractAddress}. Ready for wallet broadcast.`,
            );
          } else {
            updateMintStage(
              newMint.id,
              "Failed",
              `[RPC] Validation failed: No contract bytecode found at address ${newMint.contractAddress} on ${chainConfig.name}.`,
            );
          }
        } catch (err: unknown) {
          updateMintStage(
            newMint.id,
            "Failed",
            `[RPC] Failed to query contract status: ${err instanceof Error ? err.message : "Network error"}`,
          );
        }
      },
      Math.max(500, delay),
    );
  }

  return newMint;
}

export function updateMintStage(
  id: string,
  stage: MintStage,
  logMessage?: string,
  txHash?: string,
) {
  initFromStorage();
  memoryMints = memoryMints.map((m) => {
    if (m.id !== id) return m;
    const updated = { ...m, stage, txHash: txHash || m.txHash };
    if (logMessage) {
      updated.logs = [
        ...updated.logs,
        {
          time: new Date().toLocaleTimeString(),
          message: logMessage,
          type: stage === "Confirmed" ? "success" : stage === "Failed" ? "error" : "info",
        },
      ];
    }
    return updated;
  });
  notify();
}

export function cancelScheduledMint(id: string) {
  initFromStorage();
  memoryMints = memoryMints.filter((m) => m.id !== id);
  notify();
}

function subscribe(callback: () => void) {
  initFromStorage();
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

function getSnapshot(): ScheduledMint[] {
  initFromStorage();
  return memoryMints;
}

function getServerSnapshot(): ScheduledMint[] {
  return emptyMints;
}

export function useScheduledMints(): [ScheduledMint[], (id: string) => void] {
  const [mounted, setMounted] = useState(false);
  const mints = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    setMounted(true);
  }, []);

  return [mounted ? mints : emptyMints, cancelScheduledMint];
}
