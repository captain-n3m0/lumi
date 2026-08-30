import React from "react";

export interface PlatformIconProps {
  platform?:
    | "opensea"
    | "magiceden"
    | "zora"
    | "sound"
    | "highlight"
    | "foundation"
    | "manifold"
    | "mintfun"
    | "etherscan"
    | string;
  className?: string;
  size?: number;
}

export function PlatformIcon({
  platform = "opensea",
  className = "size-4",
  size,
}: PlatformIconProps) {
  const style = size ? { width: size, height: size } : undefined;

  switch (platform?.toLowerCase()) {
    case "opensea":
      return (
        <svg viewBox="0 0 500 500" className={className} style={style} fill="none">
          <circle cx="250" cy="250" r="250" fill="#2081E2" />
          {/* Authentic OpenSea ship */}
          <path
            d="M370 285 C370 325 330 365 250 365 C170 365 130 325 130 285 L145 285 C145 320 180 345 250 345 C320 345 355 320 355 285 Z"
            fill="white"
          />
          {/* Main Sail */}
          <path d="M245 120 L245 270 L345 270 C345 270 345 170 245 120 Z" fill="white" />
          {/* Front Sail */}
          <path d="M230 150 L155 270 L230 270 Z" fill="white" />
          <line x1="238" y1="110" x2="238" y2="280" stroke="white" strokeWidth="6" />
        </svg>
      );

    case "magiceden":
      return (
        <svg viewBox="0 0 500 500" className={className} style={style} fill="none">
          <rect width="500" height="500" rx="110" fill="#E42575" />
          <path
            d="M130 340 L130 160 L210 270 L250 215 L290 270 L370 160 L370 340 H310 L310 240 L250 320 L190 240 L190 340 Z"
            fill="white"
          />
        </svg>
      );

    case "zora":
      return (
        <svg viewBox="0 0 500 500" className={className} style={style} fill="none">
          <defs>
            <radialGradient id="zora-p-grad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="50%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#9333EA" />
            </radialGradient>
          </defs>
          <circle cx="250" cy="250" r="240" fill="url(#zora-p-grad)" />
          <circle cx="200" cy="180" r="40" fill="white" opacity="0.35" />
        </svg>
      );

    case "sound":
    case "soundxyz":
      return (
        <svg viewBox="0 0 500 500" className={className} style={style} fill="none">
          <rect width="500" height="500" rx="110" fill="#000000" />
          <circle cx="250" cy="250" r="160" stroke="#00FF66" strokeWidth="24" fill="none" />
          <circle cx="250" cy="250" r="60" fill="#00FF66" />
          <circle cx="250" cy="250" r="20" fill="#000000" />
        </svg>
      );

    case "highlight":
      return (
        <svg viewBox="0 0 500 500" className={className} style={style} fill="none">
          <rect width="500" height="500" rx="110" fill="#FFFC00" />
          <polygon
            points="250,100 285,210 395,210 305,275 340,385 250,320 160,385 195,275 105,210 215,210"
            fill="#000000"
          />
        </svg>
      );

    case "foundation":
      return (
        <svg viewBox="0 0 500 500" className={className} style={style} fill="none">
          <rect width="500" height="500" rx="110" fill="#000000" />
          <path d="M160 140 H340 V200 H225 V235 H310 V290 H225 V360 H160 Z" fill="white" />
        </svg>
      );

    case "manifold":
      return (
        <svg viewBox="0 0 500 500" className={className} style={style} fill="none">
          <rect width="500" height="500" rx="110" fill="#FF5C00" />
          <path
            d="M140 340 V160 H195 L250 250 L305 160 H360 V340 H310 V235 L250 325 L190 235 V340 Z"
            fill="white"
          />
        </svg>
      );

    case "mintfun":
      return (
        <svg viewBox="0 0 500 500" className={className} style={style} fill="none">
          <rect width="500" height="500" rx="110" fill="#10B981" />
          <path d="M280 120 L160 270 H240 L220 380 L340 230 H260 Z" fill="white" />
        </svg>
      );

    case "etherscan":
    case "explorer":
      return (
        <svg viewBox="0 0 500 500" className={className} style={style} fill="none">
          <circle cx="250" cy="250" r="250" fill="#1F3664" />
          <path
            d="M250 120 L370 190 V310 L250 380 L130 310 V190 Z"
            stroke="white"
            strokeWidth="28"
            fill="none"
          />
          <circle cx="250" cy="250" r="40" fill="white" />
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
