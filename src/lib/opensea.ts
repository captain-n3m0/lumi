export interface OpenSeaCollection {
  collection: string;
  name: string;
  contractAddress: string;
  chain: string;
  itemCount: number;
  slug: string;
  imageUrl?: string;
  openseaUrl: string;
}

export const KNOWN_COLLECTIONS: OpenSeaCollection[] = [
  {
    collection: "hoodwinked",
    name: "Hoodwinked",
    contractAddress: "0xC6089d38c644d6537bC6DF46AcE67ff9b9B8d9dD",
    chain: "ethereum",
    itemCount: 3000,
    slug: "hoodwinked",
    imageUrl:
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=128&auto=format&fit=crop&q=80",
    openseaUrl: "https://opensea.io/collection/hoodwinked",
  },
  {
    collection: "pudgypenguins",
    name: "Pudgy Penguins",
    contractAddress: "0xBd3531dA5CF5857e7CfAA92426877b022e612cf8",
    chain: "ethereum",
    itemCount: 8888,
    slug: "pudgypenguins",
    imageUrl:
      "https://images.unsplash.com/photo-1598439210625-5067c578f3f6?w=128&auto=format&fit=crop&q=80",
    openseaUrl: "https://opensea.io/collection/pudgypenguins",
  },
  {
    collection: "boredapeyachtclub",
    name: "Bored Ape Yacht Club",
    contractAddress: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
    chain: "ethereum",
    itemCount: 10000,
    slug: "boredapeyachtclub",
    imageUrl:
      "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=128&auto=format&fit=crop&q=80",
    openseaUrl: "https://opensea.io/collection/boredapeyachtclub",
  },
  {
    collection: "azuki",
    name: "Azuki",
    contractAddress: "0xED5AF388653567Af2F388E6224dC7C4b3241C544",
    chain: "ethereum",
    itemCount: 10000,
    slug: "azuki",
    imageUrl:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80",
    openseaUrl: "https://opensea.io/collection/azuki",
  },
  {
    collection: "doodles",
    name: "Doodles",
    contractAddress: "0x8a90CAb2b38dba80c64b7734e58Ee1dB38B8992e",
    chain: "ethereum",
    itemCount: 10000,
    slug: "doodles-official",
    imageUrl:
      "https://images.unsplash.com/photo-1563089145-599997674d42?w=128&auto=format&fit=crop&q=80",
    openseaUrl: "https://opensea.io/collection/doodles-official",
  },
  {
    collection: "hypurr-fun",
    name: "Hypurr Fun",
    contractAddress: "0x3Fa90f38E4e186640F8A5bE2e1531627c2937e89",
    chain: "hyperliquid",
    itemCount: 4200,
    slug: "hypurr-fun",
    imageUrl:
      "https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=128&auto=format&fit=crop&q=80",
    openseaUrl: "https://opensea.io/collection/hypurr-fun",
  },
];

export async function searchOpenSea(query: string): Promise<OpenSeaCollection[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matched = KNOWN_COLLECTIONS.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.collection.toLowerCase().includes(q) ||
      c.contractAddress.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q),
  );

  // If query is an Ethereum address
  if (
    /^0x[a-fA-F0-9]{40}$/.test(query.trim()) &&
    !matched.some((c) => c.contractAddress.toLowerCase() === query.trim().toLowerCase())
  ) {
    matched.unshift({
      collection: query.trim(),
      name: `Contract ${query.trim().slice(0, 6)}...${query.trim().slice(-4)}`,
      contractAddress: query.trim(),
      chain: "ethereum",
      itemCount: 1,
      slug: query.trim(),
      openseaUrl: `https://opensea.io/assets/ethereum/${query.trim()}`,
    });
  }

  // Attempt live OpenSea API search
  try {
    const res = await fetch(`https://api.opensea.io/api/v2/collections?chain=ethereum&limit=20`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        collections?: Array<{
          collection: string;
          name?: string;
          image_url?: string;
          contracts?: Array<{ address: string; chain: string }>;
          total_supply?: number;
          opensea_url?: string;
        }>;
      };
      if (data.collections) {
        for (const item of data.collections) {
          const name = item.name || item.collection;
          if (name.toLowerCase().includes(q) || item.collection.toLowerCase().includes(q)) {
            const contract =
              item.contracts?.[0]?.address || "0x0000000000000000000000000000000000000000";
            if (!matched.some((m) => m.contractAddress.toLowerCase() === contract.toLowerCase())) {
              matched.push({
                collection: item.collection,
                name,
                contractAddress: contract,
                chain: item.contracts?.[0]?.chain || "ethereum",
                itemCount: item.total_supply || 0,
                slug: item.collection,
                imageUrl: item.image_url,
                openseaUrl: item.opensea_url || `https://opensea.io/collection/${item.collection}`,
              });
            }
          }
        }
      }
    }
  } catch {
    // Ignore fetch error, fallback to matched
  }

  return matched;
}
