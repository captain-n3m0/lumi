import { toast } from "sonner";

export interface ParsedBlockchainError {
  title: string;
  message: string;
  category:
    "user_rejection" | "revert" | "gas_limit" | "insufficient_funds" | "rpc_failure" | "unknown";
  rawMessage: string;
}

/**
 * Parses raw EVM, Wagmi, or Viem errors into structured, human-readable summaries.
 */
export function parseBlockchainError(error: unknown): ParsedBlockchainError {
  const errMessage = error instanceof Error ? error.message : String(error);
  const rawMessage = errMessage;

  // 1. User rejection
  if (
    errMessage.toLowerCase().includes("rejected") ||
    errMessage.toLowerCase().includes("user denied") ||
    errMessage.toLowerCase().includes("user rejected")
  ) {
    return {
      title: "Signature Rejected",
      message:
        "You declined the request in your wallet provider. The execution was aborted safely.",
      category: "user_rejection",
      rawMessage,
    };
  }

  // 2. Insufficient funds
  if (
    errMessage.toLowerCase().includes("insufficient funds") ||
    errMessage.toLowerCase().includes("insufficient balance") ||
    errMessage.toLowerCase().includes("transfer amount exceeds balance")
  ) {
    return {
      title: "Insufficient Balance",
      message:
        "The executing wallet does not have enough native token or gas to cover this transaction and its fees.",
      category: "insufficient_funds",
      rawMessage,
    };
  }

  // 3. Gas estimation / limits
  if (
    errMessage.toLowerCase().includes("intrinsic gas too low") ||
    errMessage.toLowerCase().includes("gas limit") ||
    errMessage.toLowerCase().includes("out of gas") ||
    errMessage.toLowerCase().includes("gas required exceeds allowance") ||
    errMessage.toLowerCase().includes("gas estimation failed")
  ) {
    return {
      title: "Gas Estimation Failed",
      message:
        "The transaction is likely to fail in its current state or requires higher gas parameters. Contract logic may have triggered a revert during simulation.",
      category: "gas_limit",
      rawMessage,
    };
  }

  // 4. Contract execution revert
  if (
    errMessage.toLowerCase().includes("revert") ||
    errMessage.toLowerCase().includes("execution reverted")
  ) {
    // Try to extract a clean revert reason if available (e.g. within quotes or after "reverted with the following reason:")
    let revertReason =
      "A contract revert occurred. The conditions required by the smart contract were not met.";

    const revertMatch =
      errMessage.match(/reverted with the following reason:\s*([^\n]+)/i) ||
      errMessage.match(/revert:\s*([^\n]+)/i) ||
      errMessage.match(/reason:\s*([^\n]+)/i);
    if (revertMatch && revertMatch[1]) {
      revertReason = `Reverted: ${revertMatch[1].trim()}`;
    }

    return {
      title: "Smart Contract Reverted",
      message: revertReason,
      category: "revert",
      rawMessage,
    };
  }

  // 5. RPC Failure or network issues
  if (
    errMessage.toLowerCase().includes("rpc") ||
    errMessage.toLowerCase().includes("network error") ||
    errMessage.toLowerCase().includes("failed to fetch") ||
    errMessage.toLowerCase().includes("timeout")
  ) {
    return {
      title: "EVM Node Connection Error",
      message:
        "Failed to broadcast or fetch status from the current blockchain node. Please verify your connection or toggle networks.",
      category: "rpc_failure",
      rawMessage,
    };
  }

  // 6. Generic or unknown fallback
  return {
    title: "On-Chain Execution Error",
    message: errMessage.length > 120 ? `${errMessage.slice(0, 120)}...` : errMessage,
    category: "unknown",
    rawMessage,
  };
}

/**
 * Dispatches a stylized sonner toast for a given blockchain exception.
 */
export function notifyBlockchainError(error: unknown) {
  const parsed = parseBlockchainError(error);

  if (parsed.category === "user_rejection") {
    toast.warning(parsed.title, {
      description: parsed.message,
      duration: 5000,
    });
    return;
  }

  // Show a rich developer-focused toast with a copy diagnostic action button
  toast.error(parsed.title, {
    description: parsed.message,
    duration: 8000,
    action: {
      label: "Copy Trace",
      onClick: () => {
        navigator.clipboard
          .writeText(parsed.rawMessage)
          .then(() => toast.success("Raw error trace copied to clipboard"))
          .catch(() => {});
      },
    },
  });
}
