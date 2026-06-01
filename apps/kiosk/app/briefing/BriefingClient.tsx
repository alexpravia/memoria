"use client";
/**
 * Auto-advancing morning briefing for the kiosk.
 *
 * Reads today's approved/draft briefing via @memoria/core, resolves slide
 * photos, then plays each slide: speak(tts_text) → onDone advances to the
 * next; the next slide's audio is prewarmed during the current one; a
 * duration_ms-based max-dwell timer advances even if onDone never fires.
 *
 * Race guard: a generation counter (genRef) is bumped by every disruptive
 * control (next / prev / again / stop / voice command). Each scheduled
 * advance captures the generation + slide index it was queued under and is
 * dropped if either changed — so a stale onDone/timer can't double-advance.
 *
 * Voice commands ("next" / "again" / "stop") are available via a one-shot
 * command mic; on-screen controls are the always-reliable path.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getTodaysBriefing,
  resolveSlidePhotos,
  markDelivered,
  validateBriefing,
  useAuth,
  type BriefingSlide,
} from "@memoria/core";
import * as tts from "@/lib/tts-web";
import Icon from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { useAudioUnlocked } from "@/components/AudioUnlockGate";
import { createStt, isSttSupported, type SttHandle } from "@/lib/voice/stt";
import { matchBriefingCommand } from "@/lib/voice/machine";

const DEFAULT_DWELL_MS = 9000;
const DWELL_GRACE_MS = 2500;

type Status = "loading" | "ready" | "empty" | "done";

export default function BriefingClient() {
  const { userId, session } = useAuth();
  const unlocked = useAudioUnlocked();
  const uid = userId ?? session?.user?.id ?? null;

  const [status, setStatus] = useState<Status>("loading");
  const [slides, setSlides] = useState<BriefingSlide[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replayNonce, setReplayNonce] = useState(0);
  const [listeningCmd, setListeningCmd] = useState(false);

  const genRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = index;
  const briefingIdRef = useRef<string | null>(null);
  const cmdSttRef = useRef<SttHandle | null>(null);
  // Latches the end-of-briefing side effects (closing TTS + markDelivered)
  // to exactly once, regardless of effect re-fires.
  const deliveredRef = useRef(false);

  // ── Load today's briefing ──────────────────────────────────────────
  useEffect(() => {
    if (!unlocked) return;
    if (!uid) {
      setStatus("empty");
      return;
    }
    let cancelled = false;
    void (async () => {
      const b = await getTodaysBriefing(uid);
      if (cancelled) return;
      if (
        !b ||
        !Array.isArray(b.slides) ||
        b.slides.length === 0 ||
        !validateBriefing(b.slides).ok
      ) {
        // Read-path safety net: never render or speak a malformed briefing
        // (bad slide count/shape, or a URL/UUID in tts_text). The write path
        // validates too, but corrupt/legacy rows could otherwise slip through.
        setStatus("empty");
        return;
      }
      briefingIdRef.current = b.id;
      deliveredRef.current = false;
      const withPhotos = await resolveSlidePhotos(b.slides);
      if (cancelled) return;
      setSlides(withPhotos);
      setIndex(0);
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, unlocked]);

  // ── Playback: speak current slide, schedule advance ────────────────
  useEffect(() => {
    if (status !== "ready" || paused) return;

    if (index >= slides.length) {
      setStatus("done");
      if (!deliveredRef.current) {
        deliveredRef.current = true;
        void tts.speak("That's everything for now. Have a wonderful day.");
        if (briefingIdRef.current) void markDelivered(briefingIdRef.current);
      }
      return;
    }

    const slide = slides[index];
    const myGen = genRef.current;
    const myIndex = index;

    const advance = () => {
      if (myGen !== genRef.current || idxRef.current !== myIndex) return;
      setIndex((i) => (i === myIndex ? i + 1 : i));
    };

    void tts.speak(slide.tts_text || slide.body, { onDone: advance });

    const next = slides[index + 1];
    if (next) void tts.prewarm(next.tts_text || next.body);

    const dwell = (slide.duration_ms ?? DEFAULT_DWELL_MS) + DWELL_GRACE_MS;
    const timer = setTimeout(advance, dwell);

    return () => {
      clearTimeout(timer);
      void tts.stop();
    };
  }, [index, replayNonce, status, paused, slides]);

  // Tear down the command recognizer on unmount.
  useEffect(() => {
    return () => {
      try {
        cmdSttRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // ── Controls ───────────────────────────────────────────────────────
  const disrupt = useCallback(() => {
    genRef.current += 1;
    void tts.stop();
  }, []);

  const goNext = useCallback(() => {
    disrupt();
    setPaused(false);
    setIndex((i) => Math.min(i + 1, slides.length));
  }, [disrupt, slides.length]);

  const goPrev = useCallback(() => {
    disrupt();
    setPaused(false);
    setIndex((i) => Math.max(i - 1, 0));
  }, [disrupt]);

  const replay = useCallback(() => {
    disrupt();
    setPaused(false);
    setReplayNonce((n) => n + 1);
  }, [disrupt]);

  const togglePause = useCallback(() => {
    if (paused) {
      setPaused(false);
    } else {
      disrupt();
      setPaused(true);
    }
  }, [paused, disrupt]);

  // ── One-shot voice command ─────────────────────────────────────────
  const handleVoiceCommand = useCallback(() => {
    if (!isSttSupported() || listeningCmd) return;
    disrupt();
    setPaused(true);
    setListeningCmd(true);

    // Whichever terminal callback fires first resolves the command session
    // exactly once. Critically, EVERY terminal path resumes playback (or
    // intentionally stays paused on "stop") so a recognition error can
    // never leave the briefing silently stuck on a paused slide.
    let resolved = false;
    const finish = (action: () => void) => {
      if (resolved) return;
      resolved = true;
      setListeningCmd(false);
      action();
    };

    const stt = createStt(
      {
        onFinal: (t) =>
          finish(() => {
            const cmd = matchBriefingCommand(t);
            if (cmd === "next") goNext();
            else if (cmd === "again") replay();
            else if (cmd === "stop") setPaused(true); // stay paused on purpose
            else replay(); // unrecognized → resume current slide
          }),
        onNoSpeech: () => finish(() => replay()),
        onError: () => finish(() => replay()),
      },
      { continuous: false }
    );
    cmdSttRef.current = stt;
    stt.start();
  }, [listeningCmd, disrupt, goNext, replay]);

  // ── Render ─────────────────────────────────────────────────────────
  if (status === "loading") {
    return <Centered>Loading your day…</Centered>;
  }

  if (status === "empty") {
    return (
      <Centered>
        <Logo size={96} />
        <p style={{ fontSize: "var(--type-h2)", color: "var(--color-fg-strong)" }}>
          No briefing is ready yet.
        </p>
        <p style={{ fontSize: "var(--type-lg)", color: "var(--color-fg-muted)" }}>
          Your family will prepare today&apos;s briefing soon.
        </p>
        <HomeLink />
      </Centered>
    );
  }

  if (status === "done") {
    return (
      <Centered>
        <div className="voice-orb voice-orb--idle">
          <Logo size={120} />
        </div>
        <p style={{ fontSize: "var(--type-greeting)", color: "var(--color-fg-strong)" }}>
          Have a wonderful day.
        </p>
        <HomeLink />
      </Centered>
    );
  }

  const slide = slides[Math.min(index, slides.length - 1)];

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 32,
        background:
          "radial-gradient(circle at 50% 28%, var(--color-surface-sunk), var(--color-bg))",
        color: "var(--color-fg)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "var(--type-sm)",
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--color-primary-soft)",
        }}
      >
        {index + 1} of {slides.length}
      </div>

      {slide.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.photo_url}
          alt={slide.title}
          style={{
            width: "min(92vw, 560px)",
            aspectRatio: "4 / 3",
            objectFit: "cover",
            borderRadius: "var(--radius-xxl)",
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}

      <h1
        style={{
          fontSize: "var(--type-title)",
          color: "var(--color-fg-strong)",
          margin: 0,
          maxWidth: 720,
        }}
      >
        {slide.title}
      </h1>
      <p
        style={{
          fontSize: "var(--type-xl)",
          lineHeight: 1.5,
          color: "var(--color-fg)",
          margin: 0,
          maxWidth: 720,
        }}
      >
        {slide.body}
      </p>

      {/* Controls */}
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 8 }}>
        <CtrlButton onClick={goPrev} label="Previous" disabled={index === 0}>
          <Icon name="back" size={26} color="white" />
        </CtrlButton>
        <CtrlButton onClick={replay} label="Again">
          <Icon name="refresh" size={26} color="white" />
        </CtrlButton>
        <CtrlButton onClick={togglePause} label={paused ? "Play" : "Pause"} primary>
          <Icon name={paused ? "forward" : "block"} size={30} color="white" />
        </CtrlButton>
        <CtrlButton onClick={goNext} label="Next">
          <Icon name="forward" size={26} color="white" />
        </CtrlButton>
        {isSttSupported() && (
          <CtrlButton
            onClick={handleVoiceCommand}
            label="Voice command"
            active={listeningCmd}
          >
            <Icon name="listen" size={26} color="white" />
          </CtrlButton>
        )}
      </div>

      <HomeLink />
    </main>
  );
}

// ─── Small presentational helpers ──────────────────────────────────────

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 32,
        background: "var(--color-bg)",
        color: "var(--color-fg)",
        textAlign: "center",
      }}
    >
      {children}
    </main>
  );
}

function HomeLink() {
  return (
    <Link
      href="/"
      style={{
        marginTop: 16,
        color: "var(--color-primary-soft)",
        fontSize: "var(--type-lg)",
        textDecoration: "none",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Icon name="back" size={20} />
      Home
    </Link>
  );
}

function CtrlButton({
  children,
  onClick,
  label,
  disabled,
  primary,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  primary?: boolean;
  active?: boolean;
}) {
  const size = primary ? 72 : 60;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      style={{
        width: size,
        height: size,
        borderRadius: "var(--radius-full)",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        background: active
          ? "var(--color-danger)"
          : primary
            ? "var(--color-primary)"
            : "var(--color-surface-raised)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
