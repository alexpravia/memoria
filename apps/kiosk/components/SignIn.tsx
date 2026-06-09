"use client";

import { useState } from "react";
import { useAuth } from "@memoria/core";
import { Logo } from "@/components/Logo";

export function SignIn({ onSwitchToSignUp }: { onSwitchToSignUp?: () => void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Sign in failed. Please try again.";
      setError(
        msg.toLowerCase().includes("invalid")
          ? "Incorrect email or password. Please try again."
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
          Welcome to Memoria
        </h1>
        <p
          style={{
            fontSize: "var(--type-lg)",
            color: "var(--color-fg-muted)",
            margin: "8px 0 0",
          }}
        >
          Sign in to continue
        </p>
      </div>

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
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
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
          disabled={loading || !email.trim() || !password}
          style={{
            background:
              loading || !email.trim() || !password
                ? "var(--color-surface-raised)"
                : "var(--color-primary)",
            color: "var(--color-fg-strong)",
            border: "none",
            borderRadius: "var(--radius-pill)",
            padding: "18px 32px",
            fontSize: "var(--type-xl)",
            fontWeight: "var(--type-weight-medium)",
            cursor:
              loading || !email.trim() || !password ? "not-allowed" : "pointer",
            opacity: loading || !email.trim() || !password ? 0.6 : 1,
            transition: "background 0.2s, opacity 0.2s",
          }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <p
        style={{
          fontSize: "var(--type-sm)",
          color: "var(--color-fg-muted)",
          textAlign: "center",
          maxWidth: 360,
          lineHeight: 1.5,
        }}
      >
        Your account was set up by a family member or caregiver.
        <br />
        If you need help signing in, please ask them.
      </p>

      {onSwitchToSignUp && (
        <button
          type="button"
          onClick={onSwitchToSignUp}
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
          Caring for someone? Create a caregiver account
        </button>
      )}
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
