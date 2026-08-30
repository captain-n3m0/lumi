/**
 * Launchpad interface layer — modular adapter pattern.
 *
 * Adding a launchpad means adding one object to `adapters`. The processor only
 * ever talks to `LaunchpadAdapter`, so nothing else changes.
 */

export interface MintPhase {
  id: string;
  name: string;
  kind: "public" | "whitelist";
  priceEth: number;
  maxPerWallet: number;
  startsAt: number;
}

export interface CollectionMetadata {
  name: string;
  chainId: number;
  contractAddress: string;
  phases: MintPhase[];
}

export interface MintPayload {
  /** ABI function to call on the collection contract. */
  functionName: string;
  args: unknown[];
  valueWei: bigint;
}

export interface LaunchpadAdapter {
  id: string;
  label: string;
  /** Does this adapter own the given URL? */
  matches: (url: string) => boolean;
  /** Pull collection + phase metadata from the launchpad. */
  fetchCollection: (url: string) => Promise<CollectionMetadata>;
  /** Which of the supplied wallets are whitelisted for a phase. */
  checkWhitelist: (phaseId: string, addresses: string[]) => Promise<string[]>;
  /** Build the calldata for one wallet, including any merkle proof/signature. */
  buildMintPayload: (input: {
    phase: MintPhase;
    address: string;
    quantity: number;
  }) => Promise<MintPayload>;
}

function hostMatcher(...hosts: string[]) {
  return (url: string) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      return hosts.some((h) => host === h || host.endsWith(`.${h}`));
    } catch {
      return false;
    }
  };
}

/** Shared skeleton so each adapter only overrides what differs. */
function createAdapter(
  id: string,
  label: string,
  matches: (url: string) => boolean,
  overrides: Partial<LaunchpadAdapter> = {},
): LaunchpadAdapter {
  return {
    id,
    label,
    matches,
    fetchCollection: async (url: string) => {
      throw new Error(`${label}: metadata fetch not configured for ${url}`);
    },
    checkWhitelist: async () => [],
    buildMintPayload: async ({ quantity }) => ({
      functionName: "mint",
      args: [quantity],
      valueWei: 0n,
    }),
    ...overrides,
  };
}

export const adapters: LaunchpadAdapter[] = [
  createAdapter("opensea", "OpenSea", hostMatcher("opensea.io")),
  createAdapter("rarible", "Rarible", hostMatcher("rarible.com")),
  createAdapter("mintify", "Mintify", hostMatcher("mintify.xyz")),
  createAdapter("scatter", "Scatter", hostMatcher("scatter.art")),
  createAdapter("blever", "Blever", hostMatcher("blever.xyz")),
  createAdapter("ronin", "Ronin", hostMatcher("mavis.market", "roninchain.com")),
  createAdapter("hyperlaunch", "Hyperlaunch", hostMatcher("hyperlaunch.xyz")),
  createAdapter("custom", "Custom contract", () => true),
];

export function resolveAdapter(url: string): LaunchpadAdapter {
  const adapter = adapters.find((candidate) => candidate.matches(url));
  if (!adapter) throw new Error(`No launchpad adapter matches ${url}`);
  return adapter;
}

export function getAdapter(id: string): LaunchpadAdapter {
  const adapter = adapters.find((candidate) => candidate.id === id);
  if (!adapter) throw new Error(`Unknown launchpad adapter: ${id}`);
  return adapter;
}
