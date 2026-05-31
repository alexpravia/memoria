import Link from "next/link";
import { Logo } from "@/components/Logo";
import Icon from "@/components/Icon";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        background: "var(--color-bg)",
        color: "var(--color-fg)",
      }}
    >
      <Logo size={80} />
      <h1 style={{ fontSize: "var(--type-greeting)", color: "var(--color-fg-strong)", margin: 0 }}>
        Memoria
      </h1>
      <p style={{ fontSize: "var(--type-lg)", color: "var(--color-primary-soft)", margin: 0 }}>
        Kiosk — W1 ✓
      </p>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        <Icon name="startDay" size={28} />
        <Icon name="memo" size={28} />
        <Icon name="calendar" size={28} />
        <Icon name="safety" size={28} />
        <Icon name="sparkle" size={28} />
      </div>
      <Link
        href="/assistant"
        style={{
          marginTop: 16,
          background: "var(--color-primary)",
          color: "white",
          padding: "14px 32px",
          borderRadius: "var(--radius-xxl)",
          fontSize: "var(--type-lg)",
          fontWeight: "var(--type-weight-medium)",
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Icon name="memo" size={22} color="white" />
        Talk to Memo
      </Link>
    </main>
  );
}
