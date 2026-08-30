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

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

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

          return new Response(JSON.stringify({ collections }), {
            headers: { "content-type": "application/json" },
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "OpenSea fetch failed";
        console.warn("OpenSea proxy fetch error:", message);
      }

      return new Response(JSON.stringify({ collections: [] }), {
        headers: { "content-type": "application/json" },
      });
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
