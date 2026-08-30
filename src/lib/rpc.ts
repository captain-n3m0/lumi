import {
  createPublicClient,
  http,
  fallback,
  type PublicClient,
  type Address,
  type Chain,
  parseAbi,
  formatEther,
} from "viem";
import { mainnet, base, arbitrum, optimism, polygon, bsc, blast, sepolia } from "viem/chains";

export interface ChainConfig {
  id: number;
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorer: string;
  chain: Chain;
}

export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  1: {
    id: 1,
    name: "Ethereum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: [
      "https://eth.llamarpc.com",
      "https://rpc.ankr.com/eth",
      "https://cloudflare-eth.com",
      "https://ethereum-rpc.publicnode.com",
    ],
    blockExplorer: "https://etherscan.io",
    chain: mainnet,
  },
  8453: {
    id: 8453,
    name: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: [
      "https://mainnet.base.org",
      "https://base.llamarpc.com",
      "https://base-rpc.publicnode.com",
      "https://1rpc.io/base",
    ],
    blockExplorer: "https://basescan.org",
    chain: base,
  },
  42161: {
    id: 42161,
    name: "Arbitrum One",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: [
      "https://arb1.arbitrum.io/rpc",
      "https://arbitrum.llamarpc.com",
      "https://arbitrum-one-rpc.publicnode.com",
    ],
    blockExplorer: "https://arbiscan.io",
    chain: arbitrum,
  },
  81457: {
    id: 81457,
    name: "Blast",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: [
      "https://rpc.blast.io",
      "https://blast.blockpi.network/v1/rpc/public",
      "https://blast-rpc.publicnode.com",
    ],
    blockExplorer: "https://blastscan.io",
    chain: blast,
  },
  137: {
    id: 137,
    name: "Polygon",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: [
      "https://polygon-rpc.com",
      "https://polygon.llamarpc.com",
      "https://polygon-bor-rpc.publicnode.com",
    ],
    blockExplorer: "https://polygonscan.com",
    chain: polygon,
  },
  10: {
    id: 10,
    name: "Optimism",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: [
      "https://mainnet.optimism.io",
      "https://optimism.llamarpc.com",
      "https://optimism-rpc.publicnode.com",
    ],
    blockExplorer: "https://optimistic.etherscan.io",
    chain: optimism,
  },
  56: {
    id: 56,
    name: "BNB Smart Chain",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: [
      "https://binance.llamarpc.com",
      "https://bsc-rpc.publicnode.com",
      "https://rpc.ankr.com/bsc",
    ],
    blockExplorer: "https://bscscan.com",
    chain: bsc,
  },
  11155111: {
    id: 11155111,
    name: "Sepolia Testnet",
    nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://rpc.sepolia.org", "https://ethereum-sepolia-rpc.publicnode.com"],
    blockExplorer: "https://sepolia.etherscan.io",
    chain: sepolia,
  },
};

const clientPool: Map<number, PublicClient> = new Map();

/**
 * Returns a Viem PublicClient backed by resilient fallback RPC transports
 */
export function getRpcClient(chainId: number = 1): PublicClient {
  if (clientPool.has(chainId)) {
    return clientPool.get(chainId)!;
  }

  const config = SUPPORTED_CHAINS[chainId] || SUPPORTED_CHAINS[1]!;
  const transports = config.rpcUrls.map((url) =>
    http(url, {
      timeout: 8_000,
      retryCount: 2,
    }),
  );

  const client = createPublicClient({
    chain: config.chain,
    transport: fallback(transports, { rank: true }),
  });

  clientPool.set(chainId, client);
  return client;
}

export interface OnChainContractInfo {
  address: Address;
  chainId: number;
  isContract: boolean;
  name?: string | undefined;
  symbol?: string | undefined;
  totalSupply?: bigint | undefined;
  standard?: "ERC721" | "ERC1155" | "ERC20" | "Custom" | undefined;
  mintPriceWei?: bigint | undefined;
  maxSupply?: bigint | undefined;
  owner?: Address | undefined;
}

const ERC_PROBE_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function owner() view returns (address)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
]);

/**
 * Queries the real live blockchain for contract existence, standard (ERC721/1155/20),
 * name, symbol, total supply, and bytecode.
 */
export async function queryOnChainContract(
  contractAddress: string,
  chainId: number = 1,
): Promise<OnChainContractInfo> {
  const address = contractAddress as Address;
  const client = getRpcClient(chainId);

  // 1. Verify Bytecode Existence
  const bytecode = await client.getBytecode({ address });
  const isContract = !!bytecode && bytecode !== "0x";

  if (!isContract) {
    return {
      address,
      chainId,
      isContract: false,
    };
  }

  // 2. Multicall / Parallel probe for metadata
  let name: string | undefined;
  let symbol: string | undefined;
  let totalSupply: bigint | undefined;
  let maxSupply: bigint | undefined;
  let owner: Address | undefined;
  let standard: "ERC721" | "ERC1155" | "ERC20" | "Custom" = "Custom";

  const [nameRes, symbolRes, supplyRes, maxRes, erc721Check, erc1155Check, erc20Check] =
    await Promise.allSettled([
      client.readContract({
        address,
        abi: ERC_PROBE_ABI,
        functionName: "name",
      }),
      client.readContract({
        address,
        abi: ERC_PROBE_ABI,
        functionName: "symbol",
      }),
      client.readContract({
        address,
        abi: ERC_PROBE_ABI,
        functionName: "totalSupply",
      }),
      client.readContract({
        address,
        abi: ERC_PROBE_ABI,
        functionName: "maxSupply",
      }),
      client.readContract({
        address,
        abi: ERC_PROBE_ABI,
        functionName: "supportsInterface",
        args: ["0x80ac58cd"], // ERC721 interface ID
      }),
      client.readContract({
        address,
        abi: ERC_PROBE_ABI,
        functionName: "supportsInterface",
        args: ["0xd9b67a26"], // ERC1155 interface ID
      }),
      client.readContract({
        address,
        abi: ERC_PROBE_ABI,
        functionName: "supportsInterface",
        args: ["0x36372b07"], // ERC20 interface ID
      }),
    ]);

  if (nameRes.status === "fulfilled" && typeof nameRes.value === "string") {
    name = nameRes.value;
  }
  if (symbolRes.status === "fulfilled" && typeof symbolRes.value === "string") {
    symbol = symbolRes.value;
  }
  if (supplyRes.status === "fulfilled" && typeof supplyRes.value === "bigint") {
    totalSupply = supplyRes.value;
  }
  if (maxRes.status === "fulfilled" && typeof maxRes.value === "bigint") {
    maxSupply = maxRes.value;
  }

  if (erc721Check.status === "fulfilled" && erc721Check.value === true) {
    standard = "ERC721";
  } else if (erc1155Check.status === "fulfilled" && erc1155Check.value === true) {
    standard = "ERC1155";
  } else if (erc20Check.status === "fulfilled" && erc20Check.value === true) {
    standard = "ERC20";
  } else if (name && symbol && totalSupply !== undefined) {
    standard = "ERC721";
  }

  return {
    address,
    chainId,
    isContract: true,
    name,
    symbol,
    totalSupply,
    maxSupply,
    standard,
    owner,
  };
}

/**
 * Fetch real wallet balance and gas fee estimates directly from on-chain RPC
 */
export async function getLiveWalletBalance(address: Address, chainId: number = 1) {
  const client = getRpcClient(chainId);
  const [balanceWei, gasPrice] = await Promise.all([
    client.getBalance({ address }),
    client.getGasPrice(),
  ]);

  return {
    balanceWei,
    balanceFormatted: formatEther(balanceWei),
    gasPriceWei: gasPrice,
  };
}
