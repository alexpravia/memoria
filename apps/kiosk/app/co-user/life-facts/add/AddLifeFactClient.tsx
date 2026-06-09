"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, supabase, embedAndStore } from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";

const CATEGORIES = [
  "Career",
  "Family",
  "Hobby",
  "Health",
  "Education",
  "Home",
  "Travel",
  "Other",
];

export default function AddLifeFactClient() {
  const { userId } = useAuth();
  const router = useRouter();
  const [factInput, setFactInput] = useState("");
  const [facts, setFacts] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFact() {
    const t = factInput.trim();
    if (!t) return;
    setFacts((f) => [...f, t]);
    setFactInput("");
  }

  function removeFact(i: number) {
    setFacts((f) => f.filter((_, j) => j !== i));
  }

  async function handleSave() {
    if (!userId || facts.length === 0) return;
    setSaving(true);
    setError(null);

    const rows = facts.map((fact) => ({
      user_id: userId,
      fact,
      category: category || null,
    }));

    const { data, error: err } = await supabase
      .from("life_facts")
      .insert(rows)
      .select("id, fact");

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    for (const row of (data as { id: string; fact: string }[])) {
      void embedAndStore("life_facts", row.id, row.fact);
    }

    router.push("/co-user/life-facts");
  }

  const canSave = facts.length > 0 && !saving;

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Add Life Facts"
        subtitle="Add facts Memo will use to remind them of their life"
        backHref="/co-user/life-facts"
        backLabel="Life Facts"
      />

      <div style={formCard}>
        {/* Input row */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={labelStyle}>Facts</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={factInput}
              onChange={(e) => setFactInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFact())}
              placeholder="e.g. Worked as a nurse for 30 years"
              autoFocus
            />
            <button onClick={addFact} style={addBtnStyle} type="button">
              Add
            </button>
          </div>
          {facts.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {facts.map((f, i) => (
                <div key={i} style={factRowStyle}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "var(--radius-full)",
                      background: "var(--color-primary-soft)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, fontSize: "var(--type-md)", color: "var(--color-fg)" }}>
                    {f}
                  </span>
                  <button
                    onClick={() => removeFact(i)}
                    style={removeStyle}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={labelStyle}>Category (optional)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(category === c ? "" : c)}
                type="button"
                style={{
                  background: category === c ? "var(--color-primary)" : "var(--color-surface-raised)",
                  color: category === c ? "white" : "var(--color-fg-muted)",
                  border: "none",
                  borderRadius: "var(--radius-full)",
                  padding: "6px 14px",
                  fontSize: "var(--type-sm)",
                  cursor: "pointer",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

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
          {saving ? "Saving…" : `Save ${facts.length > 0 ? facts.length : ""} Fact${facts.length !== 1 ? "s" : ""}`}
        </button>
      </div>
    </main>
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
};

const addBtnStyle: React.CSSProperties = {
  background: "var(--color-primary)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-lg)",
  padding: "12px 18px",
  fontSize: "var(--type-sm)",
  fontWeight: "var(--type-weight-medium)",
  cursor: "pointer",
  flexShrink: 0,
};

const factRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "var(--color-surface-raised)",
  borderRadius: "var(--radius-lg)",
  padding: "10px 14px",
};

const removeStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--color-fg-muted)",
  cursor: "pointer",
  fontSize: "var(--type-lg)",
  lineHeight: 1,
  padding: 0,
  flexShrink: 0,
};
