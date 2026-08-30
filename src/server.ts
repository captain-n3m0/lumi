import "./lib/error-capture";

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

const SERVER_CHAINS = [
  {
    id: 1,
    name: "Ethereum",
    symbol: "ETH",
    rpc: "https://eth.llamarpc.com",
    explorer: "https://etherscan.io",
  },
  {
    id: 8453,
    name: "Base",
    symbol: "ETH",
    rpc: "https://mainnet.base.org",
    explorer: "https://basescan.org",
  },
  {
    id: 42161,
    name: "Arbitrum One",
    symbol: "ETH",
    rpc: "https://arb1.arbitrum.io/rpc",
    explorer: "https://arbiscan.io",
  },
  {
    id: 137,
    name: "Polygon",
    symbol: "POL",
    rpc: "https://polygon-rpc.com",
    explorer: "https://polygonscan.com",
  },
  {
    id: 81457,
    name: "Blast",
    symbol: "ETH",
    rpc: "https://rpc.blast.io",
    explorer: "https://blastscan.io",
  },
  {
    id: 10,
    name: "Optimism",
    symbol: "ETH",
    rpc: "https://mainnet.optimism.io",
    explorer: "https://optimistic.etherscan.io",
  },
  {
    id: 56,
    name: "BNB Smart Chain",
    symbol: "BNB",
    rpc: "https://binance.llamarpc.com",
    explorer: "https://bscscan.com",
  },
  {
    id: 7777777,
    name: "Zora",
    symbol: "ETH",
    rpc: "https://rpc.zora.energy",
    explorer: "https://zorascan.xyz",
  },
  {
    id: 80094,
    name: "Berachain",
    symbol: "BERA",
    rpc: "https://rpc.berachain.com",
    explorer: "https://berascan.com",
  },
  {
    id: 11155111,
    name: "Sepolia Testnet",
    symbol: "SepoliaETH",
    rpc: "https://rpc.sepolia.org",
    explorer: "https://sepolia.etherscan.io",
  },
];

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
        environment: process.env.NODE_ENV || "production",
        version: "2.5.0",
        chainsSupported: SERVER_CHAINS.length,
        services: {
          openSeaProxy: "operational",
          rpcGateway: "operational",
          mintQueue: "operational",
          vaultEncryption: "operational",
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
            if (data.result) {
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
        return {
          chainId: targetChains[idx].id,
          chainName: targetChains[idx].name,
          symbol: targetChains[idx].symbol,
          gasPriceGwei: 15.0,
          gasPriceWei: "0x37e11d600",
          status: "fallback",
        };
      });

      return jsonResponse({ gas: results, timestamp: Date.now() }, 200, 10);
    }

    // ==========================================
    // Backend API: On-Chain Contract Probing
    // ==========================================
    if (url.pathname === "/api/contract/probe") {
      const address = url.searchParams.get("address") || "";
      const chainId = Number(url.searchParams.get("chainId") || "1");
      const chain = SERVER_CHAINS.find((c) => c.id === chainId) || SERVER_CHAINS[0];

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
    if (url.pathname.startsWith("/api/opensea/search")) {
      const q = url.searchParams.get("q") || "";
      const chain = url.searchParams.get("chain") || "ethereum";
      const apiKey = process.env.OPENSEA_API_KEY || "";

      try {
        const headers: Record<string, string> = {
          Accept: "application/json",
        };
        if (apiKey) {
          headers["x-api-key"] = apiKey;
        }

        const openseaRes = await fetch(
          `https://api.opensea.io/api/v2/collections?chain=${encodeURIComponent(chain)}&limit=25`,
          { headers },
        );

        if (openseaRes.ok) {
          const data = (await openseaRes.json()) as OpenSeaApiResponse;
          const collections = (data.collections || [])
            .filter((c: OpenSeaCollectionRaw) => {
              const name = (c.name || c.collection || "").toLowerCase();
              return (
                name.includes(q.toLowerCase()) ||
                c.collection.toLowerCase().includes(q.toLowerCase())
              );
            })
            .map((item: OpenSeaCollectionRaw) => ({
              collection: item.collection,
              name: item.name || item.collection,
              contractAddress:
                item.contracts?.[0]?.address || "0x0000000000000000000000000000000000000000",
              chain: item.contracts?.[0]?.chain || chain,
              itemCount: item.total_supply || 0,
              slug: item.collection,
              imageUrl: item.image_url,
              openseaUrl: item.opensea_url || `https://opensea.io/collection/${item.collection}`,
            }));

          return jsonResponse({ collections }, 200, 60);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "OpenSea fetch failed";
        console.warn("OpenSea proxy fetch error:", message);
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
