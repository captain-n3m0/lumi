import { http, createConfig, createStorage, noopStorage, fallback } from "wagmi";
import {
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  blast,
  bsc,
  zora,
  avalanche,
  sepolia,
  berachain,
  berachainTestnetbArtio,
  linea,
  scroll,
  mantle,
  mode,
  apeChain,
  sei,
  ink,
  monadTestnet,
} from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";

// Public / Personal RPC Key Fallbacks
const ALCHEMY_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || "demo";
const INFURA_KEY = import.meta.env.VITE_INFURA_API_KEY || "demo";

export const config = createConfig({
  chains: [
    mainnet,
    base,
    arbitrum,
    optimism,
    polygon,
    blast,
    bsc,
    zora,
    avalanche,
    linea,
    scroll,
    mantle,
    mode,
    berachain,
    berachainTestnetbArtio,
    sepolia,
    apeChain,
    sei,
    ink,
    monadTestnet,
  ],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
    coinbaseWallet({
      appName: "Lumi Auto Mint & Matrix",
    }),
  ],
  storage: createStorage({
    storage: typeof window !== "undefined" ? window.localStorage : noopStorage,
    key: "lumi.wagmi",
  }),
  ssr: true,
  transports: {
    [mainnet.id]: fallback([
      http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
      http(`https://mainnet.infura.io/v3/${INFURA_KEY}`),
      http("https://eth.llamarpc.com"),
      http("https://rpc.ankr.com/eth"),
      http("https://ethereum-rpc.publicnode.com"),
      http(),
    ]),
    [base.id]: fallback([
      http(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
      http("https://mainnet.base.org"),
      http("https://base.llamarpc.com"),
      http("https://base-rpc.publicnode.com"),
      http(),
    ]),
    [arbitrum.id]: fallback([
      http(`https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
      http(`https://arbitrum-mainnet.infura.io/v3/${INFURA_KEY}`),
      http("https://arb1.arbitrum.io/rpc"),
      http("https://arbitrum.llamarpc.com"),
      http("https://arbitrum-one-rpc.publicnode.com"),
      http(),
    ]),
    [optimism.id]: fallback([
      http(`https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
      http(`https://optimism-mainnet.infura.io/v3/${INFURA_KEY}`),
      http("https://mainnet.optimism.io"),
      http("https://optimism.llamarpc.com"),
      http("https://optimism-rpc.publicnode.com"),
      http(),
    ]),
    [polygon.id]: fallback([
      http(`https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
      http(`https://polygon-mainnet.infura.io/v3/${INFURA_KEY}`),
      http("https://polygon-rpc.com"),
      http("https://polygon.llamarpc.com"),
      http("https://polygon-bor-rpc.publicnode.com"),
      http(),
    ]),
    [blast.id]: fallback([
      http(`https://blast-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
      http(`https://blast-mainnet.infura.io/v3/${INFURA_KEY}`),
      http("https://rpc.blast.io"),
      http("https://blast.blockpi.network/v1/rpc/public"),
      http(),
    ]),
    [bsc.id]: fallback([
      http("https://binance.llamarpc.com"),
      http("https://bsc-rpc.publicnode.com"),
      http("https://rpc.ankr.com/bsc"),
      http(),
    ]),
    [zora.id]: fallback([
      http(`https://zora-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
      http("https://rpc.zora.energy"),
      http(),
    ]),
    [avalanche.id]: fallback([
      http(`https://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
      http(`https://avalanche-mainnet.infura.io/v3/${INFURA_KEY}`),
      http("https://api.avax.network/ext/bc/C/rpc"),
      http("https://avalanche.public-rpc.com"),
      http(),
    ]),
    [linea.id]: fallback([
      http(`https://linea-mainnet.infura.io/v3/${INFURA_KEY}`),
      http("https://rpc.linea.build"),
      http(),
    ]),
    [scroll.id]: fallback([
      http(`https://scroll-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
      http("https://rpc.scroll.io"),
      http(),
    ]),
    [mantle.id]: fallback([http("https://rpc.mantle.xyz"), http()]),
    [mode.id]: fallback([http("https://mainnet.mode.network"), http()]),
    [berachain.id]: fallback([
      http("https://rpc.berachain.com"),
      http("https://berachain-rpc.publicnode.com"),
      http(),
    ]),
    [berachainTestnetbArtio.id]: fallback([http("https://artio.rpc.berachain.com"), http()]),
    [sepolia.id]: fallback([
      http(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`),
      http(`https://sepolia.infura.io/v3/${INFURA_KEY}`),
      http("https://rpc.sepolia.org"),
      http("https://ethereum-sepolia-rpc.publicnode.com"),
      http(),
    ]),
    [apeChain.id]: fallback([http("https://rpc.apechain.com"), http()]),
    [sei.id]: fallback([http("https://evm-rpc.sei-apis.com"), http()]),
    [ink.id]: fallback([http("https://rpc-gel.inkonchain.com"), http()]),
    [monadTestnet.id]: fallback([http("https://testnet-rpc.monad.xyz"), http()]),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
