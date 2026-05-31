/**
 * Memoria custom icon set — rounded-stroke, 24px grid, 2px weight.
 * Matches the brand mark (chevron ∧): same round caps & joins.
 *
 * Usage:
 *   <Icon name="memo" size={27} color={colors.primarySoft} />
 *   <Icon name="calendar" size={24} accent />  // purple accent strokes
 */

import React from "react";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import { colors } from "../theme";

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
  /** Icon stroke color. Defaults to colors.primarySoft (lavender). */
  color?: string;
  /** Accent stroke color for affirmative paths. Defaults to colors.primary. */
  accentColor?: string;
}

export default function Icon({
  name,
  size = 24,
  color = colors.primarySoft,
  accentColor = colors.primary,
}: Props) {
  const s = {
    fill: "none" as const,
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const a = { ...s, stroke: accentColor };

  switch (name) {
    case "mark":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} strokeWidth={2.6} d="M5 15 12 8l7 7" />
        </Svg>
      );

    case "memo":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5V16H6.5A2.5 2.5 0 0 1 4 13.5v-7A2.5 2.5 0 0 1 6.5 4z" />
          <Circle cx={9} cy={10} r={0.9} fill={color} stroke="none" />
          <Circle cx={12} cy={10} r={0.9} fill={color} stroke="none" />
          <Circle cx={15} cy={10} r={0.9} fill={color} stroke="none" />
        </Svg>
      );

    case "startDay":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M7.5 17a4.5 4.5 0 0 1 9 0" />
          <Path {...s} d="M3 20h18M12 4v2.4M5.6 8.1l1.5 1.5M18.4 8.1l-1.5 1.5" />
        </Svg>
      );

    case "whoAmI":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect {...s} x={3.5} y={5} width={17} height={14} rx={2.5} />
          <Circle {...s} cx={9} cy={11} r={2} />
          <Path {...s} d="M6 16.3a3 3 0 0 1 6 0M14.5 10h3M14.5 13.5h3" />
        </Svg>
      );

    case "listen":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M4 9.5h3.5L12 6v12L7.5 14.5H4z" />
          <Path {...s} d="M15.4 9.2a4 4 0 0 1 0 5.6M18 7a7.5 7.5 0 0 1 0 10" />
        </Svg>
      );

    case "contacts":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect {...s} x={5.5} y={3.5} width={13.5} height={17} rx={2} />
          <Path {...s} d="M3 8h2.7M3 12h2.7M3 16h2.7" />
          <Circle {...s} cx={12.5} cy={10} r={2} />
          <Path {...s} d="M9 16.3a3.5 3.5 0 0 1 7 0" />
        </Svg>
      );

    case "calendar":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect {...s} x={4} y={5} width={16} height={15} rx={2} />
          <Path {...s} d="M4 9.5h16M8.5 3v4M15.5 3v4" />
          <Path {...a} d="M9.2 14.3l1.8 1.8 3.3-3.4" />
        </Svg>
      );

    case "photos":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect {...s} x={4} y={5} width={16} height={14} rx={2} />
          <Circle {...s} cx={9} cy={10} r={1.6} />
          <Path {...s} d="M5 18l4-4 2.5 2.5 3.5-3.5 4 4" />
        </Svg>
      );

    case "review":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M7 3.5V20.5" />
          <Path {...s} d="M7 4.5h9.5l-2.2 3.2 2.2 3.3H7" />
        </Svg>
      );

    case "safety":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M12 3.2l7 2.6v5.2c0 4.4-3 7.3-7 8.8-4-1.5-7-4.4-7-8.8V5.8z" />
          <Path {...a} d="M9 12l2 2 4-4.2" />
        </Svg>
      );

    case "notes":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle {...s} cx={11} cy={10.5} r={3.8} />
          <Path {...s} d="M4.5 20a6.5 6.5 0 0 1 13 0" />
          <Path {...a} d="M18.5 3.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z" />
        </Svg>
      );

    case "login":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle {...s} cx={8} cy={8} r={3.5} />
          <Path {...s} d="M10.5 10.5l8 8M15.5 15.5l2-2M18.5 18.5l1.7-1.7" />
        </Svg>
      );

    case "call":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M7 4.5C5.8 4.5 4.8 5.5 4.9 6.7c.5 7 5.4 11.9 12.4 12.4 1.2.1 2.2-.9 2.2-2.1v-2.3l-3.8-1.6-1.7 1.9c-2.3-1.2-4.1-3-5.3-5.3l1.9-1.7L9 4.5z" />
        </Svg>
      );

    case "addPerson":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle {...s} cx={12} cy={6.5} r={2.5} />
          <Path {...s} d="M6 20v-1a6 6 0 0 1 12 0v1" />
          <Path {...a} d="M12 11.5v4M10 13.5h4" />
        </Svg>
      );

    case "back":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M14.5 6l-6 6 6 6" />
        </Svg>
      );

    case "forward":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M9.5 6l6 6-6 6" />
        </Svg>
      );

    case "close":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M7 7l10 10M17 7L7 17" />
        </Svg>
      );

    case "add":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M12 5v14M5 12h14" />
        </Svg>
      );

    case "check":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M5 12.5l4.5 4.5L19 7" />
        </Svg>
      );

    case "trash":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M5 6.5h14" />
          <Path {...s} d="M9.5 6.5V5.2A1.5 1.5 0 0 1 11 3.7h2a1.5 1.5 0 0 1 1.5 1.5V6.5" />
          <Path {...s} d="M6.7 6.5l.8 11.5a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l.8-11.5" />
          <Path {...s} d="M10 10.5v6M14 10.5v6" />
        </Svg>
      );

    case "pin":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M9 4h6l-1 5 3 2.6v1.4H7v-1.4L10 9z" />
          <Path {...s} d="M12 14.6V20" />
        </Svg>
      );

    case "block":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle {...s} cx={12} cy={12} r={8} />
          <Path {...s} d="M6.5 6.5l11 11" />
        </Svg>
      );

    case "refresh":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M5.5 11.5a6.5 6.5 0 0 1 11-4.3l1.8 1.6" />
          <Path {...s} d="M18.5 12.5a6.5 6.5 0 0 1-11 4.3l-1.8-1.6" />
          <Path {...s} d="M18.5 4.5v4.3h-4.3M5.5 19.5v-4.3h4.3" />
        </Svg>
      );

    case "sparkle":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...a} d="M11 4l1.7 4.6 4.6 1.7-4.6 1.7L11 16.6 9.3 12 4.7 10.3 9.3 8.6z" />
          <Path {...s} d="M17.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
        </Svg>
      );

    case "hide":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M4 12s3-6 8-6c1.4 0 2.7.4 3.8 1.1M20 12s-1.1 2.1-3.2 3.8" />
          <Path {...s} d="M14.1 14a2.8 2.8 0 0 1-4.1-3.9" />
          <Path {...s} d="M4.5 4.5l15 15" />
        </Svg>
      );

    case "pending":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M7 4h10M7 20h10" />
          <Path {...s} d="M8 4v3l4 5 4-5V4M8 20v-3l4-5 4 5v3" />
        </Svg>
      );

    case "tip":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...s} d="M9 16a5 5 0 1 1 6 0c-.7.5-1 1.2-1 2H10c0-.8-.3-1.5-1-2z" />
          <Path {...s} d="M10 20h4M10.7 22h2.6" />
        </Svg>
      );

    default:
      return null;
  }
}
