"use client";

import { useState } from "react";
import { useAuth, supabase } from "@memoria/core";
import { Logo } from "@/components/Logo";

export function SignUp({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit =
    fullName.trim() && email.trim() && password.length >= 6 && confirm && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signUp(email.trim(), password, "co_user", fullName.trim());
      // If email confirmation is enabled on the project, no session exists yet.
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setNotice(
          "Almost there! Check your email and click the confirmation link, then sign in."
        );
      }
      // Otherwise the auth gate picks up the new session and routes to onboarding.
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Sign up failed. Please try again.";
      setError(
        msg.toLowerCase().includes("already registered")
          ? "An account with this email already exists. Try signing in instead."
          : msg
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: 32,
        background:
          "radial-gradient(circle at 50% 32%, var(--color-surface-sunk), var(--color-bg))",
        color: "var(--color-fg)",
      }}
    >
      <Logo size={96} />

      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <h1
          style={{
            fontSize: "var(--type-greeting)",
            fontWeight: "var(--type-weight-bold)",
            color: "var(--color-fg-strong)",
            margin: 0,
          }}
        >
          Create Your Account
        </h1>
        <p
          style={{
            fontSize: "var(--type-lg)",
            color: "var(--color-fg-muted)",
            margin: "8px 0 0",
          }}
        >
          For family members and caregivers
        </p>
      </div>

      {notice ? (
        <p
          style={{
            fontSize: "var(--type-lg)",
            color: "var(--color-fg)",
            textAlign: "center",
            maxWidth: 420,
            lineHeight: 1.5,
          }}
        >
          {notice}
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            width: "min(420px, 90vw)",
          }}
        >
          <input
            type="text"
            placeholder="Your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            disabled={loading}
            required
            style={inputStyle}
          />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            disabled={loading}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            disabled={loading}
            required
            minLength={6}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            disabled={loading}
            required
            style={inputStyle}
          />

          {error && (
            <p
              style={{
                fontSize: "var(--type-md)",
                color: "var(--color-danger)",
                margin: 0,
                textAlign: "center",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              background: !canSubmit
                ? "var(--color-surface-raised)"
                : "var(--color-primary)",
              color: "var(--color-fg-strong)",
              border: "none",
              borderRadius: "var(--radius-pill)",
              padding: "18px 32px",
              fontSize: "var(--type-xl)",
              fontWeight: "var(--type-weight-medium)",
              cursor: !canSubmit ? "not-allowed" : "pointer",
              opacity: !canSubmit ? 0.6 : 1,
              transition: "background 0.2s, opacity 0.2s",
            }}
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={onSwitchToSignIn}
        style={{
          background: "none",
          border: "none",
          color: "var(--color-fg-muted)",
          fontSize: "var(--type-md)",
          cursor: "pointer",
          textDecoration: "underline",
          padding: 8,
        }}
      >
        Already have an account? Sign in
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "2px solid var(--color-surface-raised)",
  borderRadius: "var(--radius-lg)",
  padding: "16px 20px",
  fontSize: "var(--type-xl)",
  color: "var(--color-fg)",
  outline: "none",
  width: "100%",
};
