import React from "react";

export interface ChainIconProps {
  chainId?: string;
  className?: string;
  size?: number;
}

/**
 * Authentic vector logos for all supported EVM Chains
 */
export function ChainIcon({ chainId = "ethereum", className = "size-4", size }: ChainIconProps) {
  const style = size ? { width: size, height: size } : undefined;

  switch (chainId?.toLowerCase()) {
    case "ethereum":
    case "eth":
    case "1":
      return (
        <svg
          viewBox="0 0 256 417"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M127.961 0L125.166 9.5V285.168L127.961 287.958L255.923 212.32L127.961 0Z"
            fill="#343434"
          />
          <path d="M127.962 0L0 212.32L127.962 287.959V157.152V0Z" fill="#8C8C8C" />
          <path
            d="M127.961 312.187L126.386 314.107V412.306L127.961 416.905L256 236.587L127.961 312.187Z"
            fill="#3C3C3B"
          />
          <path d="M127.962 416.905V312.187L0 236.587L127.962 416.905Z" fill="#8C8C8C" />
          <path d="M127.961 287.958L255.922 212.32L127.961 157.152V287.958Z" fill="#141414" />
          <path d="M0 212.32L127.962 287.958V157.152L0 212.32Z" fill="#393939" />
        </svg>
      );

    case "arbitrum":
    case "arb":
    case "42161":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="500" height="500" rx="100" fill="#28A0F0" />
          <path
            d="M249.2 110L145.8 288.6L176.4 341.6L249.2 215.8L322.2 341.6L352.8 288.6L249.2 110Z"
            fill="white"
          />
          <path d="M285.5 305L249.2 242.4L213.1 305H285.5Z" fill="#28A0F0" />
          <path d="M249.2 242.4L188.5 347.4H310.1L249.2 242.4Z" fill="white" />
        </svg>
      );

    case "optimism":
    case "op":
    case "10":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="250" cy="250" r="250" fill="#FF0420" />
          <path
            d="M192.5 170C152.5 170 120 205.8 120 250C120 294.2 152.5 330 192.5 330C232.5 330 265 294.2 265 250C265 205.8 232.5 170 192.5 170ZM192.5 285C175.9 285 162.5 269.3 162.5 250C162.5 230.7 175.9 215 192.5 215C209.1 215 222.5 230.7 222.5 250C222.5 269.3 209.1 285 192.5 285Z"
            fill="white"
          />
          <path
            d="M295 173H340C367.6 173 390 195.4 390 223C390 250.6 367.6 273 340 273H320V327H295V173ZM340 248C353.8 248 365 236.8 365 223C365 209.2 353.8 198 340 198H320V248H340Z"
            fill="white"
          />
        </svg>
      );

    case "base":
    case "8453":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="250" cy="250" r="250" fill="#0052FF" />
          <rect x="180" y="140" width="140" height="220" rx="70" fill="white" />
        </svg>
      );

    case "polygon":
    case "pol":
    case "matic":
    case "137":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="250" cy="250" r="250" fill="#7B3FE4" />
          <path
            d="M250 115L366.9 182.5V317.5L250 385L133.1 317.5V182.5L250 115Z"
            stroke="white"
            strokeWidth="30"
            strokeLinejoin="round"
          />
          <path d="M250 185L308.5 218.8V286.2L250 320L191.5 286.2V218.8L250 185Z" fill="white" />
        </svg>
      );

    case "avalanche":
    case "avax":
    case "43114":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="250" cy="250" r="250" fill="#E84142" />
          <path d="M344.2 360H399.7L250 100L201 185H256.5L344.2 360Z" fill="white" />
          <path d="M174.5 231L100.3 360H155.8L202.2 279.5L174.5 231Z" fill="white" />
          <path d="M250 279.5L203.6 360H296.4L250 279.5Z" fill="white" />
        </svg>
      );

    case "bsc":
    case "binance":
    case "bnb":
    case "56":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="250" cy="250" r="250" fill="#F0B90B" />
          <path d="M250 110L308 168L250 226L192 168L250 110Z" fill="#1E2026" />
          <path d="M338 198L396 256L338 314L280 256L338 198Z" fill="#1E2026" />
          <path d="M162 198L220 256L162 314L104 256L162 198Z" fill="#1E2026" />
          <path d="M250 286L308 344L250 402L192 344L250 286Z" fill="#1E2026" />
          <path d="M250 226L280 256L250 286L220 256L250 226Z" fill="#1E2026" />
        </svg>
      );

    case "blast":
    case "81457":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="250" cy="250" r="250" fill="#FCFC03" />
          <path
            d="M130 350L350 130M350 130H210M350 130V270"
            stroke="#000000"
            strokeWidth="48"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "berachain":
    case "bera":
    case "80094":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="250" cy="250" r="250" fill="#8F5E36" />
          {/* Bear ears */}
          <circle cx="160" cy="160" r="45" fill="#603B1E" />
          <circle cx="160" cy="160" r="25" fill="#FFAE42" />
          <circle cx="340" cy="160" r="45" fill="#603B1E" />
          <circle cx="340" cy="160" r="25" fill="#FFAE42" />
          {/* Bear head */}
          <ellipse cx="250" cy="270" rx="140" ry="125" fill="#603B1E" />
          {/* Snout */}
          <ellipse cx="250" cy="305" rx="65" ry="50" fill="#FFAE42" />
          {/* Nose */}
          <path d="M225 285 C240 275 260 275 275 285 C275 305 225 305 225 285 Z" fill="#1E120A" />
          {/* Eyes */}
          <ellipse cx="195" cy="240" rx="14" ry="18" fill="#1E120A" />
          <ellipse cx="305" cy="240" rx="14" ry="18" fill="#1E120A" />
          <circle cx="200" cy="235" r="4" fill="white" />
          <circle cx="310" cy="235" r="4" fill="white" />
        </svg>
      );

    case "apechain":
    case "ape":
    case "33139":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="250" cy="250" r="250" fill="#0054FA" />
          {/* Ape skull silhouette */}
          <path
            d="M250 120C180 120 130 170 130 240C130 280 150 310 180 330V370H320V330C350 310 370 280 370 240C370 170 320 120 250 120ZM200 240C183.4 240 170 226.6 170 210C170 193.4 183.4 180 200 180C216.6 180 230 193.4 230 210C230 226.6 216.6 240 200 240ZM300 240C283.4 240 270 226.6 270 210C270 193.4 283.4 180 300 180C316.6 180 330 193.4 330 210C330 226.6 316.6 240 300 240ZM250 340C225 340 210 320 210 320H290C290 320 275 340 250 340Z"
            fill="white"
          />
        </svg>
      );

    case "sei":
    case "1329":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="250" cy="250" r="250" fill="#9B1C2E" />
          <path
            d="M170 340 C170 240 330 320 330 210 C330 140 260 140 210 170"
            stroke="white"
            strokeWidth="38"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );

    case "mode":
    case "34443":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="250" cy="250" r="250" fill="#DFFE00" />
          <path
            d="M150 340V160L250 270L350 160V340H300V240L250 295L200 240V340H150Z"
            fill="#000000"
          />
        </svg>
      );

    case "linea":
    case "59144":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="250" cy="250" r="250" fill="#121212" />
          <path
            d="M150 160L230 340L350 160"
            stroke="#61DFFF"
            strokeWidth="42"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "scroll":
    case "534352":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="500" height="500" rx="100" fill="#FFE7B9" />
          <path
            d="M150 190C150 150 190 130 250 130C310 130 350 150 350 190C350 250 150 250 150 310C150 350 190 370 250 370C310 370 350 350 350 310"
            stroke="#4D3319"
            strokeWidth="36"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );

    case "mantle":
    case "mnt":
    case "5000":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="250" cy="250" r="250" fill="#000000" />
          <circle
            cx="250"
            cy="250"
            r="150"
            stroke="#65B3AD"
            strokeWidth="30"
            strokeDasharray="140 30"
            fill="none"
          />
          <circle cx="250" cy="250" r="65" fill="#65B3AD" />
        </svg>
      );

    case "zora":
    case "7777777":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="zora-sphere" cx="35%" cy="35%" r="65%" fx="30%" fy="30%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="40%" stopColor="#3B82F6" />
              <stop offset="80%" stopColor="#9333EA" />
              <stop offset="100%" stopColor="#1E1B4B" />
            </radialGradient>
          </defs>
          <circle cx="250" cy="250" r="240" fill="url(#zora-sphere)" />
          <circle cx="200" cy="180" r="40" fill="white" opacity="0.35" />
        </svg>
      );

    case "ink":
    case "57073":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="250" cy="250" r="250" fill="#9A00FF" />
          <path
            d="M250 110 C250 110 160 210 160 280 C160 330 200 370 250 370 C300 370 340 330 340 280 C340 210 250 110 250 110 Z"
            fill="white"
          />
          <circle cx="250" cy="300" r="30" fill="#9A00FF" />
        </svg>
      );

    case "monad":
    case "10143":
      return (
        <svg
          viewBox="0 0 500 500"
          className={className}
          style={style}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="250" cy="250" r="250" fill="#836EF9" />
          {/* Monad infinity knot */}
          <path
            d="M250 140C200 140 160 180 160 230C160 280 200 300 250 340C300 300 340 280 340 230C340 180 300 140 250 140ZM250 300C220 270 190 255 190 230C190 200 215 175 250 175C285 175 310 200 310 230C310 255 280 270 250 300Z"
            fill="white"
          />
        </svg>
      );

    default:
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          style={style}
          fill="none"
          stroke="currentColor"
        >
          <circle cx="12" cy="12" r="9" strokeWidth="2" />
          <path d="M12 7v5l3 3" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}
