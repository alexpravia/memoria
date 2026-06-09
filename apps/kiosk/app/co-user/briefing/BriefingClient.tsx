"use client";

import { useEffect, useState } from "react";
import {
  useAuth,
  getBriefingForDate,
  generateBriefing,
  approveBriefing,
  resolveSlidePhotos,
  type Briefing,
  type BriefingSlide,
} from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";
import Icon from "@/components/Icon";

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function todayISO(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

type DateMode = "today" | "tomorrow";

export default function BriefingClient() {
  const { userId, coUserId } = useAuth();
  const [dateMode, setDateMode] = useState<DateMode>("tomorrow");
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [slides, setSlides] = useState<BriefingSlide[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const date = dateMode === "tomorrow" ? tomorrowISO() : todayISO();

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId, date]);

  async function load() {
    if (!userId) return;
    setLoading(true);
    setBriefing(null);
    setSlides([]);
    setActiveSlide(0);
    const b = await getBriefingForDate(userId, date);
    if (b) {
      const resolved = await resolveSlidePhotos(b.slides);
      setBriefing(b);
      setSlides(resolved);
    }
    setLoading(false);
  }

  async function handleGenerate() {
    if (!userId) return;
    setGenerating(true);
    setError(null);
    const { briefing: b, error: err } = await generateBriefing(userId, date);
    if (err || !b) {
      setError(err ?? "Generation failed");
      setGenerating(false);
      return;
    }
    const resolved = await resolveSlidePhotos(b.slides);
    setBriefing(b);
    setSlides(resolved);
    setGenerating(false);
  }

  async function handleApprove() {
    if (!briefing) return;
    setApproving(true);
    const { ok, error: err } = await approveBriefing(briefing.id, coUserId ?? "");
    if (!ok) {
      setError(err ?? "Approval failed");
    } else {
      setBriefing((b) => b ? { ...b, status: "approved" } : b);
    }
    setApproving(false);
  }

  const current = slides[activeSlide];

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader title="Briefing Preview" subtitle="Review and approve before delivery" />

      {/* Date toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {(["tomorrow", "today"] as DateMode[]).map((d) => (
          <button
            key={d}
            onClick={() => setDateMode(d)}
            style={{
              padding: "8px 18px",
              borderRadius: "var(--radius-pill)",
              border: "none",
              background: dateMode === d ? "var(--color-primary)" : "var(--color-surface-raised)",
              color: dateMode === d ? "white" : "var(--color-fg-muted)",
              fontSize: "var(--type-sm)",
              cursor: "pointer",
              fontWeight: dateMode === d ? "var(--type-weight-medium)" : "normal",
              textTransform: "capitalize",
            }}
          >
            {d === "tomorrow" ? "Tomorrow" : "Today (test)"}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={mutedText}>Loading…</p>
      ) : !briefing ? (
        /* No briefing yet */
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <Icon name="startDay" size={56} color="var(--color-primary-soft)" />
          <h2 style={{ fontSize: "var(--type-greeting)", color: "var(--color-fg-strong)", margin: "16px 0 8px" }}>
            No briefing for {dateMode}
          </h2>
          <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--type-md)", marginBottom: 24 }}>
            Generate an AI briefing from their memories, events, and life facts.
          </p>
          {error && <p style={errorStyle}>{error}</p>}
          <button onClick={handleGenerate} disabled={generating} style={primaryBtnStyle}>
            {generating ? "Generating…" : "Generate Briefing"}
          </button>
        </div>
      ) : (
        <>
          {/* Status banner */}
          <div style={statusBanner(briefing.status)}>
            <span style={{ fontWeight: "var(--type-weight-medium)" }}>
              Status: {briefing.status}
            </span>
            {briefing.status === "draft" && (
              <span style={{ fontSize: "var(--type-sm)" }}>
                Review each slide below, then approve.
              </span>
            )}
            {briefing.status === "approved" && (
              <span style={{ fontSize: "var(--type-sm)" }}>
                Approved — will deliver when they start their day.
              </span>
            )}
            {briefing.status === "delivered" && (
              <span style={{ fontSize: "var(--type-sm)" }}>
                Already delivered today.
              </span>
            )}
          </div>

          {/* Slide viewer */}
          {slides.length > 0 && current && (
            <div style={slideContainer}>
              {/* Slide image */}
              {current.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.photo_url}
                  alt=""
                  style={{ width: "100%", height: 260, objectFit: "cover", borderRadius: "var(--radius-xl) var(--radius-xl) 0 0" }}
                />
              )}
              <div style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: "var(--type-xxs)",
                      background: "var(--color-surface-raised)",
                      color: "var(--color-fg-muted)",
                      borderRadius: "var(--radius-full)",
                      padding: "2px 8px",
                    }}
                  >
                    {current.kind} · Slide {activeSlide + 1}/{slides.length}
                  </span>
                </div>
                <h2 style={{ fontSize: "var(--type-h2)", fontWeight: "var(--type-weight-bold)", color: "var(--color-fg-strong)", margin: "0 0 8px" }}>
                  {current.title}
                </h2>
                <p style={{ fontSize: "var(--type-md)", color: "var(--color-fg)", margin: 0 }}>
                  {current.body}
                </p>
                <p style={{ fontSize: "var(--type-sm)", color: "var(--color-fg-muted)", margin: "12px 0 0", fontStyle: "italic" }}>
                  Spoken: &ldquo;{current.tts_text}&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Slide nav */}
          <div style={{ display: "flex", gap: 8, marginTop: 16, overflowX: "auto", paddingBottom: 4 }}>
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveSlide(i)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--radius-full)",
                  border: "2px solid",
                  borderColor: i === activeSlide ? "var(--color-primary)" : "var(--color-surface-raised)",
                  background: i === activeSlide ? "var(--color-primary)" : "var(--color-surface-raised)",
                  color: i === activeSlide ? "white" : "var(--color-fg-muted)",
                  fontSize: "var(--type-xs)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
            {briefing.status === "draft" && (
              <button onClick={handleApprove} disabled={approving} style={primaryBtnStyle}>
                {approving ? "Approving…" : `Approve Briefing (${slides.length} slides)`}
              </button>
            )}
            <button onClick={handleGenerate} disabled={generating} style={secondaryBtnStyle}>
              {generating ? "Regenerating…" : "Regenerate"}
            </button>
          </div>

          {error && <p style={errorStyle}>{error}</p>}
        </>
      )}
    </main>
  );
}

function statusBanner(status: string): React.CSSProperties {
  const colors: Record<string, { bg: string; color: string }> = {
    draft: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
    approved: { bg: "rgba(76,175,80,0.12)", color: "var(--color-success)" },
    delivered: { bg: "rgba(33,150,243,0.12)", color: "var(--color-info)" },
    failed: { bg: "rgba(255,107,107,0.12)", color: "var(--color-danger)" },
  };
  const c = colors[status] ?? colors.draft;
  return {
    background: c.bg,
    color: c.color,
    borderRadius: "var(--radius-xl)",
    padding: "12px 18px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
    fontSize: "var(--type-sm)",
  };
}

const slideContainer: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-surface-raised)",
  borderRadius: "var(--radius-xxl)",
  overflow: "hidden",
};

const primaryBtnStyle: React.CSSProperties = {
  background: "var(--color-primary)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "12px 24px",
  fontSize: "var(--type-md)",
  fontWeight: "var(--type-weight-medium)",
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  background: "var(--color-surface-raised)",
  color: "var(--color-fg-muted)",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "12px 24px",
  fontSize: "var(--type-md)",
  cursor: "pointer",
};

const mutedText: React.CSSProperties = {
  color: "var(--color-fg-muted)",
  fontSize: "var(--type-md)",
  padding: "40px 0",
};

const errorStyle: React.CSSProperties = {
  color: "var(--color-danger)",
  fontSize: "var(--type-sm)",
  marginTop: 8,
};
