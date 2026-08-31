export interface OpenSeaCollection {
  collection: string;
  name: string;
  contractAddress: string;
  chain: string;
  itemCount: number;
  slug: string;
  imageUrl?: string | undefined;
  openseaUrl: string;
  description?: string | undefined;
  verified?: boolean | undefined;
  isRealApi?: boolean | undefined;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function isValidEvmAddress(value: string | null | undefined): value is `0x${string}` {
  if (!value) return false;
  return EVM_ADDRESS_RE.test(value) && value.toLowerCase() !== ZERO_ADDRESS;
}

export function hasUsableContractAddress(
  collection: Pick<OpenSeaCollection, "contractAddress">,
): boolean {
  return isValidEvmAddress(collection.contractAddress);
}

export async function searchOpenSea(
  query: string,
  chain = "ethereum",
): Promise<OpenSeaCollection[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({ chain });
  if (isValidEvmAddress(trimmed)) {
    params.set("address", trimmed);
  } else {
    params.set("q", trimmed);
  }

  const res = await fetch(`/api/opensea?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`OpenSea search failed with status ${res.status}`);
  }

  const data = (await res.json()) as { collections?: OpenSeaCollection[] };
  return (data.collections ?? []).filter(hasUsableContractAddress);
}
