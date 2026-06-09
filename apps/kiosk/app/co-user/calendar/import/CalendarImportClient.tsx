"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, supabase, embedAndStore } from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";
import Icon from "@/components/Icon";

interface ParsedEvent {
  title: string;
  description: string | null;
  event_date: string;
}

function parseICS(text: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const vevents = text.split("BEGIN:VEVENT").slice(1);
  const now = new Date();
  const past = new Date(now);
  past.setMonth(past.getMonth() - 1);
  const future = new Date(now);
  future.setMonth(future.getMonth() + 3);

  for (const ev of vevents) {
    const get = (key: string) => {
      const m = ev.match(new RegExp(`${key}[^:]*:([^\\r\\n]+)`));
      return m ? m[1].trim() : null;
    };

    const summary = get("SUMMARY");
    if (!summary) continue;

    const dtstart = get("DTSTART");
    if (!dtstart) continue;

    const dateStr = dtstart.replace(/T\d+Z?$/, "");
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    const isoDate = `${year}-${month}-${day}`;
    const d = new Date(isoDate + "T00:00:00");

    if (d < past || d > future) continue;

    events.push({
      title: summary,
      description: get("DESCRIPTION"),
      event_date: isoDate,
    });
  }

  return events;
}

export default function CalendarImportClient() {
  const { userId } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedEvent[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(f: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const events = parseICS(text);
      setParsed(events);
      setSelected(new Set(events.map((_, i) => i)));
    };
    reader.readAsText(f);
  }

  async function handleImport() {
    if (!userId || selected.size === 0) return;
    setSaving(true);
    setError(null);

    const toInsert = Array.from(selected).map((i) => {
      const e = parsed[i];
      const isPast = new Date(e.event_date + "T00:00:00") < new Date();
      return {
        user_id: userId,
        title: e.title,
        description: e.description,
        event_date: e.event_date,
        event_type: "one_time" as const,
        recurrence_rule: null,
        is_past: isPast,
        people_involved: [],
      };
    });

    const { data, error: err } = await supabase
      .from("events")
      .insert(toInsert)
      .select("id, title");

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    for (const row of (data as { id: string; title: string }[])) {
      void embedAndStore("events", row.id, row.title);
    }

    setDone(true);
    setSaving(false);
  }

  function toggleAll() {
    if (selected.size === parsed.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(parsed.map((_, i) => i)));
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Import Calendar"
        subtitle="Import events from a .ics file"
        backHref="/co-user/events"
        backLabel="Events"
      />

      {done ? (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <Icon name="calendar" size={48} color="var(--color-success)" />
          <h2 style={{ fontSize: "var(--type-greeting)", color: "var(--color-fg-strong)", margin: "16px 0 8px" }}>
            Import complete
          </h2>
          <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--type-md)" }}>
            {selected.size} event{selected.size !== 1 ? "s" : ""} imported.
          </p>
          <button onClick={() => router.push("/co-user/events")} style={primaryBtnStyle}>
            View Events
          </button>
        </div>
      ) : parsed.length === 0 ? (
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            border: "2px dashed var(--color-surface-raised)",
            borderRadius: "var(--radius-xxl)",
            padding: "48px 32px",
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".ics,text/calendar"
            style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Icon name="calendar" size={40} color="var(--color-primary-soft)" />
          <p style={{ fontSize: "var(--type-lg)", color: "var(--color-fg-strong)", margin: "12px 0 4px" }}>
            Upload a .ics file
          </p>
          <p style={{ fontSize: "var(--type-sm)", color: "var(--color-fg-muted)", margin: 0 }}>
            Export from Google Calendar, Apple Calendar, or Outlook
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ color: "var(--color-fg-muted)", fontSize: "var(--type-sm)" }}>
              {parsed.length} events found (±1 month to +3 months)
            </span>
            <button onClick={toggleAll} style={toggleBtnStyle}>
              {selected.size === parsed.length ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {parsed.map((e, i) => (
              <div
                key={i}
                onClick={() => setSelected((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                style={{
                  background: "var(--color-surface)",
                  border: `2px solid ${selected.has(i) ? "var(--color-primary)" : "var(--color-surface-raised)"}`,
                  borderRadius: "var(--radius-xl)",
                  padding: "12px 16px",
                  cursor: "pointer",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "var(--radius-sm)",
                    border: `2px solid ${selected.has(i) ? "var(--color-primary)" : "var(--color-surface-raised)"}`,
                    background: selected.has(i) ? "var(--color-primary)" : "transparent",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected.has(i) && <span style={{ color: "white", fontSize: 12 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--type-md)", color: "var(--color-fg-strong)" }}>{e.title}</div>
                  <div style={{ fontSize: "var(--type-sm)", color: "var(--color-fg-muted)" }}>{e.event_date}</div>
                </div>
              </div>
            ))}
          </div>

          {error && <p style={{ color: "var(--color-danger)", fontSize: "var(--type-sm)", marginBottom: 12 }}>{error}</p>}

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={handleImport}
              disabled={saving || selected.size === 0}
              style={{
                ...primaryBtnStyle,
                opacity: saving || selected.size === 0 ? 0.5 : 1,
                cursor: saving || selected.size === 0 ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Importing…" : `Import ${selected.size} event${selected.size !== 1 ? "s" : ""}`}
            </button>
            <button onClick={() => setParsed([])} style={secondaryBtnStyle}>
              Choose different file
            </button>
          </div>
        </>
      )}
    </main>
  );
}

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

const toggleBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--color-primary-soft)",
  fontSize: "var(--type-sm)",
  cursor: "pointer",
};
