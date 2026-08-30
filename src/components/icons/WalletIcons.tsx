import React from "react";

export interface WalletIconProps {
  walletType?:
    | "metamask"
    | "rabby"
    | "coinbase"
    | "walletconnect"
    | "rainbow"
    | "phantom"
    | "robinhood"
    | "raw_key"
    | "mnemonic"
    | string;
  className?: string;
  size?: number;
}

export function WalletIcon({
  walletType = "metamask",
  className = "size-5",
  size,
}: WalletIconProps) {
  const style = size ? { width: size, height: size } : undefined;

  switch (walletType?.toLowerCase()) {
    case "metamask":
      return (
        <svg viewBox="0 0 318.6 318.6" className={className} style={style} fill="none">
          <path
            d="M274.1 35.5L174.6 109.4L193 65.8L274.1 35.5Z"
            fill="#E2761B"
            stroke="#E2761B"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M44.5 35.5L124.6 66.4L144 109.4L44.5 35.5Z"
            fill="#E4761B"
            stroke="#E4761B"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M238.3 206.8L211.8 247.4L268.5 263L284.8 207.7L238.3 206.8Z"
            fill="#E4761B"
            stroke="#E4761B"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M33.9 207.7L50.1 263L106.8 247.4L80.3 206.8L33.9 207.7Z"
            fill="#E4761B"
            stroke="#E4761B"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M103.6 138.2L87.8 162.1L144.1 164.6L142.1 104.1L103.6 138.2Z"
            fill="#E4761B"
            stroke="#E4761B"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M214.9 138.2L175.9 103.4L174.6 164.6L230.8 162.1L214.9 138.2Z"
            fill="#E4761B"
            stroke="#E4761B"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M106.8 247.4L140.6 230.9L111.4 208.1L106.8 247.4Z"
            fill="#E4761B"
            stroke="#E4761B"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M177.9 230.9L211.8 247.4L207.1 208.1L177.9 230.9Z"
            fill="#E4761B"
            stroke="#E4761B"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M211.8 247.4L177.9 230.9L180.6 253L180.3 262.4L211.8 247.4Z"
            fill="#D7C1B3"
            stroke="#D7C1B3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M106.8 247.4L138.3 262.4L138 253L140.6 230.9L106.8 247.4Z"
            fill="#D7C1B3"
            stroke="#D7C1B3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M138.8 193.5L110.2 185.2L130.6 176.1L138.8 193.5Z"
            fill="#233447"
            stroke="#233447"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M179.7 193.5L188 176.1L208.3 185.2L179.7 193.5Z"
            fill="#233447"
            stroke="#233447"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M106.8 247.4L111.6 206.8L80.3 207.7L106.8 247.4Z"
            fill="#CD6116"
            stroke="#CD6116"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M207 206.8L211.8 247.4L238.3 207.7L207 206.8Z"
            fill="#CD6116"
            stroke="#CD6116"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M230.8 162.1L174.6 164.6L179.8 193.5L208.4 185.2L238.4 206.8L249.2 163.6L230.8 162.1Z"
            fill="#CD6116"
            stroke="#CD6116"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M87.8 162.1L69.4 163.6L80.2 206.8L110.2 185.2L115.4 164.6L87.8 162.1Z"
            fill="#CD6116"
            stroke="#CD6116"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M138 253L138.3 262.4L159.3 276.9L180.3 262.4L180.6 253L159.3 259.7L138 253Z"
            fill="#161616"
            stroke="#161616"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M159.3 250L180.6 230.9L174.6 164.6L144.1 164.6L138 230.9L159.3 250Z"
            fill="#763D16"
            stroke="#763D16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "rabby":
      return (
        <svg viewBox="0 0 500 500" className={className} style={style} fill="none">
          <circle cx="250" cy="250" r="250" fill="#8697FF" />
          <path
            d="M170 120 C170 80 200 70 210 110 L215 190 C215 190 200 180 170 180 Z"
            fill="white"
          />
          <path
            d="M330 120 C330 80 300 70 290 110 L285 190 C285 190 300 180 330 180 Z"
            fill="white"
          />
          <ellipse cx="250" cy="280" rx="110" ry="95" fill="white" />
          <circle cx="205" cy="265" r="24" fill="#2B3674" />
          <circle cx="295" cy="265" r="24" fill="#2B3674" />
          <circle cx="212" cy="258" r="8" fill="white" />
          <circle cx="302" cy="258" r="8" fill="white" />
          {/* Cute glasses bridge */}
          <path d="M229 265 H271" stroke="#2B3674" strokeWidth="10" strokeLinecap="round" />
          <ellipse cx="250" cy="305" rx="14" ry="10" fill="#FF8BA7" />
        </svg>
      );

    case "coinbase":
      return (
        <svg viewBox="0 0 500 500" className={className} style={style} fill="none">
          <rect width="500" height="500" rx="110" fill="#0052FF" />
          <circle cx="250" cy="250" r="140" fill="white" />
          <rect x="195" y="195" width="110" height="110" rx="20" fill="#0052FF" />
        </svg>
      );

    case "walletconnect":
      return (
        <svg viewBox="0 0 500 500" className={className} style={style} fill="none">
          <rect width="500" height="500" rx="110" fill="#3B99FC" />
          <path
            d="M140 200 C200 140 300 140 360 200 L370 210 C375 215 375 225 370 230 L345 255 C340 260 332 260 327 255 L312 240 C275 205 225 205 188 240 L173 255 C168 260 160 260 155 255 L130 230 C125 225 125 215 130 210 Z"
            fill="white"
          />
          <path
            d="M250 280 L295 325 C300 330 300 338 295 343 L270 368 C265 373 257 373 252 368 L250 366 L248 368 C243 373 235 373 230 368 L205 343 C200 338 200 330 205 325 Z"
            fill="white"
          />
        </svg>
      );

    case "rainbow":
      return (
        <svg viewBox="0 0 500 500" className={className} style={style} fill="none">
          <rect width="500" height="500" rx="110" fill="#0E0E0E" />
          <path
            d="M120 350 A 130 130 0 0 1 380 350"
            stroke="#FF3B30"
            strokeWidth="30"
            fill="none"
          />
          <path
            d="M150 350 A 100 100 0 0 1 350 350"
            stroke="#FF9500"
            strokeWidth="30"
            fill="none"
          />
          <path d="M180 350 A 70 70 0 0 1 320 350" stroke="#FFCC00" strokeWidth="30" fill="none" />
          <path d="M210 350 A 40 40 0 0 1 290 350" stroke="#34C759" strokeWidth="30" fill="none" />
          <path d="M240 350 A 10 10 0 0 1 260 350" stroke="#007AFF" strokeWidth="30" fill="none" />
        </svg>
      );

    case "robinhood":
    case "robinhoodwallet":
      return (
        <svg viewBox="0 0 500 500" className={className} style={style} fill="none">
          <rect width="500" height="500" rx="110" fill="#000000" />
          {/* Authentic Robinhood signature feather */}
          <path
            d="M260 85 C215 145 175 220 175 300 C175 340 195 370 225 390 L225 425 H255 L255 395 C295 380 325 335 325 280 C325 225 295 160 260 85 Z"
            fill="#00C805"
          />
          {/* Feather cutout notch */}
          <path
            d="M225 295 C225 250 245 200 260 155 C275 200 290 250 290 285 C290 315 275 345 255 355 L255 295 H225 Z"
            fill="#000000"
          />
        </svg>
      );

    case "raw_key":
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          style={style}
          fill="none"
          stroke="currentColor"
        >
          <circle cx="8" cy="15" r="5" strokeWidth="2" />
          <path
            d="M12 11l8-8m-3 0h3v3m-3 2l2 2"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "mnemonic":
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          style={style}
          fill="none"
          stroke="currentColor"
        >
          <rect x="3" y="4" width="18" height="16" rx="3" strokeWidth="2" />
          <path d="M7 8h10M7 12h6M7 16h8" strokeWidth="2" strokeLinecap="round" />
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
          <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" />
          <path d="M16 12h.01M2 10h20" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}
