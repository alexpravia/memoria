"use client";
/**
 * VoiceOrb — the Memoria flower Logo wrapped with state-driven animation.
 * Breathing when idle, glowing while listening, dim-pulsing while thinking,
 * ring-pulsing while speaking. Animation classes live in globals.css.
 *
 * Acts as the primary tap/PTT target for the voice loop.
 */

import React from "react";
import { Logo } from "@/components/Logo";
import type { VoicePhase } from "@/lib/voice/machine";

interface Props {
  phase: VoicePhase;
  size?: number;
  onClick?: () => void;
  /** Accessible label describing the current state. */
  label?: string;
}

export function VoiceOrb({ phase, size = 200, onClick, label }: Props) {
  return (
    <button
      type="button"
      className={`voice-orb voice-orb--${phase}`}
      onClick={onClick}
      aria-label={label ?? `Memo — ${phase}`}
      style={{ width: size, height: size }}
    >
      <span className="voice-orb__ring" />
      <span className="voice-orb__logo">
        <Logo size={size} />
      </span>
    </button>
  );
}

export default VoiceOrb;
