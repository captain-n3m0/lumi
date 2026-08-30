import { KNOWN_COLLECTIONS, type OpenSeaCollection } from "./opensea";
import { queryOnChainContract, SUPPORTED_CHAINS } from "./rpc";
import type { Address } from "viem";

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

  const results: OpenSeaCollection[] = [];

  // 1. Direct On-Chain Contract Address Inspection
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    try {
      const onChain = await queryOnChainContract(trimmed, chainId);
      if (onChain.isContract) {
        const chainConfig = SUPPORTED_CHAINS[chainId] || SUPPORTED_CHAINS[1]!;
        results.push({
          collection: trimmed.toLowerCase(),
          name: onChain.name
            ? `${onChain.name} (${onChain.symbol || onChain.standard})`
            : `Contract ${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`,
          contractAddress: trimmed,
          chain: chainConfig.name.toLowerCase(),
          itemCount: onChain.totalSupply ? Number(onChain.totalSupply) : 0,
          slug: trimmed.toLowerCase(),
          imageUrl: undefined,
          openseaUrl: `https://opensea.io/assets/${chainConfig.name.toLowerCase()}/${trimmed}`,
        });
      }
    } catch {
      // Fall through to other sources
    }
  }

  // 2. OpenSea Search (via server API proxy or direct)
  try {
    const qLower = encodeURIComponent(trimmed);
    const res = await fetch(`/api/opensea/search?q=${qLower}&chain=ethereum`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.collections)) {
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
  } catch {
    // API route may be unreachable in dev client mode, continue
  }

  // 3. Match against known index
  const q = trimmed.toLowerCase();
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

  return results;
}
