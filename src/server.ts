import "./lib/error-capture";

import { EVM_CHAINS } from "./lib/chains";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

interface OpenSeaCollectionRaw {
  collection: string;
  name?: string;
  total_supply?: number;
  image_url?: string;
  opensea_url?: string;
  contracts?: Array<{
    address?: string;
    chain?: string;
  }>;
}

interface OpenSeaApiResponse {
  collections?: OpenSeaCollectionRaw[];
}

interface ServerChain {
  id: number;
  slug: string;
  name: string;
  symbol: string;
  rpc: string;
  explorer: string;
}

const RPC_ENV_BY_CHAIN_ID: Record<number, string[]> = {
  1: ["ETH_RPC_URL", "ETHEREUM_RPC_URL"],
  8453: ["BASE_RPC_URL"],
  42161: ["ARB_RPC_URL", "ARBITRUM_RPC_URL"],
  10: ["OPTIMISM_RPC_URL", "OP_RPC_URL"],
  137: ["POLYGON_RPC_URL"],
  81457: ["BLAST_RPC_URL"],
  56: ["BSC_RPC_URL", "BNB_RPC_URL"],
  7777777: ["ZORA_RPC_URL"],
  43114: ["AVALANCHE_RPC_URL", "AVAX_RPC_URL"],
  59144: ["LINEA_RPC_URL"],
  534352: ["SCROLL_RPC_URL"],
  5000: ["MANTLE_RPC_URL"],
  34443: ["MODE_RPC_URL"],
  80094: ["BERACHAIN_RPC_URL"],
  33139: ["APECHAIN_RPC_URL"],
  1329: ["SEI_RPC_URL"],
  57073: ["INK_RPC_URL"],
  10143: ["MONAD_RPC_URL"],
  11155111: ["SEPOLIA_RPC_URL"],
};

function getEnv(name: string): string {
  return typeof process !== "undefined" ? (process.env[name] || "").trim() : "";
}

function getRpcOverride(chainId: number): string | undefined {
  for (const key of RPC_ENV_BY_CHAIN_ID[chainId] ?? []) {
    const value = getEnv(key);
    if (value) return value;
  }
  return undefined;
}

const SERVER_CHAINS: ServerChain[] = EVM_CHAINS.map((chain) => {
  const rpc = getRpcOverride(chain.chainId) || chain.rpcUrls[0];
  if (!rpc) return null;
  return {
    id: chain.chainId,
    slug: chain.id,
    name: chain.name,
    symbol: chain.symbol,
    rpc,
    explorer: chain.blockExplorer,
  };
}).filter((chain): chain is ServerChain => chain !== null);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function isEvmAddress(value: string | undefined): value is `0x${string}` {
  return !!value && /^0x[a-fA-F0-9]{40}$/.test(value) && value.toLowerCase() !== ZERO_ADDRESS;
}

function normalizeChainSlug(value: string | undefined): string {
  const normalized = (value || "ethereum").trim().toLowerCase().replace(/\s+/g, "-");
  const aliases: Record<string, string> = {
    eth: "ethereum",
    mainnet: "ethereum",
    matic: "polygon",
    "arbitrum-one": "arbitrum",
    op: "optimism",
    bnb: "bsc",
    "bnb-chain": "bsc",
    "bnb-smart-chain": "bsc",
    binance: "bsc",
    avax: "avalanche",
    monadtestnet: "monad",
  };
  return aliases[normalized] || normalized;
}

function firstUsableContract(contracts: OpenSeaCollectionRaw["contracts"], fallbackChain: string) {
  const contract = contracts?.find((item) => isEvmAddress(item.address));
  if (!contract || !contract.address) return null;
  return {
    address: contract.address,
    chain: normalizeChainSlug(contract.chain || fallbackChain),
  };
}

function mapOpenSeaCollection(
  item: {
    collection?: string;
    name?: string;
    total_supply?: number;
    image_url?: string;
    opensea_url?: string;
    contracts?: OpenSeaCollectionRaw["contracts"];
    description?: string;
    banner_image_url?: string;
  },
  fallbackSlug: string,
  fallbackChain: string,
) {
  const contract = firstUsableContract(item.contracts, fallbackChain);
  if (!contract) return null;

  const slug = item.collection || fallbackSlug;
  return {
    collection: slug,
    name: item.name || slug,
    contractAddress: contract.address,
    chain: contract.chain,
    itemCount: item.total_supply || 0,
    slug,
    imageUrl: item.image_url || item.banner_image_url,
    openseaUrl: item.opensea_url || `https://opensea.io/collection/${slug}`,
    description: item.description,
    verified: true,
    isRealApi: true,
  };
}

function jsonResponse(data: unknown, status = 200, cacheSeconds = 0): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
    "x-content-type-options": "nosniff",
  };
  if (cacheSeconds > 0) {
    headers["cache-control"] = `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`;
  } else {
    headers["cache-control"] = "no-cache, no-store, must-revalidate";
  }

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    // ==========================================
    // OPTIONS CORS Preflight
    // ==========================================
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "Content-Type, Authorization",
          "access-control-max-age": "86400",
        },
      });
    }

    // ==========================================
    // Backend API: Health & Telemetry
    // ==========================================
    if (url.pathname === "/api/health") {
      return jsonResponse({
        status: "healthy",
        uptime: typeof process !== "undefined" && process.uptime ? process.uptime() : 0,
        timestamp: Date.now(),
        environment: process.env["NODE_ENV"] || "production",
        version: "2.5.0",
        chainsSupported: SERVER_CHAINS.length,
        services: {
          openSeaProxy: getEnv("OPENSEA_API_KEY") ? "configured" : "live-with-public-rate-limits",
          rpcGateway: "operational",
          mintQueue: "in-process",
          vaultEncryption: "available",
        },
      });
    }

    // ==========================================
    // Backend API: Supported Chains & RPC Status
    // ==========================================
    if (url.pathname === "/api/chains") {
      return jsonResponse({ chains: SERVER_CHAINS }, 200, 300);
    }

    // ==========================================
    // Backend API: Live Network Gas Engine
    // ==========================================
    if (url.pathname === "/api/gas") {
      const chainIdQuery = url.searchParams.get("chainId");
      const targetChains = chainIdQuery
        ? SERVER_CHAINS.filter((c) => String(c.id) === chainIdQuery)
        : SERVER_CHAINS.slice(0, 6);

      const gasEstimates = await Promise.allSettled(
        targetChains.map(async (chain) => {
          const rpcRes = await fetch(chain.rpc, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "eth_gasPrice",
              params: [],
            }),
          });
          if (rpcRes.ok) {
            const data = (await rpcRes.json()) as { result?: string };
            if (data.result && data.result !== "0x") {
              const wei = BigInt(data.result);
              const gwei = Number(wei) / 1e9;
              return {
                chainId: chain.id,
                chainName: chain.name,
                symbol: chain.symbol,
                gasPriceGwei: Number(gwei.toFixed(3)),
                gasPriceWei: data.result,
                status: "live",
              };
            }
          }
          throw new Error("RPC gas query failed");
        }),
      );

      const results = gasEstimates.map((res, idx) => {
        if (res.status === "fulfilled") {
          return res.value;
        }
        const chain = targetChains[idx];
        return {
          chainId: chain ? chain.id : 1,
          chainName: chain ? chain.name : "Ethereum",
          symbol: chain ? chain.symbol : "ETH",
          gasPriceGwei: null,
          gasPriceWei: null,
          status: "unavailable",
          error: res.reason instanceof Error ? res.reason.message : "RPC gas query failed",
        };
      });

      return jsonResponse({ gas: results, timestamp: Date.now() }, 200, 10);
    }

    if (url.pathname === "/api/market/eth-usd") {
      try {
        const priceRes = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
          headers: { Accept: "application/json" },
        });
        if (!priceRes.ok) {
          return jsonResponse({ error: `Price provider returned ${priceRes.status}` }, 502);
        }

        const data = (await priceRes.json()) as { data?: { amount?: string; currency?: string } };
        const priceUsd = Number(data.data?.amount);
        if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
          return jsonResponse({ error: "Price provider returned an invalid ETH/USD quote" }, 502);
        }

        return jsonResponse(
          {
            pair: "ETH-USD",
            priceUsd,
            source: "coinbase",
            timestamp: Date.now(),
          },
          200,
          30,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Price fetch failed";
        return jsonResponse({ error: message }, 502);
      }
    }

    // ==========================================
    // Backend API: On-Chain Contract Probing
    // ==========================================
    if (url.pathname === "/api/contract/probe") {
      const address = url.searchParams.get("address") || "";
      const chainId = Number(url.searchParams.get("chainId") || "1");
      const chain = SERVER_CHAINS.find((c) => c.id === chainId) || SERVER_CHAINS[0];

      if (!chain) {
        return jsonResponse({ error: "Chain configuration not found" }, 500);
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return jsonResponse({ error: "Invalid Ethereum address format", isContract: false }, 400);
      }

      try {
        const rpcRes = await fetch(chain.rpc, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getCode",
            params: [address, "latest"],
          }),
        });

        if (rpcRes.ok) {
          const rpcData = (await rpcRes.json()) as { result?: string };
          const bytecode = rpcData.result || "0x";
          const isContract = bytecode !== "0x" && bytecode.length > 2;

          return jsonResponse({
            address,
            chainId,
            chainName: chain.name,
            isContract,
            hasBytecode: isContract,
            bytecodeSize: isContract ? (bytecode.length - 2) / 2 : 0,
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "RPC inspection failed";
        return jsonResponse({ address, chainId, isContract: false, error: message }, 502);
      }

      return jsonResponse({ address, chainId, isContract: false }, 200);
    }

    // ==========================================
    // Server-Side Proxy: OpenSea & Multi-Chain API
    // ==========================================
    if (
      url.pathname.startsWith("/api/opensea/drop") ||
      (url.pathname.startsWith("/api/opensea") && url.searchParams.get("action") === "drop")
    ) {
      const slug = url.searchParams.get("slug") || "";
      if (!slug) {
        return jsonResponse({ error: "Slug required" }, 400);
      }
      const apiKey = getEnv("OPENSEA_API_KEY");
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (apiKey) {
        headers["x-api-key"] = apiKey;
      }

      try {
        const dropRes = await fetch(
          `https://api.opensea.io/api/v2/drops/${encodeURIComponent(slug)}`,
          { headers },
        );
        if (dropRes.ok) {
          const dropData = await dropRes.json();
          return jsonResponse(dropData, 200, 60);
        } else {
          return jsonResponse(
            { error: `OpenSea returned status ${dropRes.status}` },
            dropRes.status,
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Fetch failed";
        return jsonResponse({ error: msg }, 500);
      }
    }

    if (url.pathname.startsWith("/api/opensea")) {
      const q = url.searchParams.get("q") || "";
      const slug = url.searchParams.get("slug") || "";
      const address = url.searchParams.get("address") || "";
      const chain = normalizeChainSlug(url.searchParams.get("chain") || "ethereum");
      const apiKey = getEnv("OPENSEA_API_KEY");

      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (apiKey) {
        headers["x-api-key"] = apiKey;
      }

      // 1. Direct fetch by slug if provided or extracted
      const targetSlug =
        slug || (q && !q.startsWith("0x") && !q.includes(" ") ? q.toLowerCase() : "");

      if (targetSlug) {
        try {
          const singleRes = await fetch(
            `https://api.opensea.io/api/v2/collections/${encodeURIComponent(targetSlug)}`,
            { headers },
          );
          if (singleRes.ok) {
            const data = (await singleRes.json()) as Parameters<typeof mapOpenSeaCollection>[0];
            const item = mapOpenSeaCollection(data, targetSlug, chain);
            if (item) {
              return jsonResponse({ collections: [item], collection: item }, 200, 60);
            }

            return jsonResponse(
              {
                collections: [],
                error: "OpenSea did not return a usable EVM contract for this collection",
              },
              200,
              60,
            );
          }
        } catch (err: unknown) {
          console.warn("OpenSea slug fetch failed:", err);
        }
      }

      // 2. Fetch by contract address
      const targetAddress = isEvmAddress(address) ? address : isEvmAddress(q) ? q : "";
      if (targetAddress) {
        try {
          const contractRes = await fetch(
            `https://api.opensea.io/api/v2/chain/${encodeURIComponent(chain)}/contract/${encodeURIComponent(targetAddress)}`,
            { headers },
          );
          if (contractRes.ok) {
            const data = (await contractRes.json()) as {
              address: string;
              chain: string;
              collection?: string;
              name?: string;
            };
            if (data.collection) {
              const colRes = await fetch(
                `https://api.opensea.io/api/v2/collections/${encodeURIComponent(data.collection)}`,
                { headers },
              );
              if (colRes.ok) {
                const colData = (await colRes.json()) as Parameters<typeof mapOpenSeaCollection>[0];
                const item =
                  mapOpenSeaCollection(
                    {
                      ...colData,
                      contracts: [
                        {
                          address: targetAddress,
                          chain: data.chain || chain,
                        },
                      ],
                    },
                    data.collection,
                    chain,
                  ) || null;
                if (item) {
                  return jsonResponse({ collections: [item], collection: item }, 200, 60);
                }
              }
            }
          }
        } catch (err: unknown) {
          console.warn("OpenSea contract fetch failed:", err);
        }
      }

      // 3. Fallback paginated search
      try {
        const openseaRes = await fetch(
          `https://api.opensea.io/api/v2/collections?chain=${encodeURIComponent(chain)}&limit=50`,
          { headers },
        );

        if (openseaRes.ok) {
          const data = (await openseaRes.json()) as OpenSeaApiResponse;
          const collections = (data.collections || [])
            .filter((c: OpenSeaCollectionRaw) => {
              if (!q) return true;
              const name = (c.name || c.collection || "").toLowerCase();
              return (
                name.includes(q.toLowerCase()) ||
                c.collection.toLowerCase().includes(q.toLowerCase())
              );
            })
            .map((item: OpenSeaCollectionRaw) => mapOpenSeaCollection(item, item.collection, chain))
            .filter((item): item is NonNullable<typeof item> => item !== null);

          return jsonResponse({ collections }, 200, 60);
        }
      } catch (err: unknown) {
        console.warn("OpenSea search failed:", err);
      }

      return jsonResponse({ collections: [] }, 200);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
