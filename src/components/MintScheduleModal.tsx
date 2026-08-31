import { useState, useEffect } from "react";
import {
  X,
  Clock,
  Zap,
  Check,
  AlertTriangle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Copy,
  ArrowRight,
  Shield,
  Wallet,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import { isValidEvmAddress, type OpenSeaCollection } from "@/lib/opensea";
import { addScheduledMint } from "@/lib/mintStore";
import { useManagedWallets } from "@/lib/walletStore";
import { queryOnChainContract, type OnChainContractInfo } from "@/lib/rpc";
import { getChainById } from "@/lib/chains";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { PlatformIcon } from "@/components/icons/PlatformIcons";
import { searchCollectionsUnified, type CollectionMintStage } from "@/lib/collectionSearch";
import { ImportWalletModal } from "@/components/ImportWalletModal";

interface MintScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: OpenSeaCollection | null;
  onSelectCollection?: (col: OpenSeaCollection) => void;
}

type RawDropStage = Record<string, unknown>;
type WalletEligibilityStatus =
  "eligible" | "ineligible" | "not_active" | "unknown" | "auth_error" | "drop_not_found" | "error";

interface DropStageEligibilityItem {
  stageId?: string;
  stageName?: string;
  eligible: boolean | null;
  reason?: string;
}

interface DropWalletEligibilityResult {
  address: string;
  eligible: boolean | null;
  status: WalletEligibilityStatus;
  reason?: string;
  stageEligibilities?: DropStageEligibilityItem[];
  source: "opensea-drop-details" | "opensea-mint-action" | "opensea";
}

interface DropEligibilityResponse {
  slug?: string;
  checked?: number;
  wallets?: DropWalletEligibilityResult[];
  timestamp?: number;
  error?: string;
}

type StageEligibilityStatus = "verified" | "ineligible" | "unknown" | "not_active" | "error";

interface StageEligibilitySummary {
  status: StageEligibilityStatus;
  eligibleCount: number;
  checkedCount: number;
  detail: string;
  sourceLabel: string;
}

interface EligibilityDisplay {
  label: string;
  detail: string;
  labelClass: string;
  pillClass: string;
  requiresVerification: boolean;
  warning?: string;
}

function readStageValue(stage: RawDropStage, keys: string[]): unknown {
  for (const key of keys) {
    if (stage[key] !== undefined && stage[key] !== null) return stage[key];
  }
  return undefined;
}

function parseStageString(stage: RawDropStage, keys: string[], fallback: string): string {
  const value = readStageValue(stage, keys);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function parseStageNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseStagePriceEth(value: unknown): number {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return parseStagePriceEth(
      record["eth"] ?? record["amount"] ?? record["value"] ?? record["price"],
    );
  }

  if (typeof value === "string" && /^\d{13,}$/.test(value.trim())) {
    try {
      return Number(BigInt(value.trim())) / 1e18;
    } catch {
      return 0;
    }
  }

  const parsed = parseStageNumber(value);
  return parsed !== undefined && parsed >= 0 ? parsed : 0;
}

function parseStageTimestamp(value: unknown): number | undefined {
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) {
      return asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000;
    }

    const parsedDate = Date.parse(trimmed);
    return Number.isFinite(parsedDate) ? parsedDate : undefined;
  }

  const parsed = parseStageNumber(value);
  if (parsed === undefined || parsed <= 0) return undefined;
  return parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
}

function parseStageKind(stage: RawDropStage): CollectionMintStage["kind"] {
  const raw = parseStageString(stage, ["stage_type", "stageType", "type", "kind", "label"], "");
  const normalized = raw.toLowerCase();

  if (normalized.includes("public")) return "public";
  if (normalized.includes("holder")) return "holder";
  if (normalized.includes("white")) return "whitelist";
  if (normalized.includes("allow") || normalized.includes("pre") || normalized.includes("signed")) {
    return "allowlist";
  }

  return "allowlist";
}

function normalizeDropStages(data: unknown, slug: string): CollectionMintStage[] {
  const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const nestedDrop =
    payload["drop"] && typeof payload["drop"] === "object"
      ? (payload["drop"] as Record<string, unknown>)
      : {};
  const rawStages = Array.isArray(payload["stages"])
    ? payload["stages"]
    : Array.isArray(nestedDrop["stages"])
      ? nestedDrop["stages"]
      : [];

  return rawStages
    .filter((stage): stage is RawDropStage => !!stage && typeof stage === "object")
    .map((stage, index) => {
      const stageType = parseStageString(
        stage,
        ["stage_type", "stageType", "type", "kind"],
        "Mint Stage",
      );
      const label = parseStageString(stage, ["label", "name", "title"], stageType);
      const startsAt =
        parseStageTimestamp(
          readStageValue(stage, ["start_time", "startTime", "starts_at", "startsAt"]),
        ) ?? Date.now();
      const endsAt = parseStageTimestamp(
        readStageValue(stage, ["end_time", "endTime", "ends_at", "endsAt"]),
      );
      const maxPerWallet =
        Math.max(
          1,
          Math.floor(
            parseStageNumber(
              readStageValue(stage, [
                "max_per_wallet",
                "maxPerWallet",
                "max_mints_per_wallet",
                "maxMintsPerWallet",
                "walletLimit",
              ]),
            ) ?? 1,
          ),
        ) || 1;
      const eligibleWalletsCount = parseStageNumber(
        readStageValue(stage, [
          "eligibleWalletsCount",
          "eligible_wallets_count",
          "eligibleWalletCount",
          "eligible_wallet_count",
        ]),
      );

      return {
        id: parseStageString(stage, ["uuid", "id", "stage_id", "stageId"], `${slug}-${index}`),
        name: label.toUpperCase(),
        kind: parseStageKind(stage),
        priceEth: parseStagePriceEth(readStageValue(stage, ["price", "mintPrice", "priceEth"])),
        maxPerWallet,
        startsAt,
        ...(endsAt !== undefined ? { endsAt } : {}),
        ...(eligibleWalletsCount !== undefined
          ? { eligibleWalletsCount: Math.max(0, Math.floor(eligibleWalletsCount)) }
          : {}),
        source: "opensea" as const,
        sourceLabel: "OpenSea Drop API",
      };
    })
    .sort((a, b) => a.startsAt - b.startsAt);
}

function normalizeEligibilityKey(value: string | undefined): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isRestrictedStage(stage: CollectionMintStage): boolean {
  return stage.kind !== "public";
}

function isStageActiveForEligibility(stage: CollectionMintStage): boolean {
  const now = Date.now();
  return stage.startsAt <= now && (!stage.endsAt || stage.endsAt > now);
}

function matchesStageEligibility(
  stage: CollectionMintStage,
  item: DropStageEligibilityItem,
): boolean {
  const stageId = normalizeEligibilityKey(stage.id);
  const itemId = normalizeEligibilityKey(item.stageId);
  const stageName = normalizeEligibilityKey(stage.name);
  const itemName = normalizeEligibilityKey(item.stageName);

  if (itemId && itemId === stageId) return true;
  if (itemName && itemName === stageName) return true;
  if (itemName && stageName.includes(itemName)) return true;
  if (stageName && itemName.includes(stageName)) return true;

  return false;
}

function summarizeOpenSeaEligibility(
  stages: CollectionMintStage[],
  wallets: DropWalletEligibilityResult[],
): Record<string, StageEligibilitySummary> {
  const summaries: Record<string, StageEligibilitySummary> = {};

  for (const stage of stages) {
    if (!isRestrictedStage(stage)) continue;

    let eligibleCount = 0;
    let checkedCount = 0;
    let matchedUnknown = 0;
    const reasons: string[] = [];

    for (const wallet of wallets) {
      const match = (wallet.stageEligibilities ?? []).find((item) =>
        matchesStageEligibility(stage, item),
      );
      if (!match) continue;

      if (match.reason && !reasons.includes(match.reason)) {
        reasons.push(match.reason);
      }
      if (match.eligible === null) {
        matchedUnknown += 1;
        continue;
      }

      checkedCount += 1;
      if (match.eligible) eligibleCount += 1;
    }

    if (checkedCount > 0 || matchedUnknown > 0) {
      summaries[stage.id] = {
        status: eligibleCount > 0 ? "verified" : checkedCount > 0 ? "ineligible" : "unknown",
        eligibleCount,
        checkedCount,
        detail:
          reasons[0] ||
          (eligibleCount > 0
            ? "OpenSea confirmed wallet eligibility for this phase."
            : checkedCount > 0
              ? "OpenSea checked this phase and found no eligible imported wallets."
              : "OpenSea returned this phase but did not expose wallet-specific proof."),
        sourceLabel: "OpenSea eligibility",
      };
    }
  }

  const activeRestrictedStages = stages.filter(
    (stage) => isRestrictedStage(stage) && isStageActiveForEligibility(stage),
  );
  const activeStage = activeRestrictedStages.length === 1 ? activeRestrictedStages[0] : undefined;

  if (activeStage && !summaries[activeStage.id]) {
    const eligibleCount = wallets.filter((wallet) => wallet.eligible === true).length;
    const ineligibleCount = wallets.filter(
      (wallet) => wallet.status === "ineligible" || wallet.eligible === false,
    ).length;
    const notActiveCount = wallets.filter((wallet) => wallet.status === "not_active").length;
    const checkedCount = eligibleCount + ineligibleCount;
    const firstReason = wallets.find((wallet) => wallet.reason)?.reason;

    if (eligibleCount > 0) {
      summaries[activeStage.id] = {
        status: "verified",
        eligibleCount,
        checkedCount: wallets.length,
        detail: firstReason || "OpenSea built a mint transaction for this wallet.",
        sourceLabel: "OpenSea mint check",
      };
    } else if (ineligibleCount > 0 && ineligibleCount === wallets.length) {
      summaries[activeStage.id] = {
        status: "ineligible",
        eligibleCount: 0,
        checkedCount,
        detail: firstReason || "OpenSea could not build a mint transaction for these wallets.",
        sourceLabel: "OpenSea mint check",
      };
    } else if (notActiveCount > 0 && notActiveCount === wallets.length) {
      summaries[activeStage.id] = {
        status: "not_active",
        eligibleCount: 0,
        checkedCount: wallets.length,
        detail: firstReason || "OpenSea says this phase is not active for minting yet.",
        sourceLabel: "OpenSea mint check",
      };
    }
  }

  return summaries;
}

function getEligibilityDisplay(
  stage: CollectionMintStage,
  walletCount: number,
  openSeaSummary?: StageEligibilitySummary,
  isChecking = false,
): EligibilityDisplay {
  if (walletCount === 0) {
    return {
      label: "0",
      detail: "No imported wallets",
      labelClass: "text-muted-foreground",
      pillClass: "border-border/60 bg-card",
      requiresVerification: false,
    };
  }

  if (openSeaSummary?.status === "verified") {
    return {
      label: `${openSeaSummary.eligibleCount}/${walletCount}`,
      detail: openSeaSummary.detail,
      labelClass: "text-emerald-400",
      pillClass: "border-emerald-500/30 bg-emerald-500/10",
      requiresVerification: false,
    };
  }

  if (openSeaSummary?.status === "ineligible") {
    return {
      label: "0",
      detail: openSeaSummary.detail,
      labelClass: "text-rose-400",
      pillClass: "border-rose-500/30 bg-rose-500/10",
      requiresVerification: false,
      warning: "OpenSea checked the imported wallets and did not find eligibility for this phase.",
    };
  }

  if (openSeaSummary?.status === "not_active") {
    return {
      label: "Not active",
      detail: openSeaSummary.detail,
      labelClass: "text-muted-foreground",
      pillClass: "border-border/60 bg-card",
      requiresVerification: false,
    };
  }

  if (openSeaSummary?.status === "error") {
    return {
      label: "Check failed",
      detail: openSeaSummary.detail,
      labelClass: "text-amber-400",
      pillClass: "border-amber-500/30 bg-amber-500/10",
      requiresVerification: true,
      warning: "OpenSea could not verify wallet eligibility for this phase.",
    };
  }

  if (openSeaSummary?.status === "unknown") {
    return {
      label: "Unverified",
      detail: openSeaSummary.detail,
      labelClass: "text-amber-400",
      pillClass: "border-amber-500/30 bg-amber-500/10",
      requiresVerification: true,
      warning: openSeaSummary.detail,
    };
  }

  if (stage.kind === "public") {
    return {
      label: String(walletCount),
      detail: "Public phase",
      labelClass: "text-emerald-400",
      pillClass: "border-emerald-500/30 bg-emerald-500/10",
      requiresVerification: false,
    };
  }

  if (isChecking) {
    return {
      label: "Checking...",
      detail: "Checking imported wallets with OpenSea",
      labelClass: "text-amber-400",
      pillClass: "border-amber-500/30 bg-amber-500/10",
      requiresVerification: false,
    };
  }

  if (typeof stage.eligibleWalletsCount === "number") {
    return {
      label: String(stage.eligibleWalletsCount),
      detail: "Source-reported allowlist size",
      labelClass: stage.eligibleWalletsCount > 0 ? "text-emerald-400" : "text-rose-400",
      pillClass:
        stage.eligibleWalletsCount > 0
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-rose-500/30 bg-rose-500/10",
      requiresVerification: true,
      warning: "This is the phase allowlist size, not wallet-specific verification.",
    };
  }

  return {
    label: "Unverified",
    detail: "Allowlist proof required",
    labelClass: "text-amber-400",
    pillClass: "border-amber-500/30 bg-amber-500/10",
    requiresVerification: true,
    warning:
      "Imported wallets are valid, but OpenSea has not confirmed allowlist proof for this phase.",
  };
}

export function MintScheduleModal({
  open,
  onOpenChange,
  collection: initialCollection,
  onSelectCollection,
}: MintScheduleModalProps) {
  const [activeCollection, setActiveCollection] = useState<OpenSeaCollection | null>(
    initialCollection,
  );
  const [urlInput, setUrlInput] = useState("");
  const [isUrlSearching, setIsUrlSearching] = useState(false);
  const [showEnded, setShowEnded] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Selected stage for scheduling
  const [selectedStage, setSelectedStage] = useState<CollectionMintStage | null>(null);
  const [walletsCount, setWalletsCount] = useState(3);
  const [quantity, setQuantity] = useState(1);
  const [gasPriority, setGasPriority] = useState<"aggressive" | "normal" | "custom">("aggressive");
  const [success, setSuccess] = useState(false);

  const [directError, setDirectError] = useState<string | null>(null);
  const [contractDetails, setContractDetails] = useState<OnChainContractInfo | null>(null);
  const [copiedContract, setCopiedContract] = useState(false);

  const { wallets } = useManagedWallets();

  // Keep collection in sync
  useEffect(() => {
    if (initialCollection) {
      setActiveCollection(initialCollection);
      setUrlInput(initialCollection.openseaUrl || initialCollection.contractAddress || "");
    }
  }, [initialCollection]);

  // Reset state when opening
  useEffect(() => {
    if (open && activeCollection) {
      setSuccess(false);
      setDirectError(null);
      setSelectedStage(null);
      setContractDetails(null);
      if (isValidEvmAddress(activeCollection.contractAddress)) {
        const chain = getChainById(activeCollection.chain || "ethereum");
        queryOnChainContract(activeCollection.contractAddress, chain.chainId)
          .then(setContractDetails)
          .catch(() => {});
      }
    }
  }, [open, activeCollection]);

  const [stages, setStages] = useState<CollectionMintStage[]>([]);
  const [isLoadingStages, setIsLoadingStages] = useState(false);
  const [stageLoadError, setStageLoadError] = useState<string | null>(null);
  const [stageEligibility, setStageEligibility] = useState<Record<string, StageEligibilitySummary>>(
    {},
  );
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  // Reset or load stages when activeCollection changes
  useEffect(() => {
    if (!activeCollection) {
      setStages([]);
      setStageLoadError(null);
      setStageEligibility({});
      setEligibilityError(null);
      return;
    }

    let isMounted = true;
    const loadStages = async () => {
      setStages([]);
      setStageLoadError(null);
      setStageEligibility({});
      setEligibilityError(null);
      setIsLoadingStages(true);

      const slug = activeCollection.slug || "";
      const chain = getChainById(activeCollection.chain || "ethereum");
      const canQueryOpenSeaDrop =
        !!slug && !isValidEvmAddress(slug) && activeCollection.collection !== "custom";

      try {
        if (canQueryOpenSeaDrop) {
          const res = await fetch(`/api/opensea/drop?slug=${encodeURIComponent(slug)}`);
          if (res.ok) {
            const data = await res.json();
            const mapped = normalizeDropStages(data, slug);
            if (isMounted && mapped.length > 0) {
              setStages(mapped);
              setIsLoadingStages(false);
              return;
            }
          }
        }

        if (isValidEvmAddress(activeCollection.contractAddress)) {
          const params = new URLSearchParams({
            address: activeCollection.contractAddress,
            chainId: String(chain.chainId),
          });
          const res = await fetch(`/api/contract/mint-stages?${params.toString()}`);
          if (res.ok) {
            const data = (await res.json()) as { stages?: CollectionMintStage[] };
            const contractStages = (data.stages ?? []).filter(
              (stage) =>
                typeof stage.name === "string" &&
                typeof stage.priceEth === "number" &&
                typeof stage.maxPerWallet === "number" &&
                typeof stage.startsAt === "number",
            );
            if (isMounted && contractStages.length > 0) {
              setStages(contractStages);
              setIsLoadingStages(false);
              return;
            }
          }
        }

        if (isMounted) {
          setStages([]);
          setStageLoadError(
            "No OpenSea Drop stages or supported on-chain mint phase were found. Add a verified phase manually if you have the live mint details.",
          );
          setIsLoadingStages(false);
          return;
        }
      } catch (err) {
        console.warn("Failed to fetch live stages:", err);
        if (isMounted) {
          setStages([]);
          setStageLoadError(
            "Live stage lookup failed. Add a verified phase manually if you have the mint details from the project or contract.",
          );
          setIsLoadingStages(false);
        }
      }
    };

    loadStages();

    return () => {
      isMounted = false;
    };
  }, [activeCollection]);

  const walletAddressesKey = wallets
    .map((wallet) => wallet.address)
    .filter(isValidEvmAddress)
    .join(",");

  useEffect(() => {
    if (!open || !activeCollection || stages.length === 0 || !walletAddressesKey) {
      setStageEligibility({});
      setEligibilityError(null);
      setIsCheckingEligibility(false);
      return;
    }

    const restrictedStages = stages.filter(isRestrictedStage);
    const slug = activeCollection.slug || activeCollection.collection || "";
    const canCheckOpenSeaDrop =
      restrictedStages.length > 0 &&
      !!slug &&
      !isValidEvmAddress(slug) &&
      activeCollection.collection !== "custom";

    if (!canCheckOpenSeaDrop) {
      setStageEligibility({});
      setEligibilityError(null);
      setIsCheckingEligibility(false);
      return;
    }

    const walletAddressList = walletAddressesKey.split(",").filter(Boolean);
    const safeQuantity = Math.min(100, Math.max(1, Math.floor(quantity) || 1));
    let isMounted = true;

    const checkEligibility = async () => {
      setIsCheckingEligibility(true);
      setEligibilityError(null);
      setStageEligibility({});

      try {
        const res = await fetch("/api/opensea/drop/eligibility", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug,
            wallets: walletAddressList,
            quantity: safeQuantity,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as DropEligibilityResponse;

        if (!res.ok) {
          throw new Error(data.error || `OpenSea eligibility check returned ${res.status}`);
        }

        const walletResults = data.wallets ?? [];
        const summaries = summarizeOpenSeaEligibility(stages, walletResults);

        if (!isMounted) return;
        setStageEligibility(summaries);

        const hasUsableSummary = Object.keys(summaries).length > 0;
        const statuses = new Set(walletResults.map((wallet) => wallet.status));
        if (!hasUsableSummary && statuses.has("auth_error")) {
          setEligibilityError(
            "OpenSea rejected the eligibility request. Check the API key or wallet-scoped eligibility permissions.",
          );
        } else if (!hasUsableSummary && statuses.has("drop_not_found")) {
          setEligibilityError("OpenSea did not find an active drop for this collection slug.");
        } else if (!hasUsableSummary && statuses.has("not_active")) {
          setEligibilityError(
            "OpenSea says minting is not active right now, so wallet eligibility cannot be confirmed yet.",
          );
        } else if (!hasUsableSummary && walletResults.length > 0) {
          setEligibilityError(
            "OpenSea did not expose wallet-specific allowlist proof for these phases.",
          );
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setStageEligibility({});
        setEligibilityError(
          err instanceof Error ? err.message : "OpenSea eligibility check failed",
        );
      } finally {
        if (isMounted) {
          setIsCheckingEligibility(false);
        }
      }
    };

    checkEligibility();

    return () => {
      isMounted = false;
    };
  }, [activeCollection, open, quantity, stages, walletAddressesKey]);

  // Stage inline editor states
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [editMax, setEditMax] = useState(1);
  const [editStartsAt, setEditStartsAt] = useState("");

  const formatTimestampForInput = (timestamp: number) => {
    const date = new Date(timestamp);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  };

  const parseInputToTimestamp = (inputValue: string) => {
    return new Date(inputValue).getTime();
  };

  const startEditing = (stage: CollectionMintStage) => {
    setEditingStageId(stage.id);
    setEditName(stage.name);
    setEditPrice(stage.priceEth);
    setEditMax(stage.maxPerWallet);
    setEditStartsAt(formatTimestampForInput(stage.startsAt));
  };

  const saveEditing = (id: string) => {
    setStages(
      stages.map((st) => {
        if (st.id === id) {
          const startsAt = editStartsAt ? parseInputToTimestamp(editStartsAt) : Date.now();
          return {
            ...st,
            name: editName,
            priceEth: editPrice,
            maxPerWallet: editMax,
            startsAt,
          };
        }
        return st;
      }),
    );
    setEditingStageId(null);
  };

  const cancelEditing = () => {
    setEditingStageId(null);
  };

  const handleDeleteStage = (id: string) => {
    setStages(stages.filter((st) => st.id !== id));
    if (selectedStage?.id === id) {
      setSelectedStage(null);
    }
  };

  const handleAddStage = () => {
    const nowTimestamp = Date.now();
    const newStage: CollectionMintStage = {
      id: `manual-${nowTimestamp}`,
      name: "MANUAL PHASE",
      kind: "public",
      priceEth: 0,
      maxPerWallet: 1,
      startsAt: nowTimestamp,
      source: "manual",
      sourceLabel: "Manual verification",
    };
    setStages([...stages, newStage]);
    startEditing(newStage);
  };

  // Live countdown timer ticker (ticks every second)
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!open || !activeCollection) return null;

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setIsUrlSearching(true);
    setDirectError(null);
    try {
      const results = await searchCollectionsUnified(urlInput.trim());
      const firstResult = results[0];
      if (firstResult) {
        setActiveCollection(firstResult);
        if (onSelectCollection) onSelectCollection(firstResult);
        setSelectedStage(null);
      } else {
        setDirectError("No live collection or on-chain contract was found for that input.");
      }
    } catch (err: unknown) {
      setDirectError(err instanceof Error ? err.message : "Collection lookup failed");
    } finally {
      setIsUrlSearching(false);
    }
  };

  const formatCountdown = (targetMs: number) => {
    const diff = targetMs - now;
    if (diff <= 0) return "Live Now";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) {
      return `Starts in ${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
    return `Starts in ${hours}h ${minutes}m ${seconds}s`;
  };

  const isStageEnded = (stage: CollectionMintStage) => {
    if (stage.endsAt && stage.endsAt < now) return true;
    return false;
  };

  const filteredStages = stages.filter((st) => {
    if (!showEnded && isStageEnded(st)) return false;
    return true;
  });
  const hasContractAddress = isValidEvmAddress(activeCollection.contractAddress);
  const collectionChain = getChainById(activeCollection.chain || "ethereum");

  const handleCopyContract = () => {
    if (!hasContractAddress) return;
    navigator.clipboard.writeText(activeCollection.contractAddress);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2000);
  };

  const handleScheduleStage = (stage: CollectionMintStage) => {
    setDirectError(null);
    if (!hasContractAddress) {
      setDirectError("Add a valid contract address before scheduling this mint.");
      return;
    }
    if (wallets.length === 0) {
      setDirectError("Import at least one wallet before scheduling an automated mint task.");
      return;
    }

    const scheduledTime = Math.max(Date.now() + 500, stage.startsAt);
    const targetWallets = Math.min(Math.max(1, walletsCount), wallets.length);

    addScheduledMint({
      collectionName: `${activeCollection.name} — ${stage.name}`,
      contractAddress: activeCollection.contractAddress,
      chain: activeCollection.chain || "ethereum",
      imageUrl: activeCollection.imageUrl,
      stage: "Scheduled",
      scheduledTime,
      walletsCount: targetWallets,
      quantityPerWallet: quantity,
      gasPriority,
    });

    setSuccess(true);
    setTimeout(() => {
      onOpenChange(false);
      setSuccess(false);
    }, 1200);
  };

  const shortAddress = (addr: string) => {
    if (!addr || addr.length < 10) return "No contract";
    return `${addr.slice(0, 6)}...${addr.slice(-5)}`.toUpperCase();
  };

  const totalSupply = contractDetails?.totalSupply
    ? contractDetails.totalSupply.toString()
    : activeCollection.itemCount > 0
      ? activeCollection.itemCount.toLocaleString()
      : null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
        <div className="w-full max-w-2xl rounded-2xl border border-border/80 bg-card text-foreground shadow-2xl overflow-hidden relative my-auto">
          {/* Top Bar: URL Input Bar with Send Button + Close X */}
          <div className="p-4 bg-muted/40 border-b border-border/60 flex items-center gap-2">
            <form onSubmit={handleUrlSubmit} className="flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="OpenSea URL, launchpad URL, or 0x contract"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <button
                type="submit"
                disabled={isUrlSearching}
                aria-label="Inspect URL"
                className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition active:scale-95 cursor-pointer shrink-0"
              >
                {isUrlSearching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
              </button>
            </form>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close modal"
              className="size-9 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="p-4 sm:p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
            {/* Hero Banner Card */}
            <div className="relative rounded-2xl overflow-hidden border border-border/80 bg-neutral-900 shadow-md">
              {/* Background Art / Landscape */}
              <div className="h-32 sm:h-36 w-full relative bg-gradient-to-r from-zinc-950 via-slate-900 to-neutral-950">
                {activeCollection.imageUrl ? (
                  <img
                    src={activeCollection.imageUrl}
                    alt={activeCollection.name}
                    className="w-full h-full object-cover opacity-45 mix-blend-luminosity blur-2xs"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-4xl font-black tracking-wider text-white/15">
                    {activeCollection.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              </div>

              {/* Avatar & Info overlay */}
              <div className="absolute inset-0 p-4 sm:p-5 flex items-end justify-between">
                <div className="flex items-end gap-3.5 min-w-0">
                  {/* Collection Avatar with Chain Icon badge */}
                  <div className="relative size-16 sm:size-20 rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl shrink-0 bg-black">
                    {activeCollection.imageUrl ? (
                      <img
                        src={activeCollection.imageUrl}
                        alt={activeCollection.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-primary/20 text-sm font-black text-primary">
                        {activeCollection.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {/* Chain Badge on corner */}
                    <div className="absolute top-1.5 left-1.5 p-1 rounded-lg bg-black/70 backdrop-blur-xs border border-white/20">
                      <ChainIcon
                        chainId={activeCollection.chain || "ethereum"}
                        className="size-3.5"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 min-w-0 pb-1">
                    <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-wider truncate uppercase font-sans">
                      {activeCollection.name}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyContract}
                        disabled={!hasContractAddress}
                        className="flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 px-2 py-0.5 text-[11px] font-mono text-white/90 transition cursor-pointer backdrop-blur-xs"
                      >
                        <span>{shortAddress(activeCollection.contractAddress)}</span>
                        {copiedContract ? (
                          <Check className="size-3 text-emerald-400" />
                        ) : (
                          <Copy className="size-3 text-white/70" />
                        )}
                      </button>
                      {hasContractAddress && (
                        <a
                          href={`${collectionChain.blockExplorer}/address/${activeCollection.contractAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white/60 hover:text-white transition"
                          title="View on Block Explorer"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contract Supply */}
                <div className="hidden sm:flex flex-col items-end gap-1.5 pb-1">
                  <div className="rounded-lg bg-black/60 backdrop-blur-md px-3 py-1.5 border border-white/10 text-xs font-mono text-white/90">
                    <span className="text-white/60 mr-1.5">Supply</span>
                    <span className="font-bold text-white">{totalSupply ?? "Unavailable"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Link to OpenSea */}
            <div className="flex items-center justify-end">
              {activeCollection.openseaUrl && (
                <a
                  href={activeCollection.openseaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition"
                >
                  <span>Open in</span>
                  <PlatformIcon platform="opensea" className="size-3.5" />
                  <span className="underline font-medium">opensea.io</span>
                </a>
              )}
            </div>

            {/* Wallet Status Warning Alert Banner */}
            {wallets.length === 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-3 text-amber-500">
                <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5 text-xs">
                  <span className="font-bold text-foreground">No wallets imported</span>
                  <p className="text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => setImportModalOpen(true)}
                      className="underline font-semibold text-amber-500 hover:text-amber-400 cursor-pointer"
                    >
                      Import wallets
                    </button>{" "}
                    to check eligibility and schedule automated mints.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between text-xs text-emerald-400">
                <div className="flex items-center gap-2">
                  <Shield className="size-4" />
                  <span>
                    <strong>{wallets.length} Wallets</strong> configured & ready in matrix
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setImportModalOpen(true)}
                  className="underline text-[11px] hover:text-emerald-300 cursor-pointer"
                >
                  Manage Wallets
                </button>
              </div>
            )}

            {/* Show Ended Toggle */}
            <div className="flex items-center justify-end gap-3 pb-1">
              <span className="text-xs text-muted-foreground font-medium">Show ended</span>
              <button
                type="button"
                role="switch"
                aria-checked={showEnded}
                onClick={() => setShowEnded(!showEnded)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  showEnded ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    showEnded ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {directError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span className="truncate">{directError}</span>
              </div>
            )}

            {isCheckingEligibility && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
                <Loader2 className="size-4 shrink-0 animate-spin" />
                <span>Checking imported wallets against OpenSea eligibility...</span>
              </div>
            )}

            {eligibilityError && !isCheckingEligibility && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>{eligibilityError}</span>
              </div>
            )}

            {/* Mint Stages / Phases List */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Mint Stages & Allowlist Phases
                </span>
                <button
                  type="button"
                  onClick={handleAddStage}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors border border-primary/20 bg-primary/5 hover:bg-primary/10 px-2.5 py-1.5 rounded-lg cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Add Stage</span>
                </button>
              </div>

              {isLoadingStages ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 border border-dashed border-border rounded-2xl bg-muted/20 animate-pulse">
                  <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold text-muted-foreground">
                    Fetching real-time contract mint stages...
                  </span>
                </div>
              ) : filteredStages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center border border-dashed border-border rounded-2xl bg-muted/10">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-foreground">
                      No live mint stages found
                    </span>
                    <span className="text-xs text-muted-foreground max-w-md">
                      {stageLoadError ||
                        "The connected data sources did not return phase metadata for this collection."}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddStage}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/10 cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Add Verified Stage</span>
                  </button>
                </div>
              ) : (
                filteredStages.map((stage) => {
                  const isSelected = selectedStage?.id === stage.id;
                  const countdown = formatCountdown(stage.startsAt);
                  const isEnded = isStageEnded(stage);
                  const isLive = countdown === "Live Now";
                  const eligibility = getEligibilityDisplay(
                    stage,
                    wallets.length,
                    stageEligibility[stage.id],
                    isCheckingEligibility,
                  );

                  if (editingStageId === stage.id) {
                    return (
                      <div
                        key={stage.id}
                        className="relative rounded-2xl border border-primary bg-card p-4 flex flex-col gap-3.5 shadow-md animate-in fade-in duration-150"
                      >
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-muted-foreground uppercase">
                            Phase Name
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value.toUpperCase())}
                            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase">
                              Price ({activeCollection.chain || "ETH"})
                            </label>
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              value={editPrice}
                              onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm font-mono text-foreground outline-none focus:border-primary"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase">
                              Max Per Wallet
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={editMax}
                              onChange={(e) => setEditMax(parseInt(e.target.value) || 1)}
                              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm font-mono text-foreground outline-none focus:border-primary"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-muted-foreground uppercase">
                            Starts At (Local Time)
                          </label>
                          <input
                            type="datetime-local"
                            value={editStartsAt}
                            onChange={(e) => setEditStartsAt(e.target.value)}
                            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm font-mono text-foreground outline-none focus:border-primary"
                          />
                        </div>

                        <div className="flex justify-end gap-2 mt-1">
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="px-3.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-muted-foreground transition cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditing(stage.id)}
                            className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={stage.id}
                      className={`relative rounded-2xl border transition-all ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                          : "border-border/80 bg-muted/20 hover:border-border"
                      } ${isEnded ? "opacity-60" : ""}`}
                    >
                      {/* Top-left tab badge for Countdown / Status */}
                      <div className="absolute -top-3 left-4">
                        <div
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-[11px] font-mono font-bold shadow-xs border ${
                            isLive
                              ? "bg-emerald-500 text-black border-emerald-400"
                              : isEnded
                                ? "bg-muted text-muted-foreground border-border"
                                : "bg-card text-foreground border-border/80"
                          }`}
                        >
                          <Clock className="size-3" />
                          <span>{isEnded ? "Phase Ended" : countdown}</span>
                        </div>
                      </div>

                      <div className="p-4 pt-5 flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight uppercase truncate">
                              {stage.name}
                            </h3>
                            <div className="flex items-center gap-1 shrink-0 opacity-45 hover:opacity-100 transition-opacity ml-1.5">
                              <button
                                type="button"
                                onClick={() => startEditing(stage)}
                                className="p-1 hover:text-primary transition hover:bg-muted rounded-md"
                                title="Edit Stage Specs"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStage(stage.id)}
                                className="p-1 hover:text-rose-400 transition hover:bg-muted rounded-md"
                                title="Delete Stage"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setSelectedStage(isSelected ? null : stage)}
                              title="Configure multi-wallet scheduled mint for this stage"
                              className={`size-9 rounded-xl border flex items-center justify-center transition cursor-pointer ${
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-card hover:bg-muted text-foreground border-border/80"
                              }`}
                            >
                              <Wallet className="size-4" />
                            </button>
                          </div>
                        </div>

                        {/* Info Pills: Price & Eligible */}
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <div className="inline-flex items-center gap-1.5 rounded-lg bg-card border border-border/60 px-2.5 py-1 font-mono">
                            <span className="text-[10px] text-muted-foreground font-sans font-semibold">
                              PRICE •
                            </span>
                            <span className="font-bold text-foreground">
                              {stage.priceEth === 0 ? "0" : stage.priceEth}
                            </span>
                            <ChainIcon
                              chainId={activeCollection.chain || "ethereum"}
                              className="size-3.5"
                            />
                          </div>

                          <div
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono ${eligibility.pillClass}`}
                            title={eligibility.detail}
                          >
                            <span className="text-[10px] text-muted-foreground font-sans font-semibold">
                              ELIGIBILITY •
                            </span>
                            <span className={`font-bold ${eligibility.labelClass}`}>
                              {eligibility.label}
                            </span>
                          </div>

                          <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
                            <span>Max {stage.maxPerWallet}/wallet</span>
                          </div>

                          {stage.sourceLabel && (
                            <div className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                              <Shield className="size-3 text-primary" />
                              <span>{stage.sourceLabel}</span>
                            </div>
                          )}
                        </div>

                        {/* If stage is selected: show configuration parameters */}
                        {isSelected && (
                          <div className="mt-2 pt-3 border-t border-border/60 flex flex-col gap-3 animate-in fade-in duration-150">
                            {(eligibility.requiresVerification || eligibility.warning) && (
                              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-muted-foreground flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                                <span>{eligibility.warning || eligibility.detail}</span>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-medium text-muted-foreground">
                                  Participating Wallets
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={walletsCount}
                                  onChange={(e) => setWalletsCount(Number(e.target.value))}
                                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-medium text-muted-foreground">
                                  Quantity / Wallet
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={stage.maxPerWallet || 10}
                                  value={quantity}
                                  onChange={(e) => setQuantity(Number(e.target.value))}
                                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-1.5">
                                {(["aggressive", "normal"] as const).map((p) => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => setGasPriority(p)}
                                    className={`capitalize px-2.5 py-1 text-[11px] rounded-lg border font-medium transition cursor-pointer ${
                                      gasPriority === p
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-card text-muted-foreground border-border hover:bg-muted"
                                    }`}
                                  >
                                    {p}
                                  </button>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleScheduleStage(stage)}
                                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                              >
                                <Zap className="size-3.5" />
                                <span>Schedule Drop</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Actions */}
            <div className="mt-2 pt-4 border-t border-border/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const target = selectedStage || stages[0];
                  if (target) handleScheduleStage(target);
                }}
                disabled={success || stages.length === 0}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary via-indigo-600 to-purple-600 text-white font-bold text-xs sm:text-sm shadow-md hover:brightness-110 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {success ? (
                  <>
                    <Check className="size-4" />
                    <span>Task Scheduled!</span>
                  </>
                ) : selectedStage ? (
                  <>
                    <Zap className="size-4" />
                    <span>Schedule {selectedStage.name}</span>
                  </>
                ) : (
                  <>
                    <Zap className="size-4" />
                    <span>Schedule Main Mint Phase</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl text-muted-foreground hover:bg-muted transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      <ImportWalletModal open={importModalOpen} onOpenChange={setImportModalOpen} />
    </>
  );
}
