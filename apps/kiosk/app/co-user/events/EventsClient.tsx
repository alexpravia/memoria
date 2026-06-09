"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, supabase } from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";
import Icon from "@/components/Icon";

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: "one_time" | "recurring" | "routine";
  recurrence_rule: string | null;
  is_past: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

const typeLabel: Record<string, string> = {
  one_time: "One-time",
  recurring: "Recurring",
  routine: "Routine",
};

export default function EventsClient() {
  const { userId } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId]);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("events")
      .select("id, title, description, event_date, event_type, recurrence_rule, is_past")
      .eq("user_id", userId)
      .order("event_date", { ascending: true });
    setEvents((data as EventRow[]) ?? []);
    setLoading(false);
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    await supabase.from("events").delete().eq("id", id);
    setEvents((e) => e.filter((x) => x.id !== id));
  }

  const upcoming = events.filter((e) => !e.is_past);
  const past = events.filter((e) => e.is_past);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Events"
        subtitle="Appointments, routines, and recurring plans"
        action={
          <Link href="/co-user/events/add" style={addBtnStyle}>
            <Icon name="calendar" size={18} color="white" />
            Add Event
          </Link>
        }
      />

      {loading ? (
        <p style={mutedText}>Loading…</p>
      ) : events.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {upcoming.length > 0 && (
            <Section title="Upcoming">
              {upcoming.map((e) => (
                <EventCard key={e.id} event={e} onDelete={deleteEvent} />
              ))}
            </Section>
          )}
          {past.length > 0 && (
            <Section title="Past">
              {past.map((e) => (
                <EventCard key={e.id} event={e} onDelete={deleteEvent} />
              ))}
            </Section>
          )}
        </>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2
        style={{
          fontSize: "var(--type-sm)",
          fontWeight: "var(--type-weight-medium)",
          color: "var(--color-fg-muted)",
          letterSpacing: 2,
          textTransform: "uppercase",
          margin: "0 0 12px",
        }}
      >
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

function EventCard({ event, onDelete }: { event: EventRow; onDelete: (id: string) => void }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-surface-raised)",
        borderRadius: "var(--radius-xl)",
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity: event.is_past ? 0.65 : 1,
      }}
    >
      {/* Date chip */}
      <div
        style={{
          background: "var(--color-surface-raised)",
          borderRadius: "var(--radius-md)",
          padding: "8px 12px",
          textAlign: "center",
          flexShrink: 0,
          minWidth: 56,
        }}
      >
        <div style={{ fontSize: "var(--type-xxs)", color: "var(--color-fg-muted)", letterSpacing: 1 }}>
          {new Date(event.event_date + "T00:00:00").toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
        </div>
        <div style={{ fontSize: "var(--type-h2)", fontWeight: "var(--type-weight-bold)", color: "var(--color-fg-strong)", lineHeight: 1 }}>
          {new Date(event.event_date + "T00:00:00").getDate()}
        </div>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--type-md)", fontWeight: "var(--type-weight-medium)", color: "var(--color-fg-strong)" }}>
          {event.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
          <span style={{ fontSize: "var(--type-sm)", color: "var(--color-fg-muted)" }}>
            {formatDate(event.event_date)}
          </span>
          <span
            style={{
              fontSize: "var(--type-xxs)",
              background: "var(--color-surface-raised)",
              color: "var(--color-fg-muted)",
              borderRadius: "var(--radius-full)",
              padding: "2px 8px",
            }}
          >
            {typeLabel[event.event_type] ?? event.event_type}
          </span>
        </div>
        {event.description && (
          <div style={{ fontSize: "var(--type-sm)", color: "var(--color-fg-muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {event.description}
          </div>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(event.id)}
        style={iconBtnStyle}
        title="Delete"
      >
        <Icon name="close" size={16} color="var(--color-danger)" />
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--color-fg-muted)" }}>
      <Icon name="calendar" size={48} color="var(--color-surface-raised)" />
      <p style={{ fontSize: "var(--type-lg)", marginTop: 16 }}>No events yet</p>
      <p style={{ fontSize: "var(--type-sm)", marginTop: 6 }}>
        Add appointments, routines, and recurring plans.
      </p>
      <Link href="/co-user/events/add" style={{ ...addBtnStyle, marginTop: 24 }}>
        Add the first event
      </Link>
    </div>
  );
}

const addBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "var(--color-primary)",
  color: "white",
  borderRadius: "var(--radius-pill)",
  padding: "10px 20px",
  fontSize: "var(--type-sm)",
  fontWeight: "var(--type-weight-medium)",
  textDecoration: "none",
};

const mutedText: React.CSSProperties = {
  color: "var(--color-fg-muted)",
  fontSize: "var(--type-md)",
  padding: "40px 0",
};

const iconBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "var(--radius-lg)",
  background: "var(--color-surface-raised)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  cursor: "pointer",
  flexShrink: 0,
};
