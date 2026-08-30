import { useWallet, type UseWalletReturn, type ConnectedWalletState } from "@/hooks/useWallet";

export type { ConnectedWalletState, UseWalletReturn };

/**
 * useWeb3Wallet delegates directly to useWallet (backed by Wagmi and local storage persistence)
 * to ensure all components share a single, unified, reload-persistent Web3 wallet state.
 */
export function useWeb3Wallet(): UseWalletReturn {
  return useWallet();
}
