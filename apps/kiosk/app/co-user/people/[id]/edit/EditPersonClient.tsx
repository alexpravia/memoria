"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth, supabase, embedAndStore } from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";

interface PersonRow {
  id: string;
  full_name: string;
  relationship: string;
  photo_url: string | null;
  contact_info: Record<string, string> | null;
  key_facts: string[];
  emotional_notes: string | null;
  is_sensitive: boolean;
}

export default function EditPersonClient() {
  const { id } = useParams<{ id: string }>();
  const { userId } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [emotionalNotes, setEmotionalNotes] = useState("");
  const [factInput, setFactInput] = useState("");
  const [facts, setFacts] = useState<string[]>([]);
  const [isSensitive, setIsSensitive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void loadPerson();
  }, [id]);

  async function loadPerson() {
    const { data } = await supabase
      .from("people")
      .select("*")
      .eq("id", id)
      .single();

    if (!data) return;
    const p = data as PersonRow;
    setFullName(p.full_name);
    setRelationship(p.relationship);
    setPhone(p.contact_info?.phone ?? "");
    setEmail(p.contact_info?.email ?? "");
    setEmotionalNotes(p.emotional_notes ?? "");
    setFacts(p.key_facts ?? []);
    setIsSensitive(p.is_sensitive ?? false);
    setLoading(false);
  }

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

    const { error: err } = await supabase
      .from("people")
      .update({
        full_name: fullName.trim(),
        relationship: relationship.trim(),
        emotional_notes: emotionalNotes.trim() || null,
        key_facts: facts,
        contact_info: Object.keys(contact_info).length ? contact_info : null,
        is_sensitive: isSensitive,
      })
      .eq("id", id);

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    const embedText = [fullName.trim(), relationship.trim(), emotionalNotes.trim(), ...facts]
      .filter(Boolean)
      .join(" ");
    void embedAndStore("people", id, embedText);

    router.push("/co-user/people");
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 700, margin: "0 auto", padding: "36px 32px" }}>
        <p style={{ color: "var(--color-fg-muted)" }}>Loading…</p>
      </main>
    );
  }

  const canSave = !!fullName.trim() && !!relationship.trim() && !saving;

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Edit Person"
        backHref="/co-user/people"
        backLabel="People"
      />

      <div style={formCard}>
        <Field label="Full name *">
          <input
            style={inputStyle}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>

        <Field label="Relationship *">
          <input
            style={inputStyle}
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          />
        </Field>

        <Field label="Phone">
          <input
            style={inputStyle}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
          />
        </Field>

        <Field label="Email">
          <input
            style={inputStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
        </Field>

        <Field label="Emotional context">
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
            value={emotionalNotes}
            onChange={(e) => setEmotionalNotes(e.target.value)}
          />
        </Field>

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
                  <button onClick={() => removeFact(i)} style={chipRemoveStyle} type="button">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </Field>

        <Field label="Sensitive">
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isSensitive}
              onChange={(e) => setIsSensitive(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "var(--color-primary)" }}
            />
            <span style={{ fontSize: "var(--type-sm)", color: "var(--color-fg-muted)" }}>
              Mark as sensitive (Memo will be careful when mentioning this person)
            </span>
          </label>
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
          {saving ? "Saving…" : "Save Changes"}
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
