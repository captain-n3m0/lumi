/**
 * Mint queue worker.
 *
 * Pipeline per job:
 *   Scheduled -> Fetching Payload -> Broadcasting Tx -> Confirmed / Failed
 *
 * Wallets are processed in bounded parallel batches. Decrypted keys exist only
 * inside `withEphemeralKeys`, and the ephemeral vault entry is purged in a
 * `finally` regardless of outcome.
 */

import { redact, withEphemeralKeys, type VaultEntry } from "@/lib/crypto";
import { getAdapter, type MintPhase } from "@/lib/launchpads";
import { getRpcClient, SUPPORTED_CHAINS } from "@/lib/rpc";
import { createWalletClient, http, encodeFunctionData, parseAbi, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { purgeEphemeralVault } from "./ephemeralVault";
import { MINT_QUEUE_NAME, Queue } from "./queue";
import type { GasConfig, Job, MintJobData, MintJobResult } from "./types";

export const mintQueue = new Queue<MintJobData, MintJobResult>(MINT_QUEUE_NAME);

/** Max wallets broadcasting at once — keeps RPC pools from rate-limiting us. */
const CONCURRENCY = 10;

export interface GasFees {
  maxFeePerGasWei: bigint;
  maxPriorityFeePerGasWei: bigint;
}

const GWEI = 1_000_000_000n;

/** EIP-1559 fee resolution with slippage headroom on the base fee. */
export function resolveGasFees(config: GasConfig, baseFeeGwei: number): GasFees {
  const headroom = 1 + config.slippageBps / 10_000;
  const target = Math.ceil(baseFeeGwei * headroom) + config.maxPriorityFeePerGas;
  const capped = Math.min(target, config.maxFeePerGas);
  return {
    maxFeePerGasWei: BigInt(Math.max(capped, config.maxPriorityFeePerGas)) * GWEI,
    maxPriorityFeePerGasWei: BigInt(config.maxPriorityFeePerGas) * GWEI,
  };
}

/**
 * Broadcast one wallet's mint. Injected so the worker is testable and so the
 * Viem wallet-client implementation stays out of the pipeline logic.
 */
export type Broadcaster = (input: {
  entry: VaultEntry;
  chainId: number;
  contractAddress: string;
  functionName: string;
  args: unknown[];
  valueWei: bigint;
  fees: GasFees;
}) => Promise<string>;

const defaultBroadcaster: Broadcaster = async ({
  entry,
  chainId,
  contractAddress,
  functionName,
  args,
  valueWei,
  fees,
}) => {
  const chainConfig = SUPPORTED_CHAINS[chainId] || SUPPORTED_CHAINS[1];
  const rpcUrl = chainConfig?.rpcUrls[0] || "https://eth.llamarpc.com";
  const account = privateKeyToAccount(entry.privateKey as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: chainConfig?.chain,
    transport: http(rpcUrl, { timeout: 10_000 }),
  });

  let data: `0x${string}` | undefined;
  try {
    if (args && args.length === 1 && typeof args[0] === "number") {
      data = encodeFunctionData({
        abi: parseAbi([`function ${functionName}(uint256 quantity) external payable`]),
        functionName,
        args: [BigInt(args[0])],
      });
    } else if (args && args.length === 0) {
      data = encodeFunctionData({
        abi: parseAbi([`function ${functionName}() external payable`]),
        functionName,
        args: [],
      });
    }
  } catch {
    // If dynamic encoding fails, fallback to undefined
  }

  const hash = await client.sendTransaction({
    to: contractAddress as Address,
    data,
    value: valueWei,
    maxFeePerGas: fees.maxFeePerGasWei,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGasWei,
    chain: null,
  });

  return hash;
};

let broadcast: Broadcaster = defaultBroadcaster;

export function setBroadcaster(next: Broadcaster): void {
  broadcast = next;
}

async function runInBatches<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    results.push(...(await Promise.allSettled(batch.map(fn))));
  }
  return results;
}

export async function processMintJob(job: Job<MintJobData>): Promise<MintJobResult> {
  const { taskId, launchpadType, chainId, contractAddress, gasConfig, vault } = job.data;
  job.log("info", "Scheduled", `Task picked up (attempt ${job.attemptsMade + 1})`);

  try {
    const adapter = getAdapter(launchpadType);
    job.log("info", "Fetching Payload", `Resolving phase via ${adapter.label}`);

    const collection = await adapter.fetchCollection(`https://chain-${chainId}/${contractAddress}`);
    const phase: MintPhase | undefined = collection.phases.find((candidate) =>
      job.data.phase === "whitelist" ? candidate.kind === "whitelist" : candidate.kind === "public",
    );
    if (!phase) throw new Error(`No ${job.data.phase} phase available`);

    const gasPriceWei = await getRpcClient(chainId).getGasPrice();
    const fees = resolveGasFees(gasConfig, Number(gasPriceWei) / 1e9);

    const result = await withEphemeralKeys(vault, async (entries) => {
      job.log("info", "Broadcasting Tx", `Broadcasting from ${entries.length} wallet(s)`);

      const settled = await runInBatches(entries, CONCURRENCY, async (entry) => {
        const payload = await adapter.buildMintPayload({
          phase,
          address: entry.address,
          quantity: job.data.quantityPerWallet,
        });
        return broadcast({
          entry,
          chainId,
          contractAddress,
          functionName: payload.functionName,
          args: payload.args,
          valueWei: payload.valueWei,
          fees,
        });
      });

      const txHashes: string[] = [];
      let failed = 0;
      for (const outcome of settled) {
        if (outcome.status === "fulfilled") txHashes.push(outcome.value);
        else {
          failed += 1;
          job.log("warn", "Broadcasting Tx", redact(String(outcome.reason)));
        }
      }

      return {
        taskId,
        status: txHashes.length > 0 ? ("SUCCESS" as const) : ("FAILED" as const),
        txHashes,
        succeeded: txHashes.length,
        failed,
      };
    });

    job.log(
      result.status === "SUCCESS" ? "info" : "error",
      result.status === "SUCCESS" ? "Confirmed" : "Failed",
      `${result.succeeded} confirmed, ${result.failed} failed`,
    );
    return result;
  } catch (error) {
    job.log("error", "Failed", redact((error as Error).message));
    throw error;
  } finally {
    // Keys never outlive the job, on any path.
    purgeEphemeralVault(taskId);
  }
}

mintQueue.process(processMintJob);

/** Enqueue a task; a future timestamp becomes a delayed job (pre-mint poller). */
export async function scheduleMintTask(data: MintJobData) {
  return mintQueue.add("mint", data, {
    jobId: data.taskId,
    delay: Math.max(0, data.scheduledFor - Date.now()),
    attempts: 3,
    backoffMs: 750,
  });
}
