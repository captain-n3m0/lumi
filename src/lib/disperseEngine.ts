import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  type Address,
  encodeFunctionData,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { type ChainInfo } from "@/lib/chains";

export interface DisperseRecipient {
  address: `0x${string}`;
  amountWei: bigint;
  amountFormatted: string;
}

export interface DispersePlan {
  senderAddress: `0x${string}`;
  recipients: DisperseRecipient[];
  totalWei: bigint;
  totalFormatted: string;
  estimatedGasWei: bigint;
  estimatedGasFormatted: string;
  chain: ChainInfo;
}

export interface DisperseResult {
  success: boolean;
  txHash?: string;
  error?: string;
  transfersCount: number;
}

// Disperse.app EVM Smart Contract ABI
const DISPERSE_ABI = parseAbi([
  "function disperseEther(address[] recipients, uint256[] values) external payable",
  "function disperseToken(address token, address[] recipients, uint256[] values) external",
]);

/**
 * Estimate gas and build disperse transfer plan
 */
export async function planDisperseEther({
  senderAddress,
  recipientAddresses,
  amountPerWalletEth,
  chain,
}: {
  senderAddress: `0x${string}`;
  recipientAddresses: `0x${string}`[];
  amountPerWalletEth: string;
  chain: ChainInfo;
}): Promise<DispersePlan> {
  const valuePerWallet = parseEther(amountPerWalletEth || "0");
  const recipients: DisperseRecipient[] = recipientAddresses.map((addr) => ({
    address: addr,
    amountWei: valuePerWallet,
    amountFormatted: amountPerWalletEth,
  }));

  const totalWei = valuePerWallet * BigInt(recipients.length);

  // Estimate gas (~21,000 gas per standard transfer or ~55,000 base for contract)
  const client = createPublicClient({
    transport: http(chain.rpcUrls[0], { timeout: 8000 }),
  });

  let estimatedGasWei = BigInt(0);
  try {
    const gasPrice = await client.getGasPrice();
    const gasUnits = BigInt(recipients.length * 28000 + 45000);
    estimatedGasWei = gasPrice * gasUnits;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "RPC gas query failed";
    throw new Error(`Unable to fetch live gas estimate for ${chain.name}: ${message}`);
  }

  return {
    senderAddress,
    recipients,
    totalWei,
    totalFormatted: formatEther(totalWei),
    estimatedGasWei,
    estimatedGasFormatted: formatEther(estimatedGasWei),
    chain,
  };
}

/**
 * Execute Disperse batch transfer using direct RPC / private key or connected Web3
 */
export async function executeDisperseEther({
  senderPrivateKey,
  recipients,
  chain,
}: {
  senderPrivateKey: `0x${string}`;
  recipients: DisperseRecipient[];
  chain: ChainInfo;
}): Promise<DisperseResult> {
  try {
    const account = privateKeyToAccount(senderPrivateKey);
    const walletClient = createWalletClient({
      account,
      chain: {
        id: chain.chainId,
        name: chain.name,
        nativeCurrency: { name: chain.symbol, symbol: chain.symbol, decimals: 18 },
        rpcUrls: { default: { http: chain.rpcUrls } },
      },
      transport: http(chain.rpcUrls[0]),
    });

    // Check if contract disperse is available
    if (chain.disperseContract && recipients.length > 2) {
      const addresses = recipients.map((r) => r.address);
      const values = recipients.map((r) => r.amountWei);
      const totalValue = values.reduce((acc, curr) => acc + curr, BigInt(0));

      const hash = await walletClient.sendTransaction({
        to: chain.disperseContract as Address,
        data: encodeFunctionData({
          abi: DISPERSE_ABI,
          functionName: "disperseEther",
          args: [addresses, values],
        }),
        value: totalValue,
      });

      return {
        success: true,
        txHash: hash,
        transfersCount: recipients.length,
      };
    }

    // Direct sequential fallback for 1-2 recipients or custom chains
    let lastHash = "";
    for (const recipient of recipients) {
      const hash = await walletClient.sendTransaction({
        to: recipient.address,
        value: recipient.amountWei,
      });
      lastHash = hash;
    }

    return {
      success: true,
      txHash: lastHash,
      transfersCount: recipients.length,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Disperse execution failed";
    console.error("Disperse error:", err);
    return {
      success: false,
      error: message,
      transfersCount: 0,
    };
  }
}
