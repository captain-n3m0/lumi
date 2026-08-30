import { useCallback, useMemo, useState, useEffect } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useBalance,
  useSignMessage,
  useSignTypedData,
  useSendTransaction,
  useWriteContract,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { type Address, type Hash, type Abi, parseEther, formatEther } from "viem";
import { SUPPORTED_CHAINS } from "@/lib/rpc";

export interface ConnectedWalletState {
  address: Address | null;
  chainId: number;
  isConnected: boolean;
  isConnecting: boolean;
  walletType: string;
  balanceFormatted: string;
  chainName: string;
  error: string | null;
}

export interface UseWalletReturn {
  // Account state
  address: Address | undefined;
  addresses: readonly Address[] | undefined;
  chainId: number | undefined;
  chain: ReturnType<typeof useAccount>["chain"];
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  isDisconnected: boolean;
  isMounted: boolean;
  status: ReturnType<typeof useAccount>["status"];
  connector: ReturnType<typeof useAccount>["connector"];
  walletType: string;
  chainName: string;

  // Balance
  balance: {
    value: bigint | undefined;
    formatted: string;
    symbol: string;
    decimals: number;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };
  balanceFormatted: string;
  refreshBalance: () => void;

  // Connection management
  connectors: ReturnType<typeof useConnect>["connectors"];
  connect: (connectorId?: string, chainId?: number) => Promise<void>;
  connectWallet: (connectorId?: string, chainId?: number) => Promise<void>;
  disconnect: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  switchChain: (chainId: number) => Promise<void>;

  // Signing & Auth methods
  signMessage: (message: string) => Promise<`0x${string}`>;
  signTypedData: (
    params: Parameters<ReturnType<typeof useSignTypedData>["signTypedDataAsync"]>[0],
  ) => Promise<`0x${string}`>;
  signInWithEthereum: (statement?: string) => Promise<{
    message: string;
    signature: `0x${string}`;
    address: Address;
    chainId: number;
  }>;
  requestAccounts: () => Promise<readonly Address[]>;

  // Direct EVM execution & contract interaction
  sendTransaction: (params: {
    to: Address;
    value?: bigint | string;
    data?: `0x${string}`;
    gas?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    chainId?: number;
  }) => Promise<Hash>;

  sendMintTransaction: (params: {
    to: Address;
    data?: `0x${string}`;
    valueWei?: bigint;
    chainId?: number;
  }) => Promise<Hash>;

  // Smart contract methods
  writeContract: (params: {
    address: Address;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
    value?: bigint;
    chainId?: number;
  }) => Promise<Hash>;

  // Viem low-level clients
  publicClient: ReturnType<typeof usePublicClient>;
  walletClient: ReturnType<typeof useWalletClient>["data"];

  // Errors & helpers
  error: string | Error | null;
  clearError: () => void;
  formatEth: (wei: bigint) => string;
  parseEth: (eth: string) => bigint;
}

function detectWalletBrand(connector?: ReturnType<typeof useAccount>["connector"]): string {
  if (!connector) return "metamask";
  const name = (connector.name || "").toLowerCase();
  const id = (connector.id || "").toLowerCase();

  if (name.includes("rabby") || id.includes("rabby")) return "rabby";
  if (name.includes("coinbase") || id.includes("coinbase")) return "coinbase";
  if (name.includes("rainbow") || id.includes("rainbow")) return "rainbow";
  if (name.includes("phantom") || id.includes("phantom")) return "phantom";
  if (name.includes("robinhood") || id.includes("robinhood")) return "robinhood";
  if (name.includes("metamask") || id.includes("metamask") || id.includes("io.metamask"))
    return "metamask";

  return "metamask";
}

export function useWallet(): UseWalletReturn {
  const [mounted, setMounted] = useState(false);
  const account = useAccount();
  const { connectors, connectAsync, error: connectError } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const [customError, setCustomError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const balanceQuery = useBalance({
    address: account.address,
    chainId: account.chainId as any,
  });

  const { signMessageAsync } = useSignMessage();
  const { signTypedDataAsync } = useSignTypedData();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const connect = useCallback(
    async (connectorId?: string, targetChainId?: number) => {
      setCustomError(null);
      try {
        let targetConnector = connectorId
          ? connectors.find(
              (c) =>
                c.id.toLowerCase() === connectorId.toLowerCase() ||
                c.name.toLowerCase() === connectorId.toLowerCase() ||
                c.id.toLowerCase().includes(connectorId.toLowerCase()) ||
                c.name.toLowerCase().includes(connectorId.toLowerCase()),
            )
          : null;

        if (!targetConnector) {
          targetConnector =
            connectors.find((c) => c.id === "injected" || c.type === "injected") || connectors[0];
        }

        if (!targetConnector) {
          throw new Error("No Web3 wallet connector available");
        }

        await connectAsync({
          connector: targetConnector,
          chainId: targetChainId as any,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to connect wallet";
        console.error("useWallet connect error:", err);
        setCustomError(message);
        throw err;
      }
    },
    [connectors, connectAsync],
  );

  const disconnect = useCallback(async () => {
    setCustomError(null);
    try {
      await disconnectAsync();
    } catch (err: unknown) {
      console.warn("useWallet disconnect error:", err);
    }
  }, [disconnectAsync]);

  const switchChain = useCallback(
    async (targetChainId: number) => {
      setCustomError(null);
      try {
        await switchChainAsync({ chainId: targetChainId as any });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to switch chain";
        console.error("useWallet switchChain error:", err);
        setCustomError(message);
        throw err;
      }
    },
    [switchChainAsync],
  );

  const signMessage = useCallback(
    async (message: string): Promise<`0x${string}`> => {
      setCustomError(null);
      try {
        return await signMessageAsync({ message });
      } catch (err: unknown) {
        const message_ = err instanceof Error ? err.message : "Sign message failed";
        setCustomError(message_);
        throw err;
      }
    },
    [signMessageAsync],
  );

  const signTypedData = useCallback(
    async (
      params: Parameters<ReturnType<typeof useSignTypedData>["signTypedDataAsync"]>[0],
    ): Promise<`0x${string}`> => {
      setCustomError(null);
      try {
        return await signTypedDataAsync(params);
      } catch (err: unknown) {
        const message_ = err instanceof Error ? err.message : "Sign typed data failed";
        setCustomError(message_);
        throw err;
      }
    },
    [signTypedDataAsync],
  );

  const requestAccounts = useCallback(async (): Promise<readonly Address[]> => {
    if (!account.isConnected) {
      const primaryConnector = connectors.find((c) => c.id === "injected") || connectors[0];
      if (primaryConnector) {
        const res = await connectAsync({ connector: primaryConnector });
        return res.accounts;
      }
    }
    return account.addresses || (account.address ? [account.address] : []);
  }, [account.isConnected, account.addresses, account.address, connectors, connectAsync]);

  const signInWithEthereum = useCallback(
    async (
      customStatement = "Sign this message to authenticate your wallet with Lumi Multi-Chain Matrix.",
    ) => {
      if (!account.address) {
        throw new Error("Wallet not connected. Connect your wallet first.");
      }

      const domain = typeof window !== "undefined" ? window.location.host : "lumi.network";
      const uri = typeof window !== "undefined" ? window.location.origin : "https://lumi.network";
      const issuedAt = new Date().toISOString();
      const nonce = Math.random().toString(36).substring(2, 15);

      const siweMessage = `${domain} wants you to sign in with your Ethereum account:
${account.address}

${customStatement}

URI: ${uri}
Version: 1
Chain ID: ${account.chainId || 1}
Nonce: ${nonce}
Issued At: ${issuedAt}`;

      const signature = await signMessageAsync({ message: siweMessage });

      return {
        message: siweMessage,
        signature,
        address: account.address,
        chainId: account.chainId || 1,
      };
    },
    [account.address, account.chainId, signMessageAsync],
  );

  const sendTransaction = useCallback(
    async (params: {
      to: Address;
      value?: bigint | string;
      data?: `0x${string}`;
      gas?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
      chainId?: number;
    }): Promise<Hash> => {
      setCustomError(null);
      const value =
        typeof params.value === "string" ? parseEther(params.value) : (params.value ?? 0n);

      const txParams: any = {
        to: params.to,
        value,
      };
      if (params.data !== undefined) txParams.data = params.data;
      if (params.gas !== undefined) txParams.gas = params.gas;
      if (params.maxFeePerGas !== undefined) txParams.maxFeePerGas = params.maxFeePerGas;
      if (params.maxPriorityFeePerGas !== undefined)
        txParams.maxPriorityFeePerGas = params.maxPriorityFeePerGas;
      if (params.chainId !== undefined) txParams.chainId = params.chainId;

      try {
        return await sendTransactionAsync(txParams);
      } catch (err: unknown) {
        const message_ = err instanceof Error ? err.message : "Transaction failed";
        setCustomError(message_);
        throw err;
      }
    },
    [sendTransactionAsync],
  );

  const sendMintTransaction = useCallback(
    async (params: {
      to: Address;
      data?: `0x${string}`;
      valueWei?: bigint;
      chainId?: number;
    }): Promise<Hash> => {
      const txParams: any = {
        to: params.to,
        value: params.valueWei || 0n,
      };
      if (params.data !== undefined) {
        txParams.data = params.data;
      }
      if (params.chainId !== undefined) {
        txParams.chainId = params.chainId;
      }
      return await sendTransaction(txParams);
    },
    [sendTransaction],
  );

  const writeContract = useCallback(
    async (params: {
      address: Address;
      abi: Abi;
      functionName: string;
      args?: readonly unknown[];
      value?: bigint;
      chainId?: number;
    }): Promise<Hash> => {
      setCustomError(null);
      try {
        const writeParams: any = {
          address: params.address,
          abi: params.abi,
          functionName: params.functionName,
        };
        if (params.args !== undefined) writeParams.args = params.args;
        if (params.value !== undefined) writeParams.value = params.value;
        if (params.chainId !== undefined) writeParams.chainId = params.chainId;

        return await writeContractAsync(writeParams);
      } catch (err: unknown) {
        const message_ = err instanceof Error ? err.message : "Contract write failed";
        setCustomError(message_);
        throw err;
      }
    },
    [writeContractAsync],
  );

  const balance = useMemo(() => {
    let formattedVal = "0.0000";
    if (balanceQuery.data?.value !== undefined) {
      const ethVal = formatEther(balanceQuery.data.value);
      formattedVal = parseFloat(ethVal).toFixed(4);
    }
    return {
      value: balanceQuery.data?.value,
      formatted: formattedVal,
      symbol: balanceQuery.data?.symbol || "ETH",
      decimals: balanceQuery.data?.decimals || 18,
      isLoading: balanceQuery.isLoading,
      refetch: () => balanceQuery.refetch(),
    };
  }, [balanceQuery]);

  const walletType = useMemo(() => detectWalletBrand(account.connector), [account.connector]);

  const chainName = useMemo(() => {
    if (account.chain?.name) return account.chain.name;
    if (account.chainId && SUPPORTED_CHAINS[account.chainId]) {
      return SUPPORTED_CHAINS[account.chainId]!.name;
    }
    return account.chainId ? `Chain ${account.chainId}` : "Ethereum";
  }, [account.chain, account.chainId]);

  const activeError = customError || connectError || null;

  return {
    address: mounted ? account.address : undefined,
    addresses: mounted ? account.addresses : undefined,
    chainId: mounted ? account.chainId : undefined,
    chain: mounted ? account.chain : undefined,
    isConnected: mounted ? account.isConnected : false,
    isConnecting: mounted ? account.isConnecting : false,
    isReconnecting: mounted ? account.isReconnecting : false,
    isDisconnected: mounted ? account.isDisconnected : true,
    isMounted: mounted,
    status: mounted ? account.status : "disconnected",
    connector: mounted ? account.connector : undefined,
    walletType: mounted ? walletType : "metamask",
    chainName: mounted ? chainName : "Ethereum",
    balance: mounted
      ? balance
      : {
          value: undefined,
          formatted: "0.0000",
          symbol: "ETH",
          decimals: 18,
          isLoading: false,
          refetch: () => balanceQuery.refetch(),
        },
    balanceFormatted: mounted ? balance.formatted : "0.0000",
    refreshBalance: () => {
      balanceQuery.refetch();
    },
    connectors,
    connect,
    connectWallet: connect,
    disconnect,
    disconnectWallet: disconnect,
    switchChain,
    signMessage,
    signTypedData,
    signInWithEthereum,
    requestAccounts,
    sendTransaction,
    sendMintTransaction,
    writeContract,
    publicClient,
    walletClient,
    error: activeError,
    clearError: () => setCustomError(null),
    formatEth: (wei: bigint) => formatEther(wei),
    parseEth: (eth: string) => parseEther(eth),
  };
}
