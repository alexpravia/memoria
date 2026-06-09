"use client";

import { useEffect, useState } from "react";
import { useAuth, supabase } from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";

export default function SetupLoginClient() {
  const { userId } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [hasAccount, setHasAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    void checkExisting();
  }, [userId]);

  async function checkExisting() {
    if (!userId) return;
    const { data } = await supabase
      .from("users")
      .select("auth_id")
      .eq("id", userId)
      .single();
    setHasAccount(!!(data as { auth_id?: string } | null)?.auth_id);
  }

  async function handleSave() {
    if (!userId || !email.trim() || !password || password !== confirm) return;
    setSaving(true);
    setError(null);

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpErr) {
      setError(signUpErr.message);
      setSaving(false);
      return;
    }

    if (data.user) {
      const { error: updateErr } = await supabase
        .from("users")
        .update({ auth_id: data.user.id })
        .eq("id", userId);

      if (updateErr) {
        setError(updateErr.message);
        setSaving(false);
        return;
      }

      setHasAccount(true);
      setSuccess(true);
    }

    setSaving(false);
  }

  const canSave = !!email.trim() && password.length >= 6 && password === confirm && !saving;

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Set Up Their Login"
        subtitle="Create the patient's account credentials"
      />

      {success ? (
        <div
          style={{
            background: "rgba(76,175,80,0.1)",
            border: "1px solid var(--color-success)",
            borderRadius: "var(--radius-xl)",
            padding: "20px 24px",
            color: "var(--color-success)",
            fontSize: "var(--type-md)",
          }}
        >
          Account created! Use these credentials to sign into the kiosk device.
        </div>
      ) : (
        <div style={formCard}>
          {hasAccount && (
            <div
              style={{
                background: "rgba(245,158,11,0.1)",
                border: "1px solid #f59e0b",
                borderRadius: "var(--radius-lg)",
                padding: "12px 16px",
                color: "#f59e0b",
                fontSize: "var(--type-sm)",
              }}
            >
              This patient already has login credentials. Creating new ones will overwrite the existing login.
            </div>
          )}

          <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--type-sm)", margin: 0 }}>
            Create a simple email and password for the patient to use on the kiosk device. They won&apos;t need to type it themselves — you&apos;ll sign them in once and it stays logged in.
          </p>

          <Field label="Email address">
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. robert@family.com"
              autoFocus
            />
          </Field>

          <Field label="Password (6+ characters)">
            <input
              style={inputStyle}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password"
              minLength={6}
            />
          </Field>

          <Field label="Confirm password">
            <input
              style={inputStyle}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat the password"
            />
          </Field>

          {confirm && password !== confirm && (
            <p style={{ color: "var(--color-danger)", fontSize: "var(--type-sm)" }}>
              Passwords don&apos;t match.
            </p>
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
              padding: "12px 24px",
              fontSize: "var(--type-md)",
              fontWeight: "var(--type-weight-medium)",
              cursor: canSave ? "pointer" : "not-allowed",
              opacity: canSave ? 1 : 0.5,
              alignSelf: "flex-start",
            }}
          >
            {saving ? "Creating…" : hasAccount ? "Update Login" : "Create Login"}
          </button>
        </div>
      )}
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
