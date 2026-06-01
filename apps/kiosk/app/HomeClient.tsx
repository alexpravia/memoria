"use client";
/**
 * Ambient kiosk home — the "Hey Memo" entry point.
 *
 * A large VoiceOrb is the primary control: tap (or say "Hey Memo" when the
 * wake word is configured, or press space) to start a hands-free turn.
 * Status text + a live caption mirror the voice-loop phase, and Memo's
 * answer renders inline. Big nav shortcuts (briefing / chat) remain for
 * touch-only use.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import { VoiceOrb } from "@/components/VoiceOrb";
import Icon from "@/components/Icon";
import { useVoiceLoop } from "@/lib/voice/useVoiceLoop";
import { useAudioUnlocked } from "@/components/AudioUnlockGate";
import * as tts from "@/lib/tts-web";

const GREETING = "Hello. I'm Memo. Tap the circle, or say Hey Memo, and ask me anything.";

function statusLine(
  phase: string,
  wakeEnabled: boolean,
  sttSupported: boolean
): string {
  switch (phase) {
    case "wake":
    case "listening":
      return "Listening…";
    case "thinking":
      return "Thinking…";
    case "speaking":
      return "Speaking…";
    case "error":
      return "Let's try that again.";
    default:
      if (!sttSupported) return "Tap the circle to talk to Memo.";
      return wakeEnabled
        ? "Say “Hey Memo”, or tap the circle."
        : "Tap the circle, or press space, to talk.";
  }
}

export default function HomeClient() {
  const unlocked = useAudioUnlocked();
  const {
    phase,
    partial,
    answer,
    photos,
    onTalk,
    sttSupported,
    wakeWordEnabled,
  } = useVoiceLoop();

  // Speak the greeting once, right after audio is unlocked.
  const greetedRef = useRef(false);
  useEffect(() => {
    if (unlocked && !greetedRef.current) {
      greetedRef.current = true;
      void tts.speak(GREETING);
    }
  }, [unlocked]);

  const showAnswer = phase === "speaking" && answer;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: 32,
        background:
          "radial-gradient(circle at 50% 32%, var(--color-surface-sunk), var(--color-bg))",
        color: "var(--color-fg)",
        textAlign: "center",
      }}
    >
      <VoiceOrb
        phase={phase}
        size={220}
        onClick={onTalk}
        label="Talk to Memo"
      />

      <p
        style={{
          fontSize: "var(--type-h2)",
          color: "var(--color-fg-strong)",
          margin: 0,
          minHeight: "1.4em",
        }}
      >
        {statusLine(phase, wakeWordEnabled, sttSupported)}
      </p>

      {/* Live caption while listening */}
      {(phase === "listening" || phase === "wake") && partial && (
        <p
          style={{
            fontSize: "var(--type-lg)",
            color: "var(--color-primary-soft)",
            margin: 0,
            maxWidth: 680,
          }}
        >
          “{partial}”
        </p>
      )}

      {/* Memo's spoken answer, shown while speaking */}
      {showAnswer && (
        <div style={{ maxWidth: 720 }}>
          <p
            style={{
              fontSize: "var(--type-xl)",
              lineHeight: 1.5,
              color: "var(--color-fg)",
              margin: 0,
            }}
          >
            {answer}
          </p>
          {photos && photos.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: 16,
              }}
            >
              {photos.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt="Memory"
                  style={{
                    width: 220,
                    height: 165,
                    objectFit: "cover",
                    borderRadius: "var(--radius-lg)",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Touch shortcuts */}
      <nav style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/briefing" style={navBtnStyle}>
          <Icon name="startDay" size={24} color="white" />
          Start My Day
        </Link>
        <Link href="/assistant" style={navBtnStyle}>
          <Icon name="memo" size={24} color="white" />
          Talk to Memo
        </Link>
      </nav>
    </main>
  );
}

const navBtnStyle: React.CSSProperties = {
  background: "var(--color-primary)",
  color: "white",
  padding: "14px 28px",
  borderRadius: "var(--radius-xxl)",
  fontSize: "var(--type-lg)",
  fontWeight: "var(--type-weight-medium)",
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  gap: 10,
};
