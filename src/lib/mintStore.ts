import { useSyncExternalStore, useState, useEffect } from "react";
import type { MintStage } from "./queue/types";

export interface ScheduledMint {
  id: string;
  collectionName: string;
  contractAddress: string;
  chain: string;
  imageUrl?: string;
  stage: MintStage;
  scheduledTime: number; // timestamp ms
  walletsCount: number;
  quantityPerWallet: number;
  gasPriority: "aggressive" | "normal" | "custom";
  txHash?: string;
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

  // Simulate lifecycle transitions
  const delay = Math.max(0, newMint.scheduledTime - Date.now());
  setTimeout(
    () => {
      updateMintStage(
        newMint.id,
        "Fetching Payload",
        "Resolving dynamic parameters & merkle proofs",
      );
      setTimeout(() => {
        updateMintStage(
          newMint.id,
          "Broadcasting Tx",
          "Broadcasting signed transactions to RPC nodes",
        );
        setTimeout(() => {
          const dummyTx = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
          updateMintStage(
            newMint.id,
            "Confirmed",
            `Confirmed on-chain with tx hash: ${dummyTx.slice(0, 10)}...`,
            dummyTx,
          );
        }, 2500);
      }, 2000);
    },
    Math.min(delay, 2000),
  );

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
