"use client";

import "@/lib/supabase";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, supabase, getBriefingForDate, type BriefingStatus } from "@memoria/core";
import Icon, { type IconName } from "@/components/Icon";

// ─── Date helpers ────────────────────────────────────────────────────

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function todayLong(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Types ───────────────────────────────────────────────────────────

interface Stats {
  lifeFacts: number;
  people: number;
  events: number;
  photos: number;
  pendingFlags: number;
}

// ─── Main component ──────────────────────────────────────────────────

export default function CoUserHomeClient() {
  const { userId } = useAuth();
  const router = useRouter();
  const [patientName, setPatientName] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    lifeFacts: 0,
    people: 0,
    events: 0,
    photos: 0,
    pendingFlags: 0,
  });
  const [briefingStatus, setBriefingStatus] = useState<BriefingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    void (async () => {
      const [
        { data: user },
        { count: lfCount },
        { count: pCount },
        { count: eCount },
        { count: mCount },
        { count: fCount },
        briefing,
      ] = await Promise.all([
        supabase.from("users").select("full_name").eq("id", userId).single(),
        supabase
          .from("life_facts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("people")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("events")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("media")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .neq("verification_status", "hidden"),
        supabase
          .from("flag_queue")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "pending"),
        getBriefingForDate(userId, tomorrowISO()),
      ]);

      setPatientName((user as { full_name?: string } | null)?.full_name ?? null);
      setStats({
        lifeFacts: lfCount ?? 0,
        people: pCount ?? 0,
        events: eCount ?? 0,
        photos: mCount ?? 0,
        pendingFlags: fCount ?? 0,
      });
      setBriefingStatus(briefing?.status ?? null);
      setLoading(false);
    })();
  }, [userId]);

  // ── No userId → redirect to onboarding wizard ────────────────────
  useEffect(() => {
    if (!userId) router.replace("/co-user/onboard");
  }, [userId, router]);

  if (!userId) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80, color: "var(--color-fg-muted)", fontSize: "var(--type-lg)" }}>
        Loading…
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: 80,
          color: "var(--color-fg-muted)",
          fontSize: "var(--type-lg)",
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "36px 32px 80px",
      }}
    >
      {/* ── Greeting ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: "var(--type-greeting)",
            fontWeight: "var(--type-weight-bold)",
            color: "var(--color-fg-strong)",
            margin: 0,
          }}
        >
          {patientName ? `Caring for ${patientName}` : "Dashboard"}
        </h1>
        <p
          style={{
            color: "var(--color-fg-muted)",
            marginTop: 6,
            fontSize: "var(--type-md)",
          }}
        >
          {todayLong()}
        </p>
      </div>

      {/* ── Stats row ────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 12,
          marginBottom: 48,
        }}
      >
        <StatCard label="Life Facts" value={stats.lifeFacts} icon="tip" />
        <StatCard label="People" value={stats.people} icon="contacts" />
        <StatCard label="Events" value={stats.events} icon="calendar" />
        <StatCard label="Photos" value={stats.photos} icon="photos" />
        {stats.pendingFlags > 0 && (
          <StatCard
            label="Pending Review"
            value={stats.pendingFlags}
            icon="review"
            accent
          />
        )}
      </div>

      {/* ── Dashboard section ────────────────────────────────────── */}
      <Section title="Dashboard">
        <BriefingHeroCard status={briefingStatus} />
        <div style={cardGrid}>
          <ActionCard
            href="/co-user/photos"
            icon="photos"
            title="Photos"
            subtitle={`${stats.photos} photos`}
          />
          <ActionCard
            href="/co-user/people"
            icon="contacts"
            title="People"
            subtitle={`${stats.people} people`}
          />
          <ActionCard
            href="/co-user/events"
            icon="calendar"
            title="Events"
            subtitle={`${stats.events} events`}
          />
          <ActionCard
            href="/co-user/story"
            icon="notes"
            title="Write About Them"
            subtitle="Narrative for Memo"
          />
          <ActionCard
            href="/co-user/documents"
            icon="tip"
            title="Documents"
            subtitle="Uploaded reference files"
          />
          <ActionCard
            href="/co-user/memory"
            icon="sparkle"
            title="Memo's Notes"
            subtitle="AI-learned memories"
          />
          <ActionCard
            href="/co-user/flags"
            icon="review"
            title="Review Queue"
            subtitle={
              stats.pendingFlags > 0
                ? `${stats.pendingFlags} pending`
                : "All caught up"
            }
            badge={stats.pendingFlags > 0 ? stats.pendingFlags : undefined}
          />
          <ActionCard
            href="/co-user/filters"
            icon="safety"
            title="Safety & Filters"
            subtitle="Sensitivity rules"
          />
        </div>
      </Section>

      {/* ── Add section ──────────────────────────────────────────── */}
      <Section title="Add">
        <div style={cardGrid}>
          <ActionCard
            href="/co-user/life-facts/add"
            icon="tip"
            title="Add Life Facts"
            subtitle="Key facts & memories"
          />
          <ActionCard
            href="/co-user/people/add"
            icon="addPerson"
            title="Add People"
            subtitle="Family & friends"
          />
          <ActionCard
            href="/co-user/events/add"
            icon="calendar"
            title="Add Events"
            subtitle="Appointments & routines"
          />
        </div>
      </Section>

      {/* ── Import section ───────────────────────────────────────── */}
      <Section title="Import">
        <div style={cardGrid}>
          <ActionCard
            href="/co-user/calendar/import"
            icon="calendar"
            title="Import Calendar"
            subtitle="Google Calendar or .ics file"
          />
          <ActionCard
            href="/co-user/photos/import"
            icon="photos"
            title="Import Photos"
            subtitle="Upload from this device"
          />
        </div>
      </Section>

      {/* ── Settings section ─────────────────────────────────────── */}
      <Section title="Settings & Tools">
        <div style={cardGrid}>
          <ActionCard
            href="/co-user/life-facts"
            icon="tip"
            title="Life Facts"
            subtitle="View & manage"
          />
          <ActionCard
            href="/co-user/setup-login"
            icon="login"
            title="Set Up Their Login"
            subtitle="Patient account access"
          />
          <ActionCard
            href="/co-user/emergency-contact"
            icon="call"
            title="Emergency Contact"
            subtitle="Phone for 'Who Am I'"
          />
        </div>
      </Section>
    </main>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

const cardGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: 12,
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 44 }}>
      <h2
        style={{
          fontSize: "var(--type-sm)",
          fontWeight: "var(--type-weight-medium)",
          color: "var(--color-fg-muted)",
          letterSpacing: 2,
          textTransform: "uppercase",
          margin: "0 0 14px",
        }}
      >
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: IconName;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: accent ? "rgba(255,107,107,0.12)" : "var(--color-surface)",
        border: `1px solid ${accent ? "rgba(255,107,107,0.3)" : "var(--color-surface-raised)"}`,
        borderRadius: "var(--radius-xl)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <Icon
        name={icon}
        size={18}
        color={accent ? "var(--color-danger)" : "var(--color-primary-soft)"}
      />
      <span
        style={{
          fontSize: "var(--type-title)",
          fontWeight: "var(--type-weight-bold)",
          color: accent ? "var(--color-danger)" : "var(--color-fg-strong)",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: "var(--type-xs)",
          color: "var(--color-fg-muted)",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  subtitle,
  badge,
}: {
  href: string;
  icon: IconName;
  title: string;
  subtitle: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: "var(--color-surface)",
        border: "1px solid var(--color-surface-raised)",
        borderRadius: "var(--radius-xl)",
        padding: "16px 20px",
        textDecoration: "none",
        color: "inherit",
        transition: "border-color 0.15s",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "var(--radius-lg)",
          background: "var(--color-surface-raised)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={22} color="var(--color-primary-soft)" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--type-md)",
            fontWeight: "var(--type-weight-medium)",
            color: "var(--color-fg-strong)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {title}
          {badge !== undefined && (
            <span
              style={{
                background: "var(--color-danger)",
                color: "white",
                borderRadius: "var(--radius-full)",
                fontSize: "var(--type-xxs)",
                fontWeight: "var(--type-weight-bold)",
                minWidth: 18,
                height: 18,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 5px",
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: "var(--type-sm)",
            color: "var(--color-fg-muted)",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {subtitle}
        </div>
      </div>

      <Icon name="forward" size={18} color="var(--color-fg-muted)" />
    </Link>
  );
}

function BriefingHeroCard({ status }: { status: BriefingStatus | null }) {
  const statusConfig: Record<
    string,
    { label: string; color: string; bg: string }
  > = {
    draft: {
      label: "Draft ready",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.15)",
    },
    approved: {
      label: "Approved",
      color: "var(--color-success)",
      bg: "rgba(76,175,80,0.15)",
    },
    delivered: {
      label: "Delivered",
      color: "var(--color-info)",
      bg: "rgba(33,150,243,0.15)",
    },
    failed: {
      label: "Failed",
      color: "var(--color-danger)",
      bg: "rgba(255,107,107,0.15)",
    },
  };

  const cfg = status ? statusConfig[status] : null;

  const ctaLabel =
    status === null
      ? "Generate Briefing"
      : status === "draft"
        ? "Review & Approve"
        : status === "approved"
          ? "View Approved"
          : status === "delivered"
            ? "View Delivered"
            : "Retry Generation";

  return (
    <Link
      href="/co-user/briefing"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 20,
        background:
          "linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-surface-sunk) 100%)",
        border: "1px solid var(--color-primary-deep)",
        borderRadius: "var(--radius-xxl)",
        padding: "24px 28px",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Icon name="startDay" size={32} color="var(--color-primary-soft)" />
        <div>
          <div
            style={{
              fontSize: "var(--type-h2)",
              fontWeight: "var(--type-weight-medium)",
              color: "var(--color-fg-strong)",
            }}
          >
            Tomorrow&apos;s Briefing
          </div>
          {cfg ? (
            <span
              style={{
                display: "inline-block",
                marginTop: 6,
                fontSize: "var(--type-xs)",
                fontWeight: "var(--type-weight-medium)",
                color: cfg.color,
                background: cfg.bg,
                borderRadius: "var(--radius-full)",
                padding: "3px 10px",
                letterSpacing: 0.5,
              }}
            >
              {cfg.label}
            </span>
          ) : (
            <span
              style={{
                display: "inline-block",
                marginTop: 6,
                fontSize: "var(--type-xs)",
                color: "var(--color-fg-muted)",
              }}
            >
              Not generated yet
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          background: "var(--color-primary)",
          color: "white",
          borderRadius: "var(--radius-pill)",
          padding: "10px 22px",
          fontSize: "var(--type-sm)",
          fontWeight: "var(--type-weight-medium)",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {ctaLabel}
      </div>
    </Link>
  );
}
