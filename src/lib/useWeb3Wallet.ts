import { useState, useEffect, useCallback } from "react";
import { createWalletClient, custom, type Address, type Hash, type EIP1193Provider } from "viem";
import { mainnet } from "viem/chains";
import { getLiveWalletBalance, SUPPORTED_CHAINS } from "./rpc";

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

interface EthereumWindow extends Window {
  ethereum?: EIP1193Provider & {
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    isMetaMask?: boolean;
    isRabby?: boolean;
    isCoinbaseWallet?: boolean;
    isRainbow?: boolean;
    isPhantom?: boolean;
    isRobinhood?: boolean;
  };
  robinhood?: EIP1193Provider;
}

function detectProviderWalletType(win: EthereumWindow): string {
  if (win.ethereum?.isRobinhood || win.robinhood) return "robinhood";
  if (win.ethereum?.isRabby) return "rabby";
  if (win.ethereum?.isCoinbaseWallet) return "coinbase";
  if (win.ethereum?.isRainbow) return "rainbow";
  if (win.ethereum?.isPhantom) return "phantom";
  if (win.ethereum?.isMetaMask) return "metamask";
  return "metamask";
}

export function useWeb3Wallet() {
  const [state, setState] = useState<ConnectedWalletState>({
    address: null,
    chainId: 1,
    isConnected: false,
    isConnecting: false,
    walletType: "metamask",
    balanceFormatted: "0.00",
    chainName: "Ethereum",
    error: null,
  });

  const updateBalance = useCallback(async (addr: Address, chainId: number) => {
    try {
      const { balanceFormatted } = await getLiveWalletBalance(addr, chainId);
      setState((prev) => ({
        ...prev,
        balanceFormatted: parseFloat(balanceFormatted).toFixed(4),
      }));
    } catch {
      // ignore
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (typeof window === "undefined") return;

    const win = window as unknown as EthereumWindow;
    const ethereum = win.ethereum;
    if (!ethereum) {
      setState((prev) => ({
        ...prev,
        error: "No Web3 browser wallet found (MetaMask, Rabby, Robinhood Wallet, Coinbase)",
      }));
      return;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const detectedType = detectProviderWalletType(win);
      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      const chainIdHex = (await ethereum.request({
        method: "eth_chainId",
      })) as string;

      const chainId = parseInt(chainIdHex, 16) || 1;
      const addr = accounts[0]?.toLowerCase() as Address;

      if (!addr) {
        throw new Error("No accounts authorized");
      }

      setState({
        address: addr,
        chainId,
        isConnected: true,
        isConnecting: false,
        walletType: detectedType,
        balanceFormatted: "0.00",
        chainName: SUPPORTED_CHAINS[chainId]?.name || `Chain ${chainId}`,
        error: null,
      });

      updateBalance(addr, chainId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet";
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: message,
      }));
    }
  }, [updateBalance]);

  const disconnectWallet = useCallback(() => {
    setState({
      address: null,
      chainId: 1,
      isConnected: false,
      isConnecting: false,
      walletType: "metamask",
      balanceFormatted: "0.00",
      chainName: "Ethereum",
      error: null,
    });
  }, []);

  // Listen for chain / account changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as unknown as EthereumWindow;
    const ethereum = win.ethereum;
    if (!ethereum || !ethereum.on) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (!accounts || accounts.length === 0) {
        disconnectWallet();
      } else {
        const addr = accounts[0]!.toLowerCase() as Address;
        setState((prev) => ({ ...prev, address: addr, isConnected: true }));
        updateBalance(addr, state.chainId);
      }
    };

    const handleChainChanged = (...args: unknown[]) => {
      const chainIdHex = args[0] as string;
      const nextChainId = parseInt(chainIdHex, 16);
      setState((prev) => ({
        ...prev,
        chainId: nextChainId,
        chainName: SUPPORTED_CHAINS[nextChainId]?.name || `Chain ${nextChainId}`,
      }));
      if (state.address) {
        updateBalance(state.address, nextChainId);
      }
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
        ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [disconnectWallet, state.address, state.chainId, updateBalance]);

  /**
   * Real on-chain transaction execution via browser provider
   */
  const sendMintTransaction = useCallback(
    async (params: { to: Address; data?: `0x${string}`; valueWei?: bigint }): Promise<Hash> => {
      if (typeof window === "undefined" || !state.address) {
        throw new Error("Wallet not connected");
      }

      const win = window as unknown as EthereumWindow;
      const ethereum = win.ethereum;
      if (!ethereum) throw new Error("No web3 wallet available");

      const chainObj = SUPPORTED_CHAINS[state.chainId]?.chain || mainnet;

      const walletClient = createWalletClient({
        chain: chainObj,
        transport: custom(ethereum),
      });

      const hash = await walletClient.sendTransaction({
        account: state.address,
        to: params.to,
        data: params.data,
        value: params.valueWei || 0n,
        chain: undefined,
      });

      return hash;
    },
    [state.address, state.chainId],
  );

  return {
    ...state,
    connectWallet,
    disconnectWallet,
    sendMintTransaction,
    refreshBalance: () => state.address && updateBalance(state.address, state.chainId),
  };
}
