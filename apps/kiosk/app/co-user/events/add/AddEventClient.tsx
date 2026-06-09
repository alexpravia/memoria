"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, supabase, embedAndStore } from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";

type EventType = "one_time" | "recurring" | "routine";

const EVENT_TYPES: { value: EventType; label: string; description: string }[] = [
  { value: "one_time", label: "One-time", description: "A specific date event" },
  { value: "recurring", label: "Recurring", description: "Repeats on a schedule" },
  { value: "routine", label: "Routine", description: "Daily or weekly habit" },
];

const RECURRENCE_OPTIONS = [
  { value: "FREQ=DAILY", label: "Every day" },
  { value: "FREQ=WEEKLY", label: "Every week" },
  { value: "FREQ=BIWEEKLY", label: "Every two weeks" },
  { value: "FREQ=MONTHLY", label: "Every month" },
];

export default function AddEventClient() {
  const { userId } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventType, setEventType] = useState<EventType>("one_time");
  const [recurrenceRule, setRecurrenceRule] = useState("FREQ=WEEKLY");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!userId || !title.trim()) return;
    setSaving(true);
    setError(null);

    const isPast = new Date(eventDate + "T00:00:00") < new Date();

    const { data, error: err } = await supabase
      .from("events")
      .insert({
        user_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        event_date: eventDate,
        event_type: eventType,
        recurrence_rule: eventType !== "one_time" ? recurrenceRule : null,
        is_past: isPast,
        people_involved: [],
      })
      .select("id")
      .single();

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    const id = (data as { id: string }).id;
    const embedText = [title.trim(), description.trim(), eventDate].filter(Boolean).join(" ");
    void embedAndStore("events", id, embedText);

    router.push("/co-user/events");
  }

  const canSave = !!title.trim() && !!eventDate && !saving;

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Add Event"
        subtitle="Add an appointment, routine, or recurring plan"
        backHref="/co-user/events"
        backLabel="Events"
      />

      <div style={formCard}>
        <Field label="Title *">
          <input
            style={inputStyle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Doctor's appointment, Sunday family dinner"
            autoFocus
          />
        </Field>

        <Field label="Description">
          <textarea
            style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details"
          />
        </Field>

        <Field label="Date *">
          <input
            style={inputStyle}
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </Field>

        <Field label="Type">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {EVENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setEventType(t.value)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius-pill)",
                  border: "2px solid",
                  borderColor: eventType === t.value ? "var(--color-primary)" : "var(--color-surface-raised)",
                  background: eventType === t.value ? "rgba(124,77,255,0.15)" : "var(--color-surface-raised)",
                  color: eventType === t.value ? "var(--color-primary-soft)" : "var(--color-fg-muted)",
                  fontSize: "var(--type-sm)",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {eventType !== "one_time" && (
            <p style={{ fontSize: "var(--type-sm)", color: "var(--color-fg-muted)", margin: "6px 0 0" }}>
              {EVENT_TYPES.find((t) => t.value === eventType)?.description}
            </p>
          )}
        </Field>

        {eventType !== "one_time" && (
          <Field label="Repeats">
            <select
              style={inputStyle}
              value={recurrenceRule}
              onChange={(e) => setRecurrenceRule(e.target.value)}
            >
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        {error && <p style={{ color: "var(--color-danger)", fontSize: "var(--type-sm)" }}>{error}</p>}

        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            background: "var(--color-primary)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-pill)",
            padding: "14px 28px",
            fontSize: "var(--type-md)",
            fontWeight: "var(--type-weight-medium)",
            alignSelf: "flex-start",
            cursor: canSave ? "pointer" : "not-allowed",
            opacity: canSave ? 1 : 0.5,
          }}
        >
          {saving ? "Saving…" : "Save Event"}
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const formCard: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-surface-raised)",
  borderRadius: "var(--radius-xxl)",
  padding: "28px 32px",
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--type-sm)",
  fontWeight: "var(--type-weight-medium)",
  color: "var(--color-fg-muted)",
};

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface-sunk)",
  border: "1px solid var(--color-surface-raised)",
  borderRadius: "var(--radius-lg)",
  padding: "12px 16px",
  fontSize: "var(--type-md)",
  color: "var(--color-fg)",
  outline: "none",
  width: "100%",
};
