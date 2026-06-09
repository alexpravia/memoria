"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAuth,
  supabase,
  getNarrative,
  saveNarrative,
  embedAndStore,
  type NarrativeSuggestions,
  type NarrativePersonSuggestion,
  type NarrativeLifeFactSuggestion,
  type NarrativeEventSuggestion,
  type NarrativeSensitivitySuggestion,
} from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";
import Icon from "@/components/Icon";

type SuggestionTab = "people" | "life_facts" | "events" | "sensitivity";

export default function StoryClient() {
  const { userId } = useAuth();
  const router = useRouter();
  const [text, setText] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<NarrativeSuggestions | null>(null);
  const [activeTab, setActiveTab] = useState<SuggestionTab>("people");
  const [promoted, setPromoted] = useState<Set<string>>(new Set());
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [chunkCount, setChunkCount] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId]);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const raw = await getNarrative(userId);
    setText(raw);
    setOriginalText(raw);
    setLoading(false);
  }

  async function handleSave() {
    if (!userId || !text.trim()) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    const result = await saveNarrative(userId, text.trim());
    if (!result.ok) {
      setError(result.error ?? "Failed to save");
      setSaving(false);
      return;
    }
    setOriginalText(text.trim());
    setChunkCount(result.chunkCount ?? null);
    setSuggestions(result.suggestions ?? null);
    setSaveSuccess(true);
    setSaving(false);
  }

  async function promotePerson(s: NarrativePersonSuggestion, key: string) {
    if (!userId || promoted.has(key) || promotingId === key) return;
    setPromotingId(key);
    const { data, error: err } = await supabase
      .from("people")
      .insert({
        user_id: userId,
        full_name: s.name,
        relationship: s.relationship ?? "",
        emotional_notes: s.notes,
        key_facts: [],
        is_sensitive: false,
      })
      .select("id")
      .single();
    if (!err && data) {
      const embedText = [s.name, s.relationship, s.notes].filter(Boolean).join(" ");
      void embedAndStore("people", (data as { id: string }).id, embedText);
      setPromoted((p) => new Set([...p, key]));
    }
    setPromotingId(null);
  }

  async function promoteLifeFact(s: NarrativeLifeFactSuggestion, key: string) {
    if (!userId || promoted.has(key) || promotingId === key) return;
    setPromotingId(key);
    const { data, error: err } = await supabase
      .from("life_facts")
      .insert({ user_id: userId, fact: s.fact, category: s.category ?? "Other" })
      .select("id")
      .single();
    if (!err && data) {
      void embedAndStore("life_facts", (data as { id: string }).id, s.fact);
      setPromoted((p) => new Set([...p, key]));
    }
    setPromotingId(null);
  }

  async function promoteEvent(s: NarrativeEventSuggestion, key: string) {
    if (!userId || promoted.has(key) || promotingId === key) return;
    setPromotingId(key);
    const { data, error: err } = await supabase
      .from("events")
      .insert({
        user_id: userId,
        title: s.title,
        description: s.description,
        event_type: s.event_type,
        recurrence_rule: s.recurrence_rule,
        is_past: false,
        people_involved: [],
      })
      .select("id")
      .single();
    if (!err && data) {
      void embedAndStore("events", (data as { id: string }).id, [s.title, s.description].filter(Boolean).join(" "));
      setPromoted((p) => new Set([...p, key]));
    }
    setPromotingId(null);
  }

  async function promoteFilter(s: NarrativeSensitivitySuggestion, key: string) {
    if (!userId || promoted.has(key) || promotingId === key) return;
    setPromotingId(key);
    await supabase.from("sensitivity_filters").insert({
      user_id: userId,
      filter_type: s.filter_type,
      value: s.intent_text,
      notes: "Extracted from narrative",
    });
    setPromoted((p) => new Set([...p, key]));
    setPromotingId(null);
  }

  const isDirty = text.trim() !== originalText.trim();

  const tabs: { key: SuggestionTab; label: string; count: number }[] = [
    { key: "people", label: "People", count: suggestions?.people?.length ?? 0 },
    { key: "life_facts", label: "Life Facts", count: suggestions?.life_facts?.length ?? 0 },
    { key: "events", label: "Events", count: suggestions?.events?.length ?? 0 },
    { key: "sensitivity", label: "Sensitivity", count: suggestions?.sensitivity_hints?.length ?? 0 },
  ];

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Write About Them"
        subtitle="A freeform narrative about the patient — Memo uses this to give more personal, contextual responses"
        backHref="/co-user"
        backLabel="Dashboard"
      />

      {loading ? (
        <p style={mutedText}>Loading…</p>
      ) : (
        <>
          {/* Editor card */}
          <div style={editorCard}>
            <p style={{ fontSize: "var(--type-sm)", color: "var(--color-fg-muted)", margin: "0 0 12px" }}>
              Write freely — their personality, daily routines, meaningful relationships, important memories, fears, joys. The more detail you add, the better Memo can support them. Memo reads this as context for every conversation.
            </p>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setSaveSuccess(false); }}
              placeholder="Start writing about them… For example: 'Robert was a high school history teacher for 32 years. He loves the New York Yankees and gets excited when the game is on. His wife of 40 years, Margaret, passed away in 2019…'"
              style={textareaStyle}
              rows={16}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <button
                onClick={handleSave}
                disabled={saving || !text.trim() || !isDirty}
                style={{
                  ...primaryBtnStyle,
                  opacity: saving || !text.trim() || !isDirty ? 0.5 : 1,
                  cursor: saving || !text.trim() || !isDirty ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving & Processing…" : "Save & Process"}
              </button>
              {saveSuccess && chunkCount !== null && (
                <span style={{ fontSize: "var(--type-sm)", color: "var(--color-success)" }}>
                  Saved — {chunkCount} chunks embedded for Memo
                </span>
              )}
              {error && (
                <span style={{ fontSize: "var(--type-sm)", color: "var(--color-danger)" }}>{error}</span>
              )}
            </div>
          </div>

          {/* Suggestions panel */}
          {suggestions && (
            <div style={{ marginTop: 36 }}>
              <h2 style={sectionTitle}>Extracted Suggestions</h2>
              <p style={{ fontSize: "var(--type-sm)", color: "var(--color-fg-muted)", marginBottom: 16 }}>
                Memo found these in the narrative. Review and add the ones that are accurate.
              </p>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: "7px 16px",
                      borderRadius: "var(--radius-pill)",
                      border: "none",
                      background: activeTab === tab.key ? "var(--color-primary)" : "var(--color-surface-raised)",
                      color: activeTab === tab.key ? "white" : "var(--color-fg-muted)",
                      fontSize: "var(--type-sm)",
                      cursor: "pointer",
                      fontWeight: activeTab === tab.key ? "var(--type-weight-medium)" : "normal",
                    }}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span
                        style={{
                          marginLeft: 6,
                          background: activeTab === tab.key ? "rgba(255,255,255,0.3)" : "var(--color-primary-soft)",
                          color: activeTab === tab.key ? "white" : "var(--color-primary)",
                          borderRadius: "var(--radius-full)",
                          fontSize: "var(--type-xxs)",
                          padding: "1px 6px",
                        }}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* People */}
              {activeTab === "people" && (
                <SuggestionList
                  empty="No people detected in the narrative."
                  items={(suggestions.people ?? []).map((s, i) => {
                    const key = `person-${i}`;
                    return (
                      <SuggestionCard
                        key={key}
                        promoted={promoted.has(key)}
                        promoting={promotingId === key}
                        onAdd={() => promotePerson(s, key)}
                        addLabel="Add to People"
                      >
                        <strong style={{ color: "var(--color-fg-strong)" }}>{s.name}</strong>
                        {s.relationship && <span style={tagStyle}>{s.relationship}</span>}
                        {s.notes && <p style={noteText}>{s.notes}</p>}
                      </SuggestionCard>
                    );
                  })}
                />
              )}

              {/* Life Facts */}
              {activeTab === "life_facts" && (
                <SuggestionList
                  empty="No life facts detected in the narrative."
                  items={(suggestions.life_facts ?? []).map((s, i) => {
                    const key = `fact-${i}`;
                    return (
                      <SuggestionCard
                        key={key}
                        promoted={promoted.has(key)}
                        promoting={promotingId === key}
                        onAdd={() => promoteLifeFact(s, key)}
                        addLabel="Add to Life Facts"
                      >
                        {s.category && <span style={tagStyle}>{s.category}</span>}
                        <p style={{ margin: 0, color: "var(--color-fg)", fontSize: "var(--type-md)" }}>{s.fact}</p>
                      </SuggestionCard>
                    );
                  })}
                />
              )}

              {/* Events */}
              {activeTab === "events" && (
                <SuggestionList
                  empty="No events detected in the narrative."
                  items={(suggestions.events ?? []).map((s, i) => {
                    const key = `event-${i}`;
                    return (
                      <SuggestionCard
                        key={key}
                        promoted={promoted.has(key)}
                        promoting={promotingId === key}
                        onAdd={() => promoteEvent(s, key)}
                        addLabel="Add to Events"
                      >
                        <strong style={{ color: "var(--color-fg-strong)" }}>{s.title}</strong>
                        <span style={tagStyle}>{s.event_type.replace("_", " ")}</span>
                        {s.description && <p style={noteText}>{s.description}</p>}
                      </SuggestionCard>
                    );
                  })}
                />
              )}

              {/* Sensitivity */}
              {activeTab === "sensitivity" && (
                <SuggestionList
                  empty="No sensitivity hints detected in the narrative."
                  items={(suggestions.sensitivity_hints ?? []).map((s, i) => {
                    const key = `filter-${i}`;
                    return (
                      <SuggestionCard
                        key={key}
                        promoted={promoted.has(key)}
                        promoting={promotingId === key}
                        onAdd={() => promoteFilter(s, key)}
                        addLabel="Add to Filters"
                      >
                        <span style={tagStyle}>{s.filter_type}</span>
                        <p style={{ margin: 0, color: "var(--color-fg)", fontSize: "var(--type-md)" }}>{s.intent_text}</p>
                      </SuggestionCard>
                    );
                  })}
                />
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function SuggestionList({ items, empty }: { items: React.ReactNode[]; empty: string }) {
  if (items.length === 0) {
    return (
      <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--type-sm)", padding: "20px 0" }}>
        {empty}
      </p>
    );
  }
  return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{items}</div>;
}

function SuggestionCard({
  children,
  promoted,
  promoting,
  onAdd,
  addLabel,
}: {
  children: React.ReactNode;
  promoted: boolean;
  promoting: boolean;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div
      style={{
        background: promoted ? "rgba(76,175,80,0.06)" : "var(--color-surface)",
        border: `1px solid ${promoted ? "rgba(76,175,80,0.3)" : "var(--color-surface-raised)"}`,
        borderRadius: "var(--radius-xl)",
        padding: "14px 18px",
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {children}
      </div>
      <button
        onClick={onAdd}
        disabled={promoted || promoting}
        style={{
          background: promoted ? "var(--color-success)" : "var(--color-surface-raised)",
          color: promoted ? "white" : "var(--color-fg-muted)",
          border: "none",
          borderRadius: "var(--radius-pill)",
          padding: "7px 14px",
          fontSize: "var(--type-xs)",
          cursor: promoted || promoting ? "default" : "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0,
          opacity: promoting ? 0.6 : 1,
        }}
      >
        {promoting ? "Adding…" : promoted ? "Added ✓" : addLabel}
      </button>
    </div>
  );
}

const editorCard: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-surface-raised)",
  borderRadius: "var(--radius-xxl)",
  padding: "24px 28px",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--color-surface-sunk)",
  border: "1px solid var(--color-surface-raised)",
  borderRadius: "var(--radius-lg)",
  padding: "16px",
  fontSize: "var(--type-md)",
  color: "var(--color-fg)",
  resize: "vertical",
  lineHeight: 1.6,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
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

const sectionTitle: React.CSSProperties = {
  fontSize: "var(--type-sm)",
  fontWeight: "var(--type-weight-medium)",
  color: "var(--color-fg-muted)",
  letterSpacing: 2,
  textTransform: "uppercase",
  margin: "0 0 6px",
};

const mutedText: React.CSSProperties = {
  color: "var(--color-fg-muted)",
  fontSize: "var(--type-md)",
  padding: "40px 0",
};

const tagStyle: React.CSSProperties = {
  fontSize: "var(--type-xxs)",
  background: "var(--color-surface-raised)",
  color: "var(--color-fg-muted)",
  borderRadius: "var(--radius-full)",
  padding: "2px 8px",
  alignSelf: "flex-start",
};

const noteText: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--type-sm)",
  color: "var(--color-fg-muted)",
};
