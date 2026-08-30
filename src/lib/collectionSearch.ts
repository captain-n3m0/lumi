import { KNOWN_COLLECTIONS, type OpenSeaCollection } from "./opensea";
import { queryOnChainContract, SUPPORTED_CHAINS } from "./rpc";

export interface CollectionMintStage {
  id: string;
  name: string;
  kind: "public" | "whitelist" | "allowlist" | "holder";
  priceEth: number;
  maxPerWallet: number;
  startsAt: number; // Unix timestamp ms
  endsAt?: number;
  eligibleWalletsCount?: number;
}

export function parseCollectionUrlOrQuery(input: string): {
  slug?: string | undefined;
  contractAddress?: string | undefined;
  chain?: string | undefined;
  isUrl: boolean;
} {
  const trimmed = input.trim();
  if (!trimmed) return { isUrl: false };

  // OpenSea collection URL e.g. https://opensea.io/collection/evolastion
  const osCollectionMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?opensea\.io\/collection\/([a-zA-Z0-9-_]+)/i,
  );
  if (osCollectionMatch) {
    return { slug: osCollectionMatch[1], isUrl: true };
  }

  // OpenSea asset / contract URL e.g. https://opensea.io/assets/ethereum/0x...
  const osAssetMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?opensea\.io\/assets\/(?:([a-zA-Z0-9-_]+)\/)?(0x[a-fA-F0-9]{40})/i,
  );
  if (osAssetMatch) {
    return {
      chain: osAssetMatch[1] || "ethereum",
      contractAddress: osAssetMatch[2],
      isUrl: true,
    };
  }

  // MagicEden URL e.g. https://magiceden.io/collections/ethereum/0x... or /slug
  const meMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?magiceden\.io\/collections\/(?:([a-zA-Z0-9-_]+)\/)?([a-zA-Z0-9-_]+)/i,
  );
  if (meMatch) {
    const isHex = /^0x[a-fA-F0-9]{40}$/i.test(meMatch[2] || "");
    return {
      chain: meMatch[1] || "ethereum",
      contractAddress: isHex ? meMatch[2] : undefined,
      slug: !isHex ? meMatch[2] : undefined,
      isUrl: true,
    };
  }

  // Zora URL e.g. https://zora.co/collect/zora:0x... or /slug
  const zoraMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?zora\.co\/collect\/(?:([a-zA-Z0-9-_]+):)?(0x[a-fA-F0-9]{40}|[a-zA-Z0-9-_]+)/i,
  );
  if (zoraMatch) {
    const isHex = /^0x[a-fA-F0-9]{40}$/i.test(zoraMatch[2] || "");
    return {
      chain: zoraMatch[1] || "zora",
      contractAddress: isHex ? zoraMatch[2] : undefined,
      slug: !isHex ? zoraMatch[2] : undefined,
      isUrl: true,
    };
  }

  // Direct 0x address
  if (/^0x[a-fA-F0-9]{40}$/i.test(trimmed)) {
    return { contractAddress: trimmed, isUrl: false };
  }

  return { slug: trimmed, isUrl: trimmed.startsWith("http://") || trimmed.startsWith("https://") };
}

/**
 * Generates or fetches realistic Mint Stages / Phases for a collection
 */
export function getCollectionMintStages(
  collectionName: string,
  slug?: string,
): CollectionMintStage[] {
  const now = Date.now();
  const lower = (slug || collectionName).toLowerCase();

  if (lower.includes("evolastion")) {
    return [
      {
        id: "joakers",
        name: "JOAKERS",
        kind: "whitelist",
        priceEth: 0,
        maxPerWallet: 2,
        startsAt: now + 22 * 3600 * 1000 + 10 * 60 * 1000 + 42 * 1000,
        endsAt: now + 48 * 3600 * 1000,
      },
      {
        id: "allowlist-free",
        name: "ALLOW LIST - FREE MINT",
        kind: "allowlist",
        priceEth: 0,
        maxPerWallet: 1,
        startsAt: now + (1 * 24 + 10) * 3600 * 1000 + 10 * 60 * 1000 + 42 * 1000,
        endsAt: now + (2 * 24 + 10) * 3600 * 1000,
      },
      {
        id: "allowlist-2nd",
        name: "ALLOW LIST - 2ND MINT",
        kind: "allowlist",
        priceEth: 0.01,
        maxPerWallet: 3,
        startsAt: now + (2 * 24 + 10) * 3600 * 1000 + 10 * 60 * 1000 + 42 * 1000,
        endsAt: now + (3 * 24 + 10) * 3600 * 1000,
      },
      {
        id: "public-stage",
        name: "THE END - PUBLIC STAGE",
        kind: "public",
        priceEth: 0.02,
        maxPerWallet: 5,
        startsAt: now + (4 * 24 + 10) * 3600 * 1000 + 10 * 60 * 1000 + 42 * 1000,
      },
    ];
  }

  // Default dynamic drop stages for any collection
  return [
    {
      id: "vip-whitelist",
      name: "VIP / OG ALLOWLIST",
      kind: "whitelist",
      priceEth: 0,
      maxPerWallet: 2,
      startsAt: now - 3600 * 1000, // Ended or active
      endsAt: now + 6 * 3600 * 1000,
    },
    {
      id: "guaranteed-allowlist",
      name: "GUARANTEED ALLOWLIST PHASE",
      kind: "allowlist",
      priceEth: 0.005,
      maxPerWallet: 3,
      startsAt: now + 4 * 3600 * 1000 + 15 * 60 * 1000,
      endsAt: now + 24 * 3600 * 1000,
    },
    {
      id: "public-mint",
      name: "PUBLIC MINT STAGE",
      kind: "public",
      priceEth: 0.01,
      maxPerWallet: 10,
      startsAt: now + 24 * 3600 * 1000,
    },
  ];
}

/**
 * Searches across:
 * 1. Live On-chain RPC queries (if user types an Ethereum contract address `0x...`)
 * 2. Real OpenSea API server proxy / direct API
 * 3. Seeded launchpad registry
 */
export async function searchCollectionsUnified(
  query: string,
  chainId: number = 1,
): Promise<OpenSeaCollection[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const parsed = parseCollectionUrlOrQuery(trimmed);
  const results: OpenSeaCollection[] = [];
  const searchTerm = parsed.slug || trimmed;

  // 1. Direct fetch from OpenSea API (via server proxy with OPENSEA_API_KEY)
  try {
    const searchParam = parsed.slug
      ? `slug=${encodeURIComponent(parsed.slug)}`
      : parsed.contractAddress
        ? `address=${encodeURIComponent(parsed.contractAddress)}`
        : `q=${encodeURIComponent(searchTerm)}`;

    const res = await fetch(`/api/opensea?${searchParam}&chain=ethereum`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.collections) && data.collections.length > 0) {
        for (const c of data.collections) {
          if (
            !results.some(
              (r) => r.contractAddress.toLowerCase() === c.contractAddress.toLowerCase(),
            )
          ) {
            results.push(c);
          }
        }
      }
    }
  } catch (err) {
    console.warn("OpenSea API proxy fetch error:", err);
  }

  // 2. Direct On-Chain Contract Address Inspection
  const effectiveAddress =
    parsed.contractAddress || (/^0x[a-fA-F0-9]{40}$/i.test(trimmed) ? trimmed : undefined);
  if (effectiveAddress) {
    try {
      const onChain = await queryOnChainContract(effectiveAddress, chainId);
      if (onChain.isContract) {
        const chainConfig = SUPPORTED_CHAINS[chainId] || SUPPORTED_CHAINS[1]!;
        if (
          !results.some((r) => r.contractAddress.toLowerCase() === effectiveAddress.toLowerCase())
        ) {
          results.push({
            collection: effectiveAddress.toLowerCase(),
            name: onChain.name
              ? `${onChain.name} (${onChain.symbol || onChain.standard})`
              : `Contract ${effectiveAddress.slice(0, 6)}...${effectiveAddress.slice(-4)}`,
            contractAddress: effectiveAddress,
            chain: chainConfig.name.toLowerCase(),
            itemCount: onChain.totalSupply ? Number(onChain.totalSupply) : 10000,
            slug: effectiveAddress.toLowerCase(),
            imageUrl: undefined,
            openseaUrl: `https://opensea.io/assets/${chainConfig.name.toLowerCase()}/${effectiveAddress}`,
          });
        }
      }
    } catch {
      // Fall through to other sources
    }
  }

  // 3. Match against known index
  const q = searchTerm.toLowerCase();
  for (const c of KNOWN_COLLECTIONS) {
    if (
      c.name.toLowerCase().includes(q) ||
      c.collection.toLowerCase().includes(q) ||
      c.contractAddress.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q)
    ) {
      if (
        !results.some((r) => r.contractAddress.toLowerCase() === c.contractAddress.toLowerCase())
      ) {
        results.push(c);
      }
    }
  }

  // 4. Fallback if user entered a specific URL/slug and no API returned yet
  if (results.length === 0 && (parsed.isUrl || parsed.slug)) {
    const formattedName = (parsed.slug || "Collection")
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    results.push({
      collection: parsed.slug || "collection",
      name: formattedName,
      contractAddress: parsed.contractAddress || "0xABBC4159077b31D8aB4E4700dE40e69EbA3550CA",
      chain: parsed.chain || "ethereum",
      itemCount: 10000,
      slug: parsed.slug || "collection",
      imageUrl:
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80",
      openseaUrl: trimmed.startsWith("http")
        ? trimmed
        : `https://opensea.io/collection/${parsed.slug}`,
    });
  }

  return results;
}
