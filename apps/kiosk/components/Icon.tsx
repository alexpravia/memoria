"use client";
/**
 * Memoria icon set — web version.
 * Same rounded-stroke SVG glyphs as the mobile Icon.tsx, ported to
 * plain HTML <svg> elements (no react-native-svg).
 */

import React, { useId } from "react";

export type IconName =
  | "mark"
  | "memo"
  | "startDay"
  | "whoAmI"
  | "listen"
  | "contacts"
  | "calendar"
  | "photos"
  | "review"
  | "safety"
  | "notes"
  | "login"
  | "call"
  | "addPerson"
  | "back"
  | "forward"
  | "close"
  | "add"
  | "check"
  | "trash"
  | "pin"
  | "block"
  | "refresh"
  | "sparkle"
  | "hide"
  | "pending"
  | "tip";

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  accentColor?: string;
  className?: string;
}

export default function Icon({
  name,
  size = 24,
  color = "var(--color-primary-soft)",
  accentColor = "var(--color-primary)",
  className,
}: Props) {
  const base = {
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const a = { ...base, stroke: accentColor };
  const sw = { ...base, strokeWidth: 2.6 };

  const svgProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    className,
  };

  switch (name) {
    case "mark":
      return <svg {...svgProps}><path {...sw} d="M5 15 12 8l7 7" /></svg>;

    case "memo":
      return (
        <svg {...svgProps}>
          <path {...base} d="M6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5V16H6.5A2.5 2.5 0 0 1 4 13.5v-7A2.5 2.5 0 0 1 6.5 4z" />
          <circle cx={9} cy={10} r={0.9} fill={color} />
          <circle cx={12} cy={10} r={0.9} fill={color} />
          <circle cx={15} cy={10} r={0.9} fill={color} />
        </svg>
      );

    case "startDay":
      return (
        <svg {...svgProps}>
          <path {...base} d="M7.5 17a4.5 4.5 0 0 1 9 0" />
          <path {...base} d="M3 20h18M12 4v2.4M5.6 8.1l1.5 1.5M18.4 8.1l-1.5 1.5" />
        </svg>
      );

    case "whoAmI":
      return (
        <svg {...svgProps}>
          <rect {...base} x={3.5} y={5} width={17} height={14} rx={2.5} />
          <circle {...base} cx={9} cy={11} r={2} />
          <path {...base} d="M6 16.3a3 3 0 0 1 6 0M14.5 10h3M14.5 13.5h3" />
        </svg>
      );

    case "listen":
      return (
        <svg {...svgProps}>
          <path {...base} d="M4 9.5h3.5L12 6v12L7.5 14.5H4z" />
          <path {...base} d="M15.4 9.2a4 4 0 0 1 0 5.6M18 7a7.5 7.5 0 0 1 0 10" />
        </svg>
      );

    case "contacts":
      return (
        <svg {...svgProps}>
          <rect {...base} x={5.5} y={3.5} width={13.5} height={17} rx={2} />
          <path {...base} d="M3 8h2.7M3 12h2.7M3 16h2.7" />
          <circle {...base} cx={12.5} cy={10} r={2} />
          <path {...base} d="M9 16.3a3.5 3.5 0 0 1 7 0" />
        </svg>
      );

    case "calendar":
      return (
        <svg {...svgProps}>
          <rect {...base} x={4} y={5} width={16} height={15} rx={2} />
          <path {...base} d="M4 9.5h16M8.5 3v4M15.5 3v4" />
          <path {...a} d="M9.2 14.3l1.8 1.8 3.3-3.4" />
        </svg>
      );

    case "photos":
      return (
        <svg {...svgProps}>
          <rect {...base} x={4} y={5} width={16} height={14} rx={2} />
          <circle {...base} cx={9} cy={10} r={1.6} />
          <path {...base} d="M5 18l4-4 2.5 2.5 3.5-3.5 4 4" />
        </svg>
      );

    case "review":
      return (
        <svg {...svgProps}>
          <path {...base} d="M7 3.5V20.5" />
          <path {...base} d="M7 4.5h9.5l-2.2 3.2 2.2 3.3H7" />
        </svg>
      );

    case "safety":
      return (
        <svg {...svgProps}>
          <path {...base} d="M12 3.2l7 2.6v5.2c0 4.4-3 7.3-7 8.8-4-1.5-7-4.4-7-8.8V5.8z" />
          <path {...a} d="M9 12l2 2 4-4.2" />
        </svg>
      );

    case "notes":
      return (
        <svg {...svgProps}>
          <circle {...base} cx={11} cy={10.5} r={3.8} />
          <path {...base} d="M4.5 20a6.5 6.5 0 0 1 13 0" />
          <path {...a} d="M18.5 3.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z" />
        </svg>
      );

    case "login":
      return (
        <svg {...svgProps}>
          <circle {...base} cx={8} cy={8} r={3.5} />
          <path {...base} d="M10.5 10.5l8 8M15.5 15.5l2-2M18.5 18.5l1.7-1.7" />
        </svg>
      );

    case "call":
      return (
        <svg {...svgProps}>
          <path {...base} d="M7 4.5C5.8 4.5 4.8 5.5 4.9 6.7c.5 7 5.4 11.9 12.4 12.4 1.2.1 2.2-.9 2.2-2.1v-2.3l-3.8-1.6-1.7 1.9c-2.3-1.2-4.1-3-5.3-5.3l1.9-1.7L9 4.5z" />
        </svg>
      );

    case "addPerson":
      return (
        <svg {...svgProps}>
          <circle {...base} cx={12} cy={6.5} r={2.5} />
          <path {...base} d="M6 20v-1a6 6 0 0 1 12 0v1" />
          <path {...a} d="M12 11.5v4M10 13.5h4" />
        </svg>
      );

    case "back":
      return <svg {...svgProps}><path {...base} d="M14.5 6l-6 6 6 6" /></svg>;

    case "forward":
      return <svg {...svgProps}><path {...base} d="M9.5 6l6 6-6 6" /></svg>;

    case "close":
      return <svg {...svgProps}><path {...base} d="M7 7l10 10M17 7L7 17" /></svg>;

    case "add":
      return <svg {...svgProps}><path {...base} d="M12 5v14M5 12h14" /></svg>;

    case "check":
      return <svg {...svgProps}><path {...base} d="M5 12.5l4.5 4.5L19 7" /></svg>;

    case "trash":
      return (
        <svg {...svgProps}>
          <path {...base} d="M5 6.5h14" />
          <path {...base} d="M9.5 6.5V5.2A1.5 1.5 0 0 1 11 3.7h2a1.5 1.5 0 0 1 1.5 1.5V6.5" />
          <path {...base} d="M6.7 6.5l.8 11.5a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l.8-11.5" />
          <path {...base} d="M10 10.5v6M14 10.5v6" />
        </svg>
      );

    case "pin":
      return (
        <svg {...svgProps}>
          <path {...base} d="M9 4h6l-1 5 3 2.6v1.4H7v-1.4L10 9z" />
          <path {...base} d="M12 14.6V20" />
        </svg>
      );

    case "block":
      return (
        <svg {...svgProps}>
          <circle {...base} cx={12} cy={12} r={8} />
          <path {...base} d="M6.5 6.5l11 11" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...svgProps}>
          <path {...base} d="M5.5 11.5a6.5 6.5 0 0 1 11-4.3l1.8 1.6" />
          <path {...base} d="M18.5 12.5a6.5 6.5 0 0 1-11 4.3l-1.8-1.6" />
          <path {...base} d="M18.5 4.5v4.3h-4.3M5.5 19.5v-4.3h4.3" />
        </svg>
      );

    case "sparkle":
      return (
        <svg {...svgProps}>
          <path {...a} d="M11 4l1.7 4.6 4.6 1.7-4.6 1.7L11 16.6 9.3 12 4.7 10.3 9.3 8.6z" />
          <path {...base} d="M17.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
        </svg>
      );

    case "hide":
      return (
        <svg {...svgProps}>
          <path {...base} d="M4 12s3-6 8-6c1.4 0 2.7.4 3.8 1.1M20 12s-1.1 2.1-3.2 3.8" />
          <path {...base} d="M14.1 14a2.8 2.8 0 0 1-4.1-3.9" />
          <path {...base} d="M4.5 4.5l15 15" />
        </svg>
      );

    case "pending":
      return (
        <svg {...svgProps}>
          <path {...base} d="M7 4h10M7 20h10" />
          <path {...base} d="M8 4v3l4 5 4-5V4M8 20v-3l4-5 4 5v3" />
        </svg>
      );

    case "tip":
      return (
        <svg {...svgProps}>
          <path {...base} d="M9 16a5 5 0 1 1 6 0c-.7.5-1 1.2-1 2H10c0-.8-.3-1.5-1-2z" />
          <path {...base} d="M10 20h4M10.7 22h2.6" />
        </svg>
      );

    default:
      return null;
  }
}
