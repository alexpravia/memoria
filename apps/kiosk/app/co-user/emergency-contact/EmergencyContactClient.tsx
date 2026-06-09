"use client";

import { useEffect, useState } from "react";
import { useAuth, supabase } from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";

export default function EmergencyContactClient() {
  const { coUserId } = useAuth();
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coUserId) return;
    void load();
  }, [coUserId]);

  async function load() {
    if (!coUserId) return;
    const { data } = await supabase
      .from("co_users")
      .select("phone")
      .eq("id", coUserId)
      .single();
    setPhone((data as { phone?: string } | null)?.phone ?? "");
  }

  async function handleSave() {
    if (!coUserId) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("co_users")
      .update({ phone: phone.trim() || null })
      .eq("id", coUserId);
    if (err) {
      setError(err.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Emergency Contact"
        subtitle="Shown on the 'Who Am I?' screen"
      />

      <div style={formCard}>
        <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--type-sm)", margin: 0 }}>
          This phone number appears prominently on the patient&apos;s emergency card so anyone nearby can call for help.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={labelStyle}>Your phone number</label>
          <input
            style={inputStyle}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. (555) 123-4567"
            autoFocus
          />
        </div>

        {error && <p style={{ color: "var(--color-danger)", fontSize: "var(--type-sm)" }}>{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: saved ? "var(--color-success)" : "var(--color-primary)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-pill)",
            padding: "12px 24px",
            fontSize: "var(--type-md)",
            fontWeight: "var(--type-weight-medium)",
            cursor: saving ? "not-allowed" : "pointer",
            alignSelf: "flex-start",
            transition: "background 0.3s",
          }}
        >
          {saving ? "Saving…" : saved ? "Saved!" : "Save"}
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
  width: "100%",
};
