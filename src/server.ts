import "./lib/error-capture";

import { decodeFunctionResult, encodeFunctionData, formatEther, parseAbi, type Abi } from "viem";
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

interface ServerMintStage {
  id: string;
  name: string;
  kind: "public" | "whitelist" | "allowlist" | "holder";
  priceEth: number;
  maxPerWallet: number;
  startsAt: number;
  endsAt?: number;
  source: "contract";
  sourceLabel: string;
}

type OpenSeaWalletEligibilityStatus =
  "eligible" | "ineligible" | "not_active" | "unknown" | "auth_error" | "drop_not_found" | "error";

interface OpenSeaStageEligibility {
  stageId?: string;
  stageName?: string;
  eligible: boolean | null;
  reason?: string;
}

interface OpenSeaWalletEligibility {
  address: string;
  eligible: boolean | null;
  status: OpenSeaWalletEligibilityStatus;
  reason?: string;
  stageEligibilities?: OpenSeaStageEligibility[];
  source: "opensea-drop-details" | "opensea-mint-action" | "opensea";
}

type RuntimeEnv = Record<string, unknown> | undefined;

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

function getEnv(name: string, runtimeEnv?: RuntimeEnv): string {
  const runtimeValue = runtimeEnv?.[name];
  if (typeof runtimeValue === "string" && runtimeValue.trim()) {
    return runtimeValue.trim();
  }
  if (typeof runtimeValue === "number" || typeof runtimeValue === "boolean") {
    return String(runtimeValue).trim();
  }

  return typeof process !== "undefined" ? (process.env[name] || "").trim() : "";
}

function getRpcOverride(chainId: number, runtimeEnv?: RuntimeEnv): string | undefined {
  for (const key of RPC_ENV_BY_CHAIN_ID[chainId] ?? []) {
    const value = getEnv(key, runtimeEnv);
    if (value) return value;
  }
  return undefined;
}

function getServerChains(runtimeEnv?: RuntimeEnv): ServerChain[] {
  return EVM_CHAINS.map((chain) => {
    const rpc = getRpcOverride(chain.chainId, runtimeEnv) || chain.rpcUrls[0];
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
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const NATIVE_TOKEN_PLACEHOLDER = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const SEA_DROP_TOKEN_ABI = parseAbi([
  "function getAllowedSeaDrop() view returns (address[])",
  "function allowedSeaDrop() view returns (address)",
  "function seaDrop() view returns (address)",
  "function getSeaDrop() view returns (address)",
]);

const SEA_DROP_ABI = [
  {
    type: "function",
    name: "getPublicDrop",
    stateMutability: "view",
    inputs: [{ name: "nftContract", type: "address" }],
    outputs: [
      {
        name: "publicDrop",
        type: "tuple",
        components: [
          { name: "mintPrice", type: "uint80" },
          { name: "startTime", type: "uint48" },
          { name: "endTime", type: "uint48" },
          { name: "maxTotalMintableByWallet", type: "uint16" },
          { name: "feeBps", type: "uint16" },
          { name: "restrictFeeRecipients", type: "bool" },
        ],
      },
    ],
  },
] as const satisfies Abi;

const THIRDWEB_DROP_ABI = [
  {
    type: "function",
    name: "getActiveClaimConditionId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "conditionId", type: "uint256" }],
  },
  {
    type: "function",
    name: "getClaimConditionById",
    stateMutability: "view",
    inputs: [{ name: "conditionId", type: "uint256" }],
    outputs: [
      {
        name: "condition",
        type: "tuple",
        components: [
          { name: "startTimestamp", type: "uint256" },
          { name: "maxClaimableSupply", type: "uint256" },
          { name: "supplyClaimed", type: "uint256" },
          { name: "quantityLimitPerWallet", type: "uint256" },
          { name: "merkleRoot", type: "bytes32" },
          { name: "pricePerToken", type: "uint256" },
          { name: "currency", type: "address" },
          { name: "metadata", type: "string" },
        ],
      },
    ],
  },
] as const satisfies Abi;

const SIMPLE_MINT_ABI = parseAbi([
  "function mintPrice() view returns (uint256)",
  "function price() view returns (uint256)",
  "function cost() view returns (uint256)",
  "function publicSalePrice() view returns (uint256)",
  "function publicPrice() view returns (uint256)",
  "function mintFee() view returns (uint256)",
  "function saleStartTime() view returns (uint256)",
  "function publicSaleStartTime() view returns (uint256)",
  "function startTime() view returns (uint256)",
  "function mintStart() view returns (uint256)",
  "function saleStart() view returns (uint256)",
  "function saleEndTime() view returns (uint256)",
  "function publicSaleEndTime() view returns (uint256)",
  "function endTime() view returns (uint256)",
  "function mintEnd() view returns (uint256)",
  "function saleEnd() view returns (uint256)",
  "function maxMintPerWallet() view returns (uint256)",
  "function maxPerWallet() view returns (uint256)",
  "function maxMintAmountPerTx() view returns (uint256)",
  "function walletLimit() view returns (uint256)",
  "function publicSaleActive() view returns (bool)",
  "function saleActive() view returns (bool)",
  "function mintingActive() view returns (bool)",
  "function mintActive() view returns (bool)",
  "function paused() view returns (bool)",
]);

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

function recordFromUnknown(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function firstValue(record: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  const value = firstValue(record, keys);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function extractOpenSeaError(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  const record = recordFromUnknown(payload);
  if (!record) return fallback;

  const direct = firstValue(record, ["message", "error", "detail", "reason"]);
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const errors = record["errors"];
  if (typeof errors === "string" && errors.trim()) return errors.trim();
  if (Array.isArray(errors)) {
    const messages = errors
      .map((item) => {
        if (typeof item === "string") return item.trim();
        const nested = recordFromUnknown(item);
        return nested ? firstString(nested, ["message", "error", "detail", "reason"]) : "";
      })
      .filter(Boolean);
    if (messages.length > 0) return messages.join(", ");
  }

  return fallback;
}

async function readOpenSeaPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.trim() ? text : undefined;
}

function parseOpenSeaBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value !== "string") return null;

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (
    ["true", "eligible", "allowlisted", "allowed", "canmint", "valid", "yes"].includes(normalized)
  ) {
    return true;
  }
  if (
    [
      "false",
      "ineligible",
      "noteligible",
      "notallowlisted",
      "notallowed",
      "cannotmint",
      "invalid",
      "no",
    ].includes(normalized)
  ) {
    return false;
  }

  return null;
}

function eligibilityBooleanFromRecord(record: Record<string, unknown>): boolean | null {
  const direct = parseOpenSeaBoolean(
    firstValue(record, [
      "eligible",
      "is_eligible",
      "isEligible",
      "wallet_eligible",
      "walletEligible",
      "wallet_is_eligible",
      "walletIsEligible",
      "can_mint",
      "canMint",
      "can_mint_for_stage",
      "canMintForStage",
      "is_allowlisted",
      "isAllowlisted",
      "allowlisted",
    ]),
  );
  if (direct !== null) return direct;

  for (const key of [
    "eligibility",
    "walletEligibility",
    "wallet_eligibility",
    "minterEligibility",
    "minter_eligibility",
    "minter",
    "wallet",
    "allowlist",
  ]) {
    const nested = recordFromUnknown(record[key]);
    if (!nested) continue;

    const nestedValue = eligibilityBooleanFromRecord(nested);
    if (nestedValue !== null) return nestedValue;

    const status = parseOpenSeaBoolean(firstValue(nested, ["status", "result", "state"]));
    if (status !== null) return status;
  }

  return null;
}

function eligibilityReasonFromRecord(record: Record<string, unknown>): string | undefined {
  const reason = firstString(record, [
    "reason",
    "message",
    "detail",
    "error",
    "eligibility_reason",
    "eligibilityReason",
    "ineligibility_reason",
    "ineligibilityReason",
  ]);
  if (reason) return reason;

  for (const key of [
    "eligibility",
    "walletEligibility",
    "wallet_eligibility",
    "minterEligibility",
    "minter_eligibility",
    "allowlist",
  ]) {
    const nested = recordFromUnknown(record[key]);
    if (!nested) continue;
    const nestedReason = eligibilityReasonFromRecord(nested);
    if (nestedReason) return nestedReason;
  }

  return undefined;
}

function rawDropStagesFromOpenSea(data: unknown): Record<string, unknown>[] {
  const payload = recordFromUnknown(data);
  if (!payload) return [];

  const candidates: unknown[] = [
    payload["stages"],
    payload["mint_stages"],
    payload["mintStages"],
    payload["phases"],
    payload["mint_phases"],
    payload["mintPhases"],
  ];

  for (const key of ["drop", "data", "collection"]) {
    const nested = recordFromUnknown(payload[key]);
    if (!nested) continue;
    candidates.push(
      nested["stages"],
      nested["mint_stages"],
      nested["mintStages"],
      nested["phases"],
      nested["mint_phases"],
      nested["mintPhases"],
    );
  }

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (stage): stage is Record<string, unknown> =>
          !!stage && typeof stage === "object" && !Array.isArray(stage),
      );
    }
  }

  return [];
}

function extractOpenSeaStageEligibilities(data: unknown): OpenSeaStageEligibility[] {
  return rawDropStagesFromOpenSea(data)
    .map((stage) => {
      const stageId = firstString(stage, ["id", "uuid", "stage_id", "stageId"]);
      const stageName = firstString(stage, [
        "name",
        "label",
        "title",
        "stage_type",
        "stageType",
        "kind",
        "type",
      ]);
      const eligible = eligibilityBooleanFromRecord(stage);
      const reason = eligibilityReasonFromRecord(stage);

      return {
        ...(stageId ? { stageId } : {}),
        ...(stageName ? { stageName } : {}),
        eligible,
        ...(reason ? { reason } : {}),
      };
    })
    .filter((stage) => stage.stageId || stage.stageName || stage.eligible !== null);
}

function extractOverallOpenSeaEligibility(data: unknown): boolean | null {
  const payload = recordFromUnknown(data);
  if (!payload) return null;

  const direct = eligibilityBooleanFromRecord(payload);
  if (direct !== null) return direct;

  for (const key of ["drop", "data", "collection"]) {
    const nested = recordFromUnknown(payload[key]);
    if (!nested) continue;
    const nestedEligibility = eligibilityBooleanFromRecord(nested);
    if (nestedEligibility !== null) return nestedEligibility;
  }

  return null;
}

async function checkOpenSeaDropDetailsEligibility(
  slug: string,
  address: string,
  headers: Record<string, string>,
): Promise<OpenSeaWalletEligibility | undefined> {
  const detailsUrl = new URL(`https://api.opensea.io/api/v2/drops/${encodeURIComponent(slug)}`);
  detailsUrl.searchParams.set("minter", address);
  const response = await fetch(detailsUrl, { headers });
  const payload = await readOpenSeaPayload(response);

  if (response.status === 401 || response.status === 403) {
    return {
      address,
      eligible: null,
      status: "auth_error",
      reason: extractOpenSeaError(payload, `OpenSea returned status ${response.status}`),
      source: "opensea-drop-details",
    };
  }

  if (response.status === 404) {
    return {
      address,
      eligible: null,
      status: "drop_not_found",
      reason: "OpenSea did not find this drop slug.",
      source: "opensea-drop-details",
    };
  }

  if (!response.ok) {
    return undefined;
  }

  const stageEligibilities = extractOpenSeaStageEligibilities(payload);
  const hasStageSignal = stageEligibilities.some((stage) => stage.eligible !== null);
  if (hasStageSignal) {
    const eligible = stageEligibilities.some((stage) => stage.eligible === true);
    const hasIneligibleSignal = stageEligibilities.some((stage) => stage.eligible === false);
    return {
      address,
      eligible,
      status: eligible ? "eligible" : hasIneligibleSignal ? "ineligible" : "unknown",
      stageEligibilities,
      source: "opensea-drop-details",
    };
  }

  const overallEligibility = extractOverallOpenSeaEligibility(payload);
  if (overallEligibility !== null) {
    return {
      address,
      eligible: overallEligibility,
      status: overallEligibility ? "eligible" : "ineligible",
      source: "opensea-drop-details",
    };
  }

  return undefined;
}

async function checkOpenSeaDropMintEligibility(
  slug: string,
  address: string,
  quantity: number,
  headers: Record<string, string>,
): Promise<OpenSeaWalletEligibility> {
  const response = await fetch(
    `https://api.opensea.io/api/v2/drops/${encodeURIComponent(slug)}/mint`,
    {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify({ minter: address, quantity }),
    },
  );
  const payload = await readOpenSeaPayload(response);

  if (response.ok) {
    return {
      address,
      eligible: true,
      status: "eligible",
      reason: "OpenSea returned mint transaction data for this wallet.",
      source: "opensea-mint-action",
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      address,
      eligible: null,
      status: "auth_error",
      reason: extractOpenSeaError(payload, `OpenSea returned status ${response.status}`),
      source: "opensea-mint-action",
    };
  }

  if (response.status === 404) {
    return {
      address,
      eligible: null,
      status: "drop_not_found",
      reason: "OpenSea did not find this drop slug.",
      source: "opensea-mint-action",
    };
  }

  if (response.status === 409) {
    return {
      address,
      eligible: null,
      status: "not_active",
      reason: extractOpenSeaError(payload, "OpenSea says this drop is not currently active."),
      source: "opensea-mint-action",
    };
  }

  if (response.status === 422) {
    return {
      address,
      eligible: false,
      status: "ineligible",
      reason: extractOpenSeaError(
        payload,
        "OpenSea could not build a mint transaction for this wallet.",
      ),
      source: "opensea-mint-action",
    };
  }

  return {
    address,
    eligible: null,
    status: "error",
    reason: extractOpenSeaError(payload, `OpenSea returned status ${response.status}`),
    source: "opensea-mint-action",
  };
}

async function checkOpenSeaDropWalletEligibility(
  slug: string,
  address: string,
  quantity: number,
  headers: Record<string, string>,
): Promise<OpenSeaWalletEligibility> {
  try {
    const details = await checkOpenSeaDropDetailsEligibility(slug, address, headers);
    if (details) return details;
    return await checkOpenSeaDropMintEligibility(slug, address, quantity, headers);
  } catch (err: unknown) {
    return {
      address,
      eligible: null,
      status: "error",
      reason: err instanceof Error ? err.message : "OpenSea eligibility check failed.",
      source: "opensea",
    };
  }
}

async function mapWithConcurrency<T, U>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex] as T, currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function rpcRequest(chain: ServerChain, method: string, params: unknown[]): Promise<unknown> {
  const rpcRes = await fetch(chain.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  const data = (await rpcRes.json()) as {
    result?: unknown;
    error?: { message?: string };
  };

  if (!rpcRes.ok || data.error) {
    throw new Error(data.error?.message || `RPC returned status ${rpcRes.status}`);
  }
  return data.result;
}

async function readContractView<T>(
  chain: ServerChain,
  address: `0x${string}`,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
): Promise<T> {
  const data = encodeFunctionData({
    abi,
    functionName,
    args,
  } as unknown as Parameters<typeof encodeFunctionData>[0]);
  const result = await rpcRequest(chain, "eth_call", [{ to: address, data }, "latest"]);

  if (typeof result !== "string" || !result.startsWith("0x")) {
    throw new Error("RPC returned invalid call data");
  }

  return decodeFunctionResult({
    abi,
    functionName,
    data: result,
  } as unknown as Parameters<typeof decodeFunctionResult>[0]) as T;
}

async function readOptional<T>(
  chain: ServerChain,
  address: `0x${string}`,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
): Promise<T | undefined> {
  try {
    return await readContractView<T>(chain, address, abi, functionName, args);
  } catch {
    return undefined;
  }
}

function tupleField(value: unknown, field: string, index: number): unknown {
  if (Array.isArray(value)) return value[index];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return record[field] ?? record[String(index)];
  }
  return undefined;
}

function toBigIntValue(value: unknown): bigint | undefined {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && value.trim()) {
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function weiToEthNumber(value: unknown): number {
  const wei = toBigIntValue(value);
  if (wei === undefined || wei < 0n) return 0;
  const eth = Number.parseFloat(formatEther(wei));
  return Number.isFinite(eth) && eth >= 0 ? eth : 0;
}

function timestampToMs(value: unknown): number | undefined {
  const timestamp = toBigIntValue(value);
  if (timestamp === undefined || timestamp <= 0n || timestamp > BigInt(Number.MAX_SAFE_INTEGER)) {
    return undefined;
  }

  const numeric = Number(timestamp);
  return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
}

function positiveNumber(value: unknown, fallback: number): number {
  const raw = toBigIntValue(value);
  if (raw === undefined || raw <= 0n || raw > BigInt(Number.MAX_SAFE_INTEGER)) {
    return fallback;
  }
  return Number(raw);
}

function isNativeCurrencyAddress(value: unknown): boolean {
  if (typeof value !== "string") return true;
  const normalized = value.toLowerCase();
  return normalized === ZERO_ADDRESS || normalized === NATIVE_TOKEN_PLACEHOLDER;
}

function hasLiveOrUpcomingWindow(stage: Pick<ServerMintStage, "startsAt" | "endsAt">): boolean {
  const now = Date.now();
  return stage.endsAt === undefined || stage.endsAt > now;
}

async function discoverSeaDropAddresses(
  chain: ServerChain,
  nftContract: `0x${string}`,
): Promise<`0x${string}`[]> {
  const found: `0x${string}`[] = [];
  const allowed = await readOptional<readonly string[]>(
    chain,
    nftContract,
    SEA_DROP_TOKEN_ABI,
    "getAllowedSeaDrop",
  );

  for (const address of allowed ?? []) {
    if (isEvmAddress(address) && !found.includes(address)) {
      found.push(address);
    }
  }

  for (const functionName of ["allowedSeaDrop", "seaDrop", "getSeaDrop"]) {
    const address = await readOptional<string>(
      chain,
      nftContract,
      SEA_DROP_TOKEN_ABI,
      functionName,
    );
    if (isEvmAddress(address) && !found.includes(address)) {
      found.push(address);
    }
  }

  return found;
}

async function probeSeaDropStages(
  chain: ServerChain,
  nftContract: `0x${string}`,
): Promise<ServerMintStage[]> {
  const stages: ServerMintStage[] = [];
  const seaDropAddresses = await discoverSeaDropAddresses(chain, nftContract);

  for (const seaDropAddress of seaDropAddresses) {
    const drop = await readOptional<unknown>(chain, seaDropAddress, SEA_DROP_ABI, "getPublicDrop", [
      nftContract,
    ]);
    if (!drop) continue;

    const priceWei = tupleField(drop, "mintPrice", 0);
    const startsAt = timestampToMs(tupleField(drop, "startTime", 1));
    const endsAt = timestampToMs(tupleField(drop, "endTime", 2));
    const maxPerWallet = positiveNumber(tupleField(drop, "maxTotalMintableByWallet", 3), 1);
    const hasConfig =
      weiToEthNumber(priceWei) > 0 ||
      startsAt !== undefined ||
      endsAt !== undefined ||
      maxPerWallet > 1;

    if (!hasConfig) continue;

    const stage: ServerMintStage = {
      id: `contract-seadrop-${seaDropAddress.toLowerCase()}`,
      name: "PUBLIC DROP",
      kind: "public",
      priceEth: weiToEthNumber(priceWei),
      maxPerWallet,
      startsAt: startsAt ?? Date.now(),
      ...(endsAt !== undefined ? { endsAt } : {}),
      source: "contract",
      sourceLabel: "SeaDrop contract",
    };

    if (hasLiveOrUpcomingWindow(stage)) {
      stages.push(stage);
    }
  }

  return stages;
}

async function probeThirdwebStages(
  chain: ServerChain,
  nftContract: `0x${string}`,
): Promise<ServerMintStage[]> {
  const conditionId = await readOptional<bigint>(
    chain,
    nftContract,
    THIRDWEB_DROP_ABI,
    "getActiveClaimConditionId",
  );
  if (conditionId === undefined) return [];

  const condition = await readOptional<unknown>(
    chain,
    nftContract,
    THIRDWEB_DROP_ABI,
    "getClaimConditionById",
    [conditionId],
  );
  if (!condition) return [];

  const currency = tupleField(condition, "currency", 6);
  const priceWei = tupleField(condition, "pricePerToken", 5);
  if (!isNativeCurrencyAddress(currency) && toBigIntValue(priceWei) !== 0n) {
    return [];
  }

  const startsAt = timestampToMs(tupleField(condition, "startTimestamp", 0)) ?? Date.now();
  const merkleRoot = String(tupleField(condition, "merkleRoot", 4) || "");
  const normalizedMerkleRoot = merkleRoot.toLowerCase();
  const isAllowlist =
    /^0x[a-f0-9]{64}$/.test(normalizedMerkleRoot) && !/^0x0{64}$/.test(normalizedMerkleRoot);
  const stage: ServerMintStage = {
    id: `contract-thirdweb-${conditionId.toString()}`,
    name: isAllowlist ? "ALLOWLIST CLAIM" : "PUBLIC CLAIM",
    kind: isAllowlist ? "allowlist" : "public",
    priceEth: weiToEthNumber(priceWei),
    maxPerWallet: positiveNumber(tupleField(condition, "quantityLimitPerWallet", 3), 1),
    startsAt,
    source: "contract",
    sourceLabel: "Thirdweb claim condition",
  };

  return hasLiveOrUpcomingWindow(stage) ? [stage] : [];
}

async function firstRead<T>(
  chain: ServerChain,
  address: `0x${string}`,
  functionNames: readonly string[],
): Promise<T | undefined> {
  for (const functionName of functionNames) {
    const value = await readOptional<T>(chain, address, SIMPLE_MINT_ABI, functionName);
    if (value !== undefined) return value;
  }
  return undefined;
}

async function hasPublicMintActiveSignal(
  chain: ServerChain,
  address: `0x${string}`,
): Promise<boolean | undefined> {
  for (const functionName of ["publicSaleActive", "saleActive", "mintingActive", "mintActive"]) {
    const active = await readOptional<boolean>(chain, address, SIMPLE_MINT_ABI, functionName);
    if (active === true) return true;
    if (active === false) return false;
  }

  const paused = await readOptional<boolean>(chain, address, SIMPLE_MINT_ABI, "paused");
  if (paused === true) return false;
  return undefined;
}

async function probeSimplePublicMintStage(
  chain: ServerChain,
  nftContract: `0x${string}`,
): Promise<ServerMintStage[]> {
  const [priceWei, startValue, endValue, maxValue, active] = await Promise.all([
    firstRead<bigint>(chain, nftContract, [
      "mintPrice",
      "price",
      "cost",
      "publicSalePrice",
      "publicPrice",
      "mintFee",
    ]),
    firstRead<bigint>(chain, nftContract, [
      "saleStartTime",
      "publicSaleStartTime",
      "startTime",
      "mintStart",
      "saleStart",
    ]),
    firstRead<bigint>(chain, nftContract, [
      "saleEndTime",
      "publicSaleEndTime",
      "endTime",
      "mintEnd",
      "saleEnd",
    ]),
    firstRead<bigint>(chain, nftContract, [
      "maxMintPerWallet",
      "maxPerWallet",
      "maxMintAmountPerTx",
      "walletLimit",
    ]),
    hasPublicMintActiveSignal(chain, nftContract),
  ]);

  const startsAt = timestampToMs(startValue);
  const endsAt = timestampToMs(endValue);
  const hasWindow = startsAt !== undefined || endsAt !== undefined;
  const now = Date.now();
  const isUpcomingOrOpen =
    active === true ||
    (startsAt !== undefined && startsAt > now) ||
    (endsAt !== undefined && endsAt > now);

  if (!isUpcomingOrOpen || (!hasWindow && active !== true)) {
    return [];
  }

  const stage: ServerMintStage = {
    id: `contract-public-${nftContract.toLowerCase()}`,
    name: "PUBLIC CONTRACT MINT",
    kind: "public",
    priceEth: weiToEthNumber(priceWei),
    maxPerWallet: positiveNumber(maxValue, 1),
    startsAt: startsAt ?? now,
    ...(endsAt !== undefined ? { endsAt } : {}),
    source: "contract",
    sourceLabel: "Contract read",
  };

  return hasLiveOrUpcomingWindow(stage) ? [stage] : [];
}

async function probeContractMintStages(
  chain: ServerChain,
  address: `0x${string}`,
): Promise<ServerMintStage[]> {
  const stageGroups = await Promise.allSettled([
    probeSeaDropStages(chain, address),
    probeThirdwebStages(chain, address),
    probeSimplePublicMintStage(chain, address),
  ]);

  const stages: ServerMintStage[] = [];
  for (const result of stageGroups) {
    if (result.status !== "fulfilled") continue;
    for (const stage of result.value) {
      if (!stages.some((existing) => existing.id === stage.id)) {
        stages.push(stage);
      }
    }
  }

  return stages.sort((a, b) => a.startsAt - b.startsAt);
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
    const runtimeEnv: RuntimeEnv = env && typeof env === "object" ? (env as RuntimeEnv) : undefined;
    const serverChains = getServerChains(runtimeEnv);

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
        environment:
          typeof process !== "undefined" ? process.env["NODE_ENV"] || "production" : "production",
        version: "2.5.0",
        chainsSupported: serverChains.length,
        services: {
          openSeaProxy: getEnv("OPENSEA_API_KEY", runtimeEnv)
            ? "configured"
            : "live-with-public-rate-limits",
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
      return jsonResponse({ chains: serverChains }, 200, 300);
    }

    // ==========================================
    // Backend API: Live Network Gas Engine
    // ==========================================
    if (url.pathname === "/api/gas") {
      const chainIdQuery = url.searchParams.get("chainId");
      const targetChains = chainIdQuery
        ? serverChains.filter((c) => String(c.id) === chainIdQuery)
        : serverChains.slice(0, 6);

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
    if (url.pathname === "/api/contract/mint-stages") {
      const address = url.searchParams.get("address") || "";
      const chainId = Number(url.searchParams.get("chainId") || "1");
      const chain = serverChains.find((c) => c.id === chainId) || serverChains[0];

      if (!chain) {
        return jsonResponse({ error: "Chain configuration not found", stages: [] }, 500);
      }

      if (!isEvmAddress(address)) {
        return jsonResponse({ error: "Invalid Ethereum address format", stages: [] }, 400);
      }

      try {
        const bytecode = await rpcRequest(chain, "eth_getCode", [address, "latest"]);
        const isContract = typeof bytecode === "string" && bytecode !== "0x" && bytecode.length > 2;
        if (!isContract) {
          return jsonResponse(
            {
              address,
              chainId,
              chainName: chain.name,
              isContract: false,
              stages: [],
            },
            200,
            30,
          );
        }

        const stages = await probeContractMintStages(chain, address);
        return jsonResponse(
          {
            address,
            chainId,
            chainName: chain.name,
            isContract: true,
            stages,
            timestamp: Date.now(),
          },
          200,
          stages.length > 0 ? 30 : 10,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Mint stage probe failed";
        return jsonResponse(
          { address, chainId, isContract: false, stages: [], error: message },
          502,
        );
      }
    }

    if (url.pathname === "/api/contract/probe") {
      const address = url.searchParams.get("address") || "";
      const chainId = Number(url.searchParams.get("chainId") || "1");
      const chain = serverChains.find((c) => c.id === chainId) || serverChains[0];

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
    if (url.pathname === "/api/opensea/drop/eligibility") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "Use POST for OpenSea wallet eligibility checks" }, 405);
      }

      const apiKey = getEnv("OPENSEA_API_KEY", runtimeEnv);
      if (!apiKey) {
        return jsonResponse(
          { error: "OpenSea API key is not configured on the server", wallets: [] },
          503,
        );
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Request body must be valid JSON", wallets: [] }, 400);
      }

      const payload = recordFromUnknown(body);
      const slug = typeof payload?.["slug"] === "string" ? payload["slug"].trim() : "";
      const rawWallets = Array.isArray(payload?.["wallets"]) ? payload["wallets"] : [];
      const quantityValue =
        typeof payload?.["quantity"] === "number"
          ? payload["quantity"]
          : Number(payload?.["quantity"]);
      const quantity =
        Number.isFinite(quantityValue) && quantityValue > 0
          ? Math.min(100, Math.max(1, Math.floor(quantityValue)))
          : 1;

      if (!slug || isEvmAddress(slug)) {
        return jsonResponse({ error: "A valid OpenSea drop slug is required", wallets: [] }, 400);
      }

      const wallets = Array.from(
        new Set(
          rawWallets
            .filter((wallet): wallet is string => typeof wallet === "string")
            .map((wallet) => wallet.trim())
            .filter(isEvmAddress)
            .map((wallet) => wallet.toLowerCase()),
        ),
      ).slice(0, 50);

      if (wallets.length === 0) {
        return jsonResponse(
          { error: "At least one valid wallet address is required", wallets: [] },
          400,
        );
      }

      const headers = {
        Accept: "application/json",
        "x-api-key": apiKey,
      };

      const results = await mapWithConcurrency(wallets, 4, (wallet) =>
        checkOpenSeaDropWalletEligibility(slug, wallet, quantity, headers),
      );

      return jsonResponse(
        {
          slug,
          checked: results.length,
          wallets: results,
          timestamp: Date.now(),
        },
        200,
      );
    }

    if (
      url.pathname.startsWith("/api/opensea/drop") ||
      (url.pathname.startsWith("/api/opensea") && url.searchParams.get("action") === "drop")
    ) {
      const slug = url.searchParams.get("slug") || "";
      if (!slug) {
        return jsonResponse({ error: "Slug required" }, 400);
      }
      const apiKey = getEnv("OPENSEA_API_KEY", runtimeEnv);
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
      const apiKey = getEnv("OPENSEA_API_KEY", runtimeEnv);

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
