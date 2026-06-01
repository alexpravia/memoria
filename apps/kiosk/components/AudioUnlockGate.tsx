"use client";
/**
 * Full-screen "Touch to begin" overlay that performs the gesture-driven
 * audio unlock (see lib/audio-unlock.ts) before any TTS is attempted.
 *
 * Mounted high in the tree (Providers) so it overlays every page and only
 * appears once per hard page load. It exposes whether audio is unlocked via
 * context so the home greeting can speak the instant the gate is dismissed.
 */

import React, { createContext, useCallback, useContext, useState } from "react";
import { unlockAudio } from "@/lib/audio-unlock";
import { Logo } from "@/components/Logo";

const AudioUnlockContext = createContext(false);

/** True once the user has dismissed the gate and audio is unlocked. */
export function useAudioUnlocked(): boolean {
  return useContext(AudioUnlockContext);
}

export function AudioUnlockGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleUnlock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    await unlockAudio();
    setUnlocked(true);
  }, [busy]);

  return (
    <AudioUnlockContext.Provider value={unlocked}>
      {children}
      {!unlocked && (
        <button
          type="button"
          onClick={handleUnlock}
          aria-label="Touch to begin"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            border: "none",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            background:
              "radial-gradient(circle at 50% 38%, var(--color-surface-sunk), var(--color-bg))",
            color: "var(--color-fg)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <div
            className="voice-orb voice-orb--idle"
            style={{ pointerEvents: "none" }}
          >
            <Logo size={140} />
          </div>
          <span
            style={{
              fontSize: "var(--type-greeting)",
              fontWeight: "var(--type-weight-medium)",
              color: "var(--color-fg-strong)",
            }}
          >
            {busy ? "Starting…" : "Touch to begin"}
          </span>
          <span
            style={{
              fontSize: "var(--type-lg)",
              color: "var(--color-primary-soft)",
            }}
          >
            Tap anywhere to wake Memo
          </span>
        </button>
      )}
    </AudioUnlockContext.Provider>
  );
}

export default AudioUnlockGate;
