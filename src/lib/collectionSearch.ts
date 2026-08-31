import { EVM_CHAINS, getChainByChainId } from "./chains";
import { hasUsableContractAddress, isValidEvmAddress, type OpenSeaCollection } from "./opensea";
import { queryOnChainContract } from "./rpc";

export interface CollectionMintStage {
  id: string;
  name: string;
  kind: "public" | "whitelist" | "allowlist" | "holder";
  priceEth: number;
  maxPerWallet: number;
  startsAt: number;
  endsAt?: number;
  eligibleWalletsCount?: number;
  source?: "opensea" | "contract" | "manual";
  sourceLabel?: string;
}

export function parseCollectionUrlOrQuery(input: string): {
  slug?: string | undefined;
  contractAddress?: string | undefined;
  chain?: string | undefined;
  isUrl: boolean;
} {
  const trimmed = input.trim();
  if (!trimmed) return { isUrl: false };

  const osCollectionMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?opensea\.io\/collection\/([a-zA-Z0-9-_]+)/i,
  );
  if (osCollectionMatch) {
    return { slug: osCollectionMatch[1], isUrl: true };
  }

  const osAssetMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?opensea\.io\/assets\/(?:([a-zA-Z0-9-_]+)\/)?(0x[a-fA-F0-9]{40})/i,
  );
  if (osAssetMatch) {
    return {
      chain: normalizeChainSlug(osAssetMatch[1] || "ethereum"),
      contractAddress: osAssetMatch[2],
      isUrl: true,
    };
  }

  const meMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?magiceden\.io\/collections\/(?:([a-zA-Z0-9-_]+)\/)?([a-zA-Z0-9-_]+)/i,
  );
  if (meMatch) {
    const isHex = isValidEvmAddress(meMatch[2]);
    return {
      chain: normalizeChainSlug(meMatch[1] || "ethereum"),
      contractAddress: isHex ? meMatch[2] : undefined,
      slug: !isHex ? meMatch[2] : undefined,
      isUrl: true,
    };
  }

  const zoraMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?zora\.co\/collect\/(?:([a-zA-Z0-9-_]+):)?(0x[a-fA-F0-9]{40}|[a-zA-Z0-9-_]+)/i,
  );
  if (zoraMatch) {
    const isHex = isValidEvmAddress(zoraMatch[2]);
    return {
      chain: normalizeChainSlug(zoraMatch[1] || "zora"),
      contractAddress: isHex ? zoraMatch[2] : undefined,
      slug: !isHex ? zoraMatch[2] : undefined,
      isUrl: true,
    };
  }

  if (isValidEvmAddress(trimmed)) {
    return { contractAddress: trimmed, isUrl: false };
  }

  return { slug: trimmed, isUrl: trimmed.startsWith("http://") || trimmed.startsWith("https://") };
}

export function normalizeChainSlug(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-");
  const aliases: Record<string, string> = {
    eth: "ethereum",
    mainnet: "ethereum",
    matic: "polygon",
    polygon: "polygon",
    arbitrum: "arbitrum",
    "arbitrum-one": "arbitrum",
    optimism: "optimism",
    op: "optimism",
    bnb: "bsc",
    "bnb-chain": "bsc",
    "bnb-smart-chain": "bsc",
    binance: "bsc",
    avalanche: "avalanche",
    avax: "avalanche",
    zora: "zora",
    base: "base",
    blast: "blast",
    berachain: "berachain",
    sepolia: "sepolia",
    linea: "linea",
    scroll: "scroll",
    mantle: "mantle",
    mode: "mode",
    apechain: "apechain",
    sei: "sei",
    ink: "ink",
    monad: "monad",
    monadtestnet: "monad",
  };
  return aliases[normalized] || normalized;
}

function chainIdForSlug(slug: string | undefined, fallbackChainId: number): number {
  if (!slug) return fallbackChainId;
  return EVM_CHAINS.find((chain) => chain.id === slug)?.chainId ?? fallbackChainId;
}

function supplyToSafeNumber(value: bigint | undefined): number {
  if (value === undefined || value > BigInt(Number.MAX_SAFE_INTEGER)) return 0;
  return Number(value);
}

function pushUnique(results: OpenSeaCollection[], collection: OpenSeaCollection) {
  if (!hasUsableContractAddress(collection)) return;
  const address = collection.contractAddress.toLowerCase();
  if (results.some((item) => item.contractAddress.toLowerCase() === address)) return;
  results.push(collection);
}

export async function searchCollectionsUnified(
  query: string,
  chainId: number = 1,
): Promise<OpenSeaCollection[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const parsed = parseCollectionUrlOrQuery(trimmed);
  const results: OpenSeaCollection[] = [];
  const searchTerm = parsed.slug || trimmed;
  const normalizedChain = normalizeChainSlug(parsed.chain) || getChainByChainId(chainId).id;
  const effectiveChainId = chainIdForSlug(normalizedChain, chainId);

  try {
    const params = new URLSearchParams({ chain: normalizedChain });
    if (parsed.slug) {
      params.set("slug", parsed.slug);
    } else if (parsed.contractAddress) {
      params.set("address", parsed.contractAddress);
    } else {
      params.set("q", searchTerm);
    }

    const res = await fetch(`/api/opensea?${params.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as { collections?: OpenSeaCollection[] };
      for (const collection of data.collections ?? []) {
        pushUnique(results, collection);
      }
    }
  } catch (err) {
    console.warn("OpenSea API proxy fetch error:", err);
  }

  const effectiveAddress =
    parsed.contractAddress || (isValidEvmAddress(trimmed) ? trimmed : undefined);
  if (effectiveAddress) {
    try {
      const onChain = await queryOnChainContract(effectiveAddress, effectiveChainId);
      if (onChain.isContract) {
        const chain = getChainByChainId(effectiveChainId);
        pushUnique(results, {
          collection: effectiveAddress.toLowerCase(),
          name: onChain.name
            ? `${onChain.name}${onChain.symbol ? ` (${onChain.symbol})` : ""}`
            : `Contract ${effectiveAddress.slice(0, 6)}...${effectiveAddress.slice(-4)}`,
          contractAddress: effectiveAddress,
          chain: chain.id,
          itemCount: supplyToSafeNumber(onChain.totalSupply),
          slug: effectiveAddress.toLowerCase(),
          imageUrl: undefined,
          openseaUrl: `https://opensea.io/assets/${chain.id}/${effectiveAddress}`,
          isRealApi: false,
          verified: true,
        });
      }
    } catch (err) {
      console.warn("On-chain contract lookup failed:", err);
    }
  }

  return results;
}
