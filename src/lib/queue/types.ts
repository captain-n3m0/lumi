import type { EncryptedEnvelope } from "@/lib/crypto";

export type TaskStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type MintStage =
  "Scheduled" | "Fetching Payload" | "Broadcasting Tx" | "Confirmed" | "Failed";

export interface GasConfig {
  profile: "aggressive" | "normal" | "custom";
  /** gwei */
  maxFeePerGas: number;
  /** gwei — miner tip */
  maxPriorityFeePerGas: number;
  /** percentage headroom applied to the estimated base fee */
  slippageBps: number;
}

export interface MintJobData {
  taskId: string;
  userId: string;
  chainId: number;
  contractAddress: string;
  launchpadType: string;
  /** ms epoch; the poller fires at this instant */
  scheduledFor: number;
  phase: "public" | "whitelist";
  quantityPerWallet: number;
  gasConfig: GasConfig;
  /** Tier-2 ephemeral vault handle — secret travels with the job, keys do not. */
  vault: { taskSecret: string; envelope: EncryptedEnvelope };
}

export interface TaskLog {
  taskId: string;
  at: number;
  level: LogLevel;
  stage: MintStage;
  message: string;
}

export interface MintJobResult {
  taskId: string;
  status: TaskStatus;
  txHashes: string[];
  succeeded: number;
  failed: number;
}

export interface Job<T> {
  id: string;
  name: string;
  data: T;
  attemptsMade: number;
  opts: JobOptions;
  log: (level: LogLevel, stage: MintStage, message: string) => void;
}

export interface JobOptions {
  /** ms to wait before the job becomes runnable */
  delay?: number;
  attempts?: number;
  backoffMs?: number;
  jobId?: string;
}
