"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, supabase, embedAndStore } from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";

export default function AddPersonClient() {
  const { userId } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [emotionalNotes, setEmotionalNotes] = useState("");
  const [factInput, setFactInput] = useState("");
  const [facts, setFacts] = useState<string[]>([]);
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
    if (!userId || !fullName.trim() || !relationship.trim()) return;
    setSaving(true);
    setError(null);

    const contact_info: Record<string, string> = {};
    if (phone.trim()) contact_info.phone = phone.trim();
    if (email.trim()) contact_info.email = email.trim();

    const { data, error: err } = await supabase
      .from("people")
      .insert({
        user_id: userId,
        full_name: fullName.trim(),
        relationship: relationship.trim(),
        emotional_notes: emotionalNotes.trim() || null,
        key_facts: facts,
        contact_info: Object.keys(contact_info).length ? contact_info : null,
        is_sensitive: false,
      })
      .select("id")
      .single();

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    const id = (data as { id: string }).id;
    const embedText = [fullName.trim(), relationship.trim(), emotionalNotes.trim(), ...facts]
      .filter(Boolean)
      .join(" ");
    void embedAndStore("people", id, embedText);

    router.push("/co-user/people");
  }

  const canSave = !!fullName.trim() && !!relationship.trim() && !saving;

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Add Person"
        subtitle="Add someone important to remember"
        backHref="/co-user/people"
        backLabel="People"
      />

      <div style={formCard}>
        {/* Name */}
        <Field label="Full name *">
          <input
            style={inputStyle}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Maria García"
            autoFocus
          />
        </Field>

        {/* Relationship */}
        <Field label="Relationship *">
          <input
            style={inputStyle}
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder="e.g. Daughter, Doctor, Best friend"
          />
        </Field>

        {/* Phone */}
        <Field label="Phone">
          <input
            style={inputStyle}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. (555) 123-4567"
            type="tel"
          />
        </Field>

        {/* Email */}
        <Field label="Email">
          <input
            style={inputStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. maria@example.com"
            type="email"
          />
        </Field>

        {/* Emotional notes */}
        <Field label="Emotional context">
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
            value={emotionalNotes}
            onChange={(e) => setEmotionalNotes(e.target.value)}
            placeholder="e.g. She visits every Sunday and brings flowers. Very calming presence."
          />
        </Field>

        {/* Key facts */}
        <Field label="Key facts">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={factInput}
              onChange={(e) => setFactInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFact())}
              placeholder="Add a fact and press Enter"
            />
            <button onClick={addFact} style={addChipBtnStyle} type="button">
              Add
            </button>
          </div>
          {facts.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {facts.map((f, i) => (
                <span key={i} style={chipStyle}>
                  {f}
                  <button
                    onClick={() => removeFact(i)}
                    style={chipRemoveStyle}
                    type="button"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </Field>

        {error && <p style={errorStyle}>{error}</p>}

        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            ...saveBtnStyle,
            opacity: canSave ? 1 : 0.5,
            cursor: canSave ? "pointer" : "not-allowed",
          }}
        >
          {saving ? "Saving…" : "Save Person"}
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

const addChipBtnStyle: React.CSSProperties = {
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

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "var(--color-surface-raised)",
  color: "var(--color-fg)",
  borderRadius: "var(--radius-full)",
  padding: "4px 12px",
  fontSize: "var(--type-sm)",
};

const chipRemoveStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--color-fg-muted)",
  cursor: "pointer",
  fontSize: "var(--type-md)",
  lineHeight: 1,
  padding: 0,
};

const saveBtnStyle: React.CSSProperties = {
  background: "var(--color-primary)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "14px 28px",
  fontSize: "var(--type-md)",
  fontWeight: "var(--type-weight-medium)",
  alignSelf: "flex-start",
};

const errorStyle: React.CSSProperties = {
  color: "var(--color-danger)",
  fontSize: "var(--type-sm)",
};
