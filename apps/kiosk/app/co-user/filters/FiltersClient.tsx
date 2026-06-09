"use client";

import { useEffect, useState } from "react";
import { useAuth, supabase, type SensitivityFilter } from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";
import Icon from "@/components/Icon";

type FilterType = "person" | "topic" | "time_period";

const TYPE_LABELS: Record<FilterType, string> = {
  person: "Person",
  topic: "Topic",
  time_period: "Time Period",
};

const TYPE_PLACEHOLDERS: Record<FilterType, string> = {
  person: "e.g. Uncle David",
  topic: "e.g. the hospital, the accident",
  time_period: "e.g. 2010–2015 (difficult years)",
};

export default function FiltersClient() {
  const { userId } = useAuth();
  const [filters, setFilters] = useState<SensitivityFilter[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [filterType, setFilterType] = useState<FilterType>("topic");
  const [filterValue, setFilterValue] = useState("");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId]);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("sensitivity_filters")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setFilters((data as SensitivityFilter[]) ?? []);
    setLoading(false);
  }

  async function handleAdd() {
    if (!userId || !filterValue.trim()) return;
    setSaving(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("sensitivity_filters")
      .insert({
        user_id: userId,
        filter_type: filterType,
        filter_value: filterValue.trim(),
        notes: notes.trim() || null,
        start_date: filterType === "time_period" && startDate ? startDate : null,
        end_date: filterType === "time_period" && endDate ? endDate : null,
        person_id: null,
      })
      .select("*")
      .single();

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    setFilters((f) => [data as SensitivityFilter, ...f]);
    setFilterValue("");
    setNotes("");
    setStartDate("");
    setEndDate("");
    setSaving(false);
  }

  async function deleteFilter(id: string) {
    if (!confirm("Remove this filter?")) return;
    await supabase.from("sensitivity_filters").delete().eq("id", id);
    setFilters((f) => f.filter((x) => x.id !== id));
  }

  const grouped: Record<FilterType, SensitivityFilter[]> = {
    person: filters.filter((f) => f.filter_type === "person"),
    topic: filters.filter((f) => f.filter_type === "topic"),
    time_period: filters.filter((f) => f.filter_type === "time_period"),
  };

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Safety & Filters"
        subtitle="Control what Memo mentions to them"
      />

      <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--type-sm)", marginBottom: 28, maxWidth: 600 }}>
        Sensitivity filters tell Memo what to avoid. Use them to protect against topics, people, or time periods that may be distressing.
      </p>

      {/* Add form */}
      <div style={formCard}>
        <h3 style={cardTitle}>Add Filter</h3>

        {/* Type selector */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["topic", "person", "time_period"] as FilterType[]).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--radius-pill)",
                border: "2px solid",
                borderColor: filterType === t ? "var(--color-primary)" : "var(--color-surface-raised)",
                background: filterType === t ? "rgba(124,77,255,0.15)" : "var(--color-surface-raised)",
                color: filterType === t ? "var(--color-primary-soft)" : "var(--color-fg-muted)",
                fontSize: "var(--type-sm)",
                cursor: "pointer",
              }}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <input
          style={inputStyle}
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          placeholder={TYPE_PLACEHOLDERS[filterType]}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />

        {filterType === "time_period" && (
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Start year</label>
              <input style={inputStyle} type="number" min="1900" max="2100" value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="e.g. 2010" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>End year</label>
              <input style={inputStyle} type="number" min="1900" max="2100" value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="e.g. 2015" />
            </div>
          </div>
        )}

        <input
          style={inputStyle}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Note (optional) — why this filter exists"
        />

        {error && <p style={{ color: "var(--color-danger)", fontSize: "var(--type-sm)" }}>{error}</p>}

        <button
          onClick={handleAdd}
          disabled={saving || !filterValue.trim()}
          style={{
            ...addBtnStyle,
            opacity: saving || !filterValue.trim() ? 0.5 : 1,
            cursor: saving || !filterValue.trim() ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Add Filter"}
        </button>
      </div>

      {/* Existing filters */}
      {loading ? (
        <p style={mutedText}>Loading…</p>
      ) : filters.length === 0 ? (
        <p style={mutedText}>No filters yet.</p>
      ) : (
        <>
          {(["topic", "person", "time_period"] as FilterType[]).map((t) =>
            grouped[t].length === 0 ? null : (
              <div key={t} style={{ marginTop: 28 }}>
                <h2 style={sectionTitle}>{TYPE_LABELS[t]}s</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {grouped[t].map((f) => (
                    <FilterRow key={f.id} filter={f} onDelete={deleteFilter} />
                  ))}
                </div>
              </div>
            )
          )}
        </>
      )}
    </main>
  );
}

function FilterRow({ filter, onDelete }: { filter: SensitivityFilter; onDelete: (id: string) => void }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-surface-raised)",
        borderRadius: "var(--radius-xl)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: "var(--type-md)", color: "var(--color-fg)" }}>
          {filter.filter_value}
          {filter.start_date && filter.end_date && (
            <span style={{ color: "var(--color-fg-muted)", marginLeft: 8 }}>
              ({filter.start_date}–{filter.end_date})
            </span>
          )}
        </span>
        {filter.notes && (
          <p style={{ fontSize: "var(--type-xs)", color: "var(--color-fg-muted)", margin: "3px 0 0" }}>
            {filter.notes}
          </p>
        )}
      </div>
      <button
        onClick={() => onDelete(filter.id)}
        style={iconBtnStyle}
        title="Remove filter"
      >
        <Icon name="close" size={16} color="var(--color-danger)" />
      </button>
    </div>
  );
}

const formCard: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-surface-raised)",
  borderRadius: "var(--radius-xxl)",
  padding: "24px 28px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const cardTitle: React.CSSProperties = {
  fontSize: "var(--type-md)",
  fontWeight: "var(--type-weight-medium)",
  color: "var(--color-fg-strong)",
  margin: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--type-xs)",
  color: "var(--color-fg-muted)",
  display: "block",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface-sunk)",
  border: "1px solid var(--color-surface-raised)",
  borderRadius: "var(--radius-lg)",
  padding: "11px 14px",
  fontSize: "var(--type-md)",
  color: "var(--color-fg)",
  outline: "none",
  width: "100%",
};

const addBtnStyle: React.CSSProperties = {
  background: "var(--color-primary)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "11px 24px",
  fontSize: "var(--type-sm)",
  fontWeight: "var(--type-weight-medium)",
  alignSelf: "flex-start",
};

const mutedText: React.CSSProperties = {
  color: "var(--color-fg-muted)",
  fontSize: "var(--type-md)",
  padding: "32px 0",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "var(--type-sm)",
  fontWeight: "var(--type-weight-medium)",
  color: "var(--color-fg-muted)",
  letterSpacing: 2,
  textTransform: "uppercase",
  margin: "0 0 10px",
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
