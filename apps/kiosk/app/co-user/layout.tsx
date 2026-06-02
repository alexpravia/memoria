"use client";

import "@/lib/supabase";

import Link from "next/link";
import { useAuth } from "@memoria/core";
import { Logo } from "@/components/Logo";

export default function CoUserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { signOut } = useAuth();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg)",
        color: "var(--color-fg)",
      }}
    >
      {/* Top navigation bar */}
      <header
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          borderBottom: "1px solid var(--color-surface-raised)",
          flexShrink: 0,
        }}
      >
        <Link
          href="/co-user"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <Logo size={28} />
          <span
            style={{
              fontSize: "var(--type-h2)",
              fontWeight: "var(--type-weight-medium)",
              color: "var(--color-fg-strong)",
            }}
          >
            Memoria
          </span>
          <span
            style={{
              fontSize: "var(--type-sm)",
              color: "var(--color-fg-muted)",
              marginLeft: 4,
            }}
          >
            Co-user Portal
          </span>
        </Link>

        <button
          onClick={() => void signOut()}
          style={{
            background: "none",
            border: "1px solid var(--color-surface-raised)",
            borderRadius: "var(--radius-pill)",
            padding: "7px 18px",
            color: "var(--color-fg-muted)",
            fontSize: "var(--type-sm)",
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </header>

      {/* Page content */}
      <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
    </div>
  );
}
